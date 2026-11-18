import { withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as riskRepo from './risks.repository.js';

export async function listRisks(orgId, filters) {
  return riskRepo.listRisks(orgId, filters);
}

export async function createRisk(orgId, actorId, payload) {
  return withTransaction(async (client) => {
    const projectRes = await client.query(
      `SELECT id, project_code, name, manager_id FROM projects WHERE organization_id = $1 AND id = $2`,
      [orgId, payload.projectId]
    );
    const project = projectRes.rows[0];
    if (!project) {
      throw AppError.notFound('Project not found.');
    }

    const risk = await riskRepo.createRisk(orgId, actorId, payload, client);

    await logActivity(
      {
        organizationId: orgId,
        projectId: payload.projectId,
        actorId,
        action: 'risk.created',
        entityType: 'risk',
        entityId: risk.id,
        summary: `Logged risk "${risk.title}" (severity: ${risk.severity} — ${risk.severity_level})`,
        metadata: { probability: risk.probability, impact: risk.impact, severity: risk.severity },
      },
      client
    );

    const recipients = new Set();
    if (payload.ownerId && payload.ownerId !== actorId) recipients.add(payload.ownerId);
    if (risk.severity >= 15 && project.manager_id && project.manager_id !== actorId) {
      recipients.add(project.manager_id);
    }

    for (const recipientId of recipients) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId,
          type: risk.severity >= 15 ? 'risk_critical' : 'risk_assigned',
          title: risk.severity >= 15 ? 'Critical Project Risk Identified' : 'Project Risk Assigned',
          message: `Risk "${risk.title}" (score ${risk.severity}/25) logged on [${project.project_code}] ${project.name}.`,
          entityType: 'risk',
          entityId: risk.id,
        },
        client
      );
    }

    return risk;
  });
}

export async function updateRisk(orgId, riskId, actorId, payload) {
  return withTransaction(async (client) => {
    const updated = await riskRepo.updateRisk(orgId, riskId, payload, client);
    if (!updated) {
      throw AppError.notFound('Risk not found.');
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId: updated.project_id,
        actorId,
        action: 'risk.updated',
        entityType: 'risk',
        entityId: riskId,
        summary: `Updated risk "${updated.title}" (status: ${updated.status}, severity: ${updated.severity})`,
      },
      client
    );

    return updated;
  });
}

export async function deleteRisk(orgId, riskId, actorId) {
  return withTransaction(async (client) => {
    const deleted = await riskRepo.deleteRisk(orgId, riskId, client);
    if (!deleted) {
      throw AppError.notFound('Risk not found.');
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId: deleted.project_id,
        actorId,
        action: 'risk.deleted',
        entityType: 'risk',
        entityId: riskId,
        summary: `Removed risk "${deleted.title}"`,
      },
      client
    );

    return { deletedRiskId: riskId };
  });
}

export async function listIssues(orgId, filters) {
  return riskRepo.listIssues(orgId, filters);
}

export async function createIssue(orgId, actorId, payload) {
  return withTransaction(async (client) => {
    const projectRes = await client.query(
      `SELECT id, project_code, name, manager_id FROM projects WHERE organization_id = $1 AND id = $2`,
      [orgId, payload.projectId]
    );
    const project = projectRes.rows[0];
    if (!project) {
      throw AppError.notFound('Project not found.');
    }

    const issue = await riskRepo.createIssue(orgId, actorId, payload, client);

    await logActivity(
      {
        organizationId: orgId,
        projectId: payload.projectId,
        actorId,
        action: 'issue.reported',
        entityType: 'issue',
        entityId: issue.id,
        summary: `Reported ${issue.severity} issue "${issue.title}"`,
      },
      client
    );

    const recipients = new Set();
    if (payload.assignedTo && payload.assignedTo !== actorId) recipients.add(payload.assignedTo);
    if (
      (issue.severity === 'high' || issue.severity === 'critical') &&
      project.manager_id &&
      project.manager_id !== actorId
    ) {
      recipients.add(project.manager_id);
    }

    for (const recipientId of recipients) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId,
          type: 'issue_reported',
          title: `${issue.severity.toUpperCase()} Blocker / Issue Reported`,
          message: `Issue "${issue.title}" reported on [${project.project_code}] ${project.name}.`,
          entityType: 'issue',
          entityId: issue.id,
        },
        client
      );
    }

    return issue;
  });
}

export async function updateIssue(orgId, issueId, actorId, payload) {
  return withTransaction(async (client) => {
    const existing = await riskRepo.findIssueById(orgId, issueId, client);
    if (!existing) {
      throw AppError.notFound('Issue not found.');
    }

    const updateData = { ...payload };
    if (
      (updateData.status === 'resolved' || updateData.status === 'closed') &&
      existing.status !== 'resolved' &&
      existing.status !== 'closed'
    ) {
      updateData.resolvedAt = new Date();
    } else if (updateData.status === 'open' || updateData.status === 'investigating') {
      updateData.resolvedAt = null;
    }

    const updated = await riskRepo.updateIssue(orgId, issueId, updateData, client);

    await logActivity(
      {
        organizationId: orgId,
        projectId: existing.project_id,
        actorId,
        action: 'issue.updated',
        entityType: 'issue',
        entityId: issueId,
        summary: `Updated issue "${updated.title}" (${existing.status} → ${updated.status})`,
      },
      client
    );

    return updated;
  });
}
