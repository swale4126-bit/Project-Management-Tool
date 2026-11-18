import { withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as milestoneRepo from './milestones.repository.js';

export async function listMilestones(orgId, projectId = null) {
  const rows = await milestoneRepo.listMilestones(orgId, projectId);
  return rows.map((row) => ({
    ...row,
    completion_percent:
      row.total_tasks > 0
        ? Math.round((row.completed_tasks / row.total_tasks) * 100)
        : row.status === 'completed'
          ? 100
          : 0,
  }));
}

export async function createMilestone(orgId, actorId, payload) {
  return withTransaction(async (client) => {
    const projectRes = await client.query(
      `SELECT id, name FROM projects WHERE organization_id = $1 AND id = $2`,
      [orgId, payload.projectId]
    );
    if (!projectRes.rows[0]) {
      throw AppError.notFound('Project not found in this organization.');
    }

    const created = await milestoneRepo.createMilestone(orgId, payload, client);

    await logActivity(
      {
        organizationId: orgId,
        projectId: payload.projectId,
        actorId,
        action: 'milestone.created',
        entityType: 'milestone',
        entityId: created.id,
        summary: `Created milestone "${created.title}" (target: ${payload.targetDate})`,
      },
      client
    );

    if (payload.ownerId && payload.ownerId !== actorId) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: payload.ownerId,
          type: 'milestone_assigned',
          title: 'Milestone Ownership Assigned',
          message: `You were assigned owner of milestone "${created.title}" (target ${payload.targetDate}).`,
          entityType: 'milestone',
          entityId: created.id,
        },
        client
      );
    }

    return created;
  });
}

export async function updateMilestone(orgId, milestoneId, actorId, payload) {
  return withTransaction(async (client) => {
    const existing = await milestoneRepo.findMilestoneById(orgId, milestoneId, client);
    if (!existing) {
      throw AppError.notFound('Milestone not found.');
    }

    const updateData = { ...payload };
    if (updateData.status === 'completed' && existing.status !== 'completed') {
      updateData.completedAt = new Date();
    } else if (updateData.status && updateData.status !== 'completed' && existing.status === 'completed') {
      updateData.completedAt = null;
    }

    const updated = await milestoneRepo.updateMilestone(orgId, milestoneId, updateData, client);

    await logActivity(
      {
        organizationId: orgId,
        projectId: existing.project_id,
        actorId,
        action: 'milestone.updated',
        entityType: 'milestone',
        entityId: milestoneId,
        summary: `Updated milestone "${updated.title}" (status: ${updated.status})`,
      },
      client
    );

    return updated;
  });
}

export async function deleteMilestone(orgId, milestoneId, actorId) {
  return withTransaction(async (client) => {
    const deleted = await milestoneRepo.deleteMilestone(orgId, milestoneId, client);
    if (!deleted) {
      throw AppError.notFound('Milestone not found.');
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId: deleted.project_id,
        actorId,
        action: 'milestone.deleted',
        entityType: 'milestone',
        entityId: milestoneId,
        summary: `Deleted milestone "${deleted.title}"`,
      },
      client
    );

    return { deletedMilestoneId: milestoneId };
  });
}

export async function getProjectTimeline(orgId, projectId) {
  const timeline = await milestoneRepo.getProjectTimeline(orgId, projectId);
  if (!timeline) {
    throw AppError.notFound('Project not found.');
  }
  return timeline;
}
