import { withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';
import * as resourceRepo from './resources.repository.js';

export async function listResources(orgId, queryOptions) {
  return resourceRepo.listResources(orgId, queryOptions);
}

export async function listAssignments(orgId, projectId = null) {
  return resourceRepo.listAssignments(orgId, projectId);
}

export async function createResource(orgId, actorId, payload) {
  return withTransaction(async (client) => {
    const resource = await resourceRepo.createResource(orgId, payload, client);

    await logActivity(
      {
        organizationId: orgId,
        actorId,
        action: 'resource.created',
        entityType: 'resource',
        entityId: resource.id,
        summary: `Registered resource "${resource.name}" (${resource.total_quantity} ${resource.unit})`,
      },
      client
    );

    return resource;
  });
}

export async function updateResource(orgId, resourceId, actorId, payload) {
  return withTransaction(async (client) => {
    const existing = await resourceRepo.findResourceForUpdate(orgId, resourceId, client);
    if (!existing) {
      throw AppError.notFound('Resource not found.');
    }

    const nextTotal = payload.totalQuantity ?? Number(existing.total_quantity);
    const nextAvail = payload.availableQuantity ?? Number(existing.available_quantity);
    const nextThreshold = payload.minThreshold ?? Number(existing.min_threshold);

    if (nextAvail > nextTotal) {
      throw AppError.badRequest('Available quantity cannot exceed total quantity.');
    }

    const nextStatus = resourceRepo.computeResourceStatus(nextAvail, nextThreshold);
    const updated = await resourceRepo.updateResource(orgId, resourceId, payload, nextStatus, client);

    await logActivity(
      {
        organizationId: orgId,
        actorId,
        action: 'resource.updated',
        entityType: 'resource',
        entityId: resourceId,
        summary: `Updated resource "${updated.name}" (available: ${updated.available_quantity}/${updated.total_quantity} ${updated.unit})`,
      },
      client
    );

    return updated;
  });
}

export async function assignResourceToProject(orgId, resourceId, actorId, payload) {
  return withTransaction(async (client) => {
    // Row-level FOR UPDATE lock prevents concurrent over-allocation race conditions
    const resource = await resourceRepo.findResourceForUpdate(orgId, resourceId, client);
    if (!resource) {
      throw AppError.notFound('Resource not found.');
    }

    const projectRes = await client.query(
      `SELECT id, project_code, name FROM projects WHERE organization_id = $1 AND id = $2`,
      [orgId, payload.projectId]
    );
    const project = projectRes.rows[0];
    if (!project) {
      throw AppError.notFound('Project not found in this organization.');
    }

    const currentAvail = Number(resource.available_quantity);
    if (payload.quantityAllocated > currentAvail) {
      throw AppError.conflict(
        `Insufficient stock for "${resource.name}". Requested ${payload.quantityAllocated} ${resource.unit}, but only ${currentAvail} ${resource.unit} available.`,
        'INSUFFICIENT_RESOURCE_STOCK'
      );
    }

    const remainingAvail = Number((currentAvail - payload.quantityAllocated).toFixed(2));
    const nextStatus = resourceRepo.computeResourceStatus(remainingAvail, resource.min_threshold);

    await resourceRepo.updateResource(
      orgId,
      resourceId,
      { availableQuantity: remainingAvail },
      nextStatus,
      client
    );

    const assignment = await resourceRepo.createAssignment(
      {
        organizationId: orgId,
        resourceId,
        projectId: payload.projectId,
        assignedBy: actorId,
        quantityAllocated: payload.quantityAllocated,
        startDate: payload.startDate,
        endDate: payload.endDate,
        notes: payload.notes,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: payload.projectId,
        actorId,
        action: 'resource.assigned',
        entityType: 'resource_assignment',
        entityId: assignment.id,
        summary: `Allocated ${payload.quantityAllocated} ${resource.unit} of "${resource.name}" to [${project.project_code}]`,
      },
      client
    );

    return assignment;
  });
}

export async function updateResourceAssignment(orgId, assignmentId, actorId, payload) {
  return withTransaction(async (client) => {
    const existing = await resourceRepo.findAssignmentById(orgId, assignmentId, client);
    if (!existing) {
      throw AppError.notFound('Resource assignment not found.');
    }

    const allocated = Number(existing.quantity_allocated);
    const nextUsed = payload.quantityUsed ?? Number(existing.quantity_used);
    if (nextUsed > allocated) {
      throw AppError.badRequest(
        `Used quantity (${nextUsed}) cannot exceed allocated quantity (${allocated}).`
      );
    }

    // If returning an active allocation, restore unused quantity back to available stock
    if (payload.status === 'returned' && existing.status === 'active') {
      const resource = await resourceRepo.findResourceForUpdate(orgId, existing.resource_id, client);
      const returnable = Number((allocated - nextUsed).toFixed(2));
      const restoredAvail = Math.min(
        Number(resource.total_quantity),
        Number((Number(resource.available_quantity) + returnable).toFixed(2))
      );
      const nextResStatus = resourceRepo.computeResourceStatus(restoredAvail, resource.min_threshold);

      await resourceRepo.updateResource(
        orgId,
        existing.resource_id,
        { availableQuantity: restoredAvail },
        nextResStatus,
        client
      );
    }

    const updated = await resourceRepo.updateAssignment(orgId, assignmentId, payload, client);

    await logActivity(
      {
        organizationId: orgId,
        projectId: existing.project_id,
        actorId,
        action: 'resource.assignment_updated',
        entityType: 'resource_assignment',
        entityId: assignmentId,
        summary: `Updated resource assignment (used: ${updated.quantity_used}/${updated.quantity_allocated}, status: ${updated.status})`,
      },
      client
    );

    return updated;
  });
}
