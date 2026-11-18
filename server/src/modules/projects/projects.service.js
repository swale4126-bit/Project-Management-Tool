import { withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { calculateUtilizationPct, subtractMoney } from '../../utils/money.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as orgRepo from '../organizations/organizations.repository.js';
import * as projectRepo from './projects.repository.js';

function formatProjectSummary(row) {
  const totalTasks = Number(row.total_tasks || 0);
  const completedTasks = Number(row.completed_tasks || 0);
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const plannedBudget = String(row.planned_budget ?? '0.00');
  const approvedSpend = String(row.approved_spend ?? '0.00');

  return {
    id: row.id,
    organizationId: row.organization_id,
    projectCode: row.project_code,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    managerId: row.manager_id,
    managerName: row.manager_name || null,
    locationName: row.location_name,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    startDate: row.start_date,
    expectedEndDate: row.expected_end_date,
    actualCompletionDate: row.actual_completion_date,
    objectives: row.objectives,
    successIndicators: row.success_indicators,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metrics: {
      completionPercent,
      totalTasks,
      completedTasks,
      blockedTasks: Number(row.blocked_tasks || 0),
      overdueTasks: Number(row.overdue_tasks || 0),
      teamSize: Number(row.team_size || 0),
      totalMilestones: Number(row.total_milestones || 0),
      completedMilestones: Number(row.completed_milestones || 0),
      openRisks: Number(row.open_risks || 0),
      highRisks: Number(row.high_risks || 0),
      pendingFieldReports: Number(row.pending_field_reports || 0),
      approvedFieldReports: Number(row.approved_field_reports || 0),
      plannedBudget,
      approvedSpend,
      pendingSpend: String(row.pending_spend ?? '0.00'),
      remainingBudget: subtractMoney(plannedBudget, approvedSpend),
      budgetUtilizationPct: calculateUtilizationPct(approvedSpend, plannedBudget),
    },
  };
}

export async function listProjects(orgId, queryOptions, userContext) {
  const { rows, total } = await projectRepo.listProjects(orgId, queryOptions, userContext);
  return {
    items: rows.map(formatProjectSummary),
    total,
  };
}

export async function getProjectById(orgId, projectId) {
  const row = await projectRepo.findProjectDetailsById(orgId, projectId);
  if (!row) {
    throw AppError.notFound('Project not found.');
  }
  return formatProjectSummary(row);
}

export async function createProject(orgId, actorId, currencyCode, payload) {
  return withTransaction(async (client) => {
    const managerId = payload.managerId || actorId;

    const managerMembership = await orgRepo.findMemberByUserId(orgId, managerId, client);
    if (!managerMembership || managerMembership.status !== 'active') {
      throw AppError.badRequest(
        'Selected project manager must be an active member of this organization.',
        'INVALID_PROJECT_MANAGER'
      );
    }

    const created = await projectRepo.createProject(orgId, actorId, { ...payload, managerId }, client);

    // Automatically add manager (and creator if different) to project_members
    await projectRepo.upsertProjectMember(
      {
        organizationId: orgId,
        projectId: created.id,
        userId: managerId,
        projectRole: 'manager',
      },
      client
    );
    if (actorId !== managerId) {
      await projectRepo.upsertProjectMember(
        {
          organizationId: orgId,
          projectId: created.id,
          userId: actorId,
          projectRole: 'manager',
        },
        client
      );
    }

    // Create initial budget record if provided
    if (payload.initialBudget !== undefined) {
      await client.query(
        `INSERT INTO budgets (organization_id, project_id, planned_amount, contingency_amount, currency_code, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orgId,
          created.id,
          payload.initialBudget,
          payload.contingencyAmount || 0,
          currencyCode || 'USD',
          actorId,
        ]
      );
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId: created.id,
        actorId,
        action: 'project.created',
        entityType: 'project',
        entityId: created.id,
        summary: `Created project [${created.project_code}] "${created.name}"`,
        metadata: { status: created.status, priority: created.priority },
      },
      client
    );

    if (managerId !== actorId) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: managerId,
          type: 'project_assigned',
          title: 'Assigned as Project Manager',
          message: `You were assigned as manager for [${created.project_code}] ${created.name}.`,
          entityType: 'project',
          entityId: created.id,
        },
        client
      );
    }

    return created;
  });
}

export async function updateProject(orgId, projectId, actorId, payload) {
  return withTransaction(async (client) => {
    if (payload.managerId) {
      const managerMembership = await orgRepo.findMemberByUserId(orgId, payload.managerId, client);
      if (!managerMembership || managerMembership.status !== 'active') {
        throw AppError.badRequest(
          'Selected project manager must be an active member of this organization.'
        );
      }
    }

    const updated = await projectRepo.updateProject(orgId, projectId, payload, client);
    if (!updated) {
      throw AppError.notFound('Project not found.');
    }

    if (payload.managerId) {
      await projectRepo.upsertProjectMember(
        {
          organizationId: orgId,
          projectId,
          userId: payload.managerId,
          projectRole: 'manager',
        },
        client
      );
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId,
        actorId,
        action: 'project.updated',
        entityType: 'project',
        entityId: projectId,
        summary: `Updated project [${updated.project_code}] "${updated.name}"`,
        metadata: { updatedFields: Object.keys(payload), status: updated.status },
      },
      client
    );

    return updated;
  });
}

export async function archiveProject(orgId, projectId, actorId, isArchived) {
  return withTransaction(async (client) => {
    const updated = await projectRepo.setProjectArchived(orgId, projectId, isArchived, client);
    if (!updated) {
      throw AppError.notFound('Project not found.');
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId,
        actorId,
        action: isArchived ? 'project.archived' : 'project.restored',
        entityType: 'project',
        entityId: projectId,
        summary: `${isArchived ? 'Archived' : 'Restored'} project [${updated.project_code}] "${updated.name}"`,
      },
      client
    );

    return updated;
  });
}

export async function listProjectMembers(orgId, projectId) {
  return projectRepo.listProjectMembers(orgId, projectId);
}

export async function addProjectMember(orgId, projectId, actorId, payload) {
  return withTransaction(async (client) => {
    // Enforce org isolation: target user MUST belong to the same organization
    const orgMembership = await orgRepo.findMemberByUserId(orgId, payload.userId, client);
    if (!orgMembership || orgMembership.status !== 'active') {
      throw AppError.badRequest(
        'User must be an active member of this organization before being assigned to a project.',
        'USER_NOT_IN_ORGANIZATION'
      );
    }

    const member = await projectRepo.upsertProjectMember(
      {
        organizationId: orgId,
        projectId,
        userId: payload.userId,
        projectRole: payload.projectRole,
        weeklyCapacityHours: payload.weeklyCapacityHours,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId,
        actorId,
        action: 'project.member_assigned',
        entityType: 'project_member',
        entityId: member.id,
        summary: `Assigned team member to project as ${payload.projectRole}`,
        metadata: { userId: payload.userId, projectRole: payload.projectRole },
      },
      client
    );

    if (payload.userId !== actorId) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: payload.userId,
          type: 'project_assigned',
          title: 'Added to Project Team',
          message: `You have been assigned to a project with role: ${payload.projectRole}.`,
          entityType: 'project',
          entityId: projectId,
        },
        client
      );
    }

    return member;
  });
}

export async function removeProjectMember(orgId, projectId, targetUserId, actorId) {
  return withTransaction(async (client) => {
    const removed = await projectRepo.removeProjectMember(orgId, projectId, targetUserId, client);
    if (!removed) {
      throw AppError.notFound('Project team member not found.');
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId,
        actorId,
        action: 'project.member_removed',
        entityType: 'project_member',
        entityId: removed.id,
        summary: `Removed team member from project`,
        metadata: { removedUserId: targetUserId },
      },
      client
    );

    return { removedUserId: targetUserId };
  });
}

export async function listProjectDocuments(orgId, projectId) {
  return projectRepo.listProjectDocuments(orgId, projectId);
}

export async function uploadProjectDocument(orgId, projectId, actorId, { title, category }, file) {
  if (!file) {
    throw AppError.badRequest('A document file is required.', 'FILE_REQUIRED');
  }

  return withTransaction(async (client) => {
    const doc = await projectRepo.createProjectDocument(
      {
        organizationId: orgId,
        projectId,
        uploadedBy: actorId,
        title,
        category,
        originalName: file.originalname,
        storedFilename: file.filename,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId,
        actorId,
        action: 'document.uploaded',
        entityType: 'document',
        entityId: doc.id,
        summary: `Uploaded project document "${doc.title}" (${doc.original_name})`,
        metadata: { category: doc.category, mimeType: doc.mime_type },
      },
      client
    );

    return doc;
  });
}

export async function getDocumentForDownload(orgId, documentId) {
  const doc = await projectRepo.findDocumentById(orgId, documentId);
  if (!doc) {
    throw AppError.notFound('Document not found in this organization.');
  }
  return doc;
}
