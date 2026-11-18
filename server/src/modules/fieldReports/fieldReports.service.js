import { withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as reportRepo from './fieldReports.repository.js';

const ALLOWED_REVIEW_TRANSITIONS = {
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
};

export function canTransitionFieldReport(currentStatus, targetStatus) {
  if (targetStatus === 'submitted') {
    return currentStatus === 'draft' || currentStatus === 'rejected';
  }
  return (ALLOWED_REVIEW_TRANSITIONS[currentStatus] || []).includes(targetStatus);
}

export async function listFieldReports(orgId, filters, userContext) {
  const { rows, total } = await reportRepo.listFieldReports(orgId, filters, userContext);
  return { items: rows, total };
}

export async function getFieldReportById(orgId, reportId) {
  const report = await reportRepo.findFieldReportDetails(orgId, reportId);
  if (!report) {
    throw AppError.notFound('Field report not found.');
  }
  return report;
}

export async function createFieldReport(orgId, actorId, payload, file) {
  return withTransaction(async (client) => {
    const projectRes = await client.query(
      `SELECT id, name, project_code, manager_id
       FROM projects
       WHERE organization_id = $1 AND id = $2`,
      [orgId, payload.projectId]
    );
    const project = projectRes.rows[0];
    if (!project) {
      throw AppError.notFound('Project not found in this organization.');
    }

    if (payload.taskId) {
      const taskRes = await client.query(
        `SELECT id FROM tasks WHERE organization_id = $1 AND project_id = $2 AND id = $3`,
        [orgId, payload.projectId, payload.taskId]
      );
      if (!taskRes.rows[0]) {
        throw AppError.badRequest('Selected task does not belong to this project.');
      }
    }

    const created = await reportRepo.createFieldReport(orgId, actorId, payload, file, client);

    if (payload.submitNow) {
      await reportRepo.insertReviewRecord(
        {
          organizationId: orgId,
          fieldReportId: created.id,
          reviewerId: actorId,
          previousStatus: 'draft',
          newStatus: 'submitted',
          reviewNotes: 'Submitted directly upon creation.',
        },
        client
      );

      if (project.manager_id && project.manager_id !== actorId) {
        await createNotification(
          {
            organizationId: orgId,
            recipientId: project.manager_id,
            type: 'report_submitted',
            title: 'Field Report Awaiting Review',
            message: `New field report "${created.title}" submitted for [${project.project_code}] ${project.name}.`,
            entityType: 'field_report',
            entityId: created.id,
          },
          client
        );
      }
    }

    await logActivity(
      {
        organizationId: orgId,
        projectId: payload.projectId,
        actorId,
        action: payload.submitNow ? 'field_report.submitted' : 'field_report.draft_created',
        entityType: 'field_report',
        entityId: created.id,
        summary: `${payload.submitNow ? 'Submitted' : 'Saved draft'} field report "${created.title}"`,
        metadata: { status: created.status, location: created.location_name },
      },
      client
    );

    return created;
  });
}

export async function updateFieldReport(orgId, reportId, actor, payload, file) {
  return withTransaction(async (client) => {
    const existing = await reportRepo.findFieldReportBasic(orgId, reportId, client);
    if (!existing) {
      throw AppError.notFound('Field report not found.');
    }

    const isAuthor = existing.submitted_by === actor.id;
    const isAdminOrOwner = actor.isSuperAdmin || actor.orgRole === 'org_owner';
    if (!isAuthor && !isAdminOrOwner) {
      throw AppError.forbidden('Only the report author or Organization Owner can edit this draft.');
    }

    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw AppError.conflict(
        `Cannot edit a field report while its status is "${existing.status}".`,
        'REPORT_LOCKED'
      );
    }

    const updated = await reportRepo.updateFieldReport(orgId, reportId, payload, file, client);

    await logActivity(
      {
        organizationId: orgId,
        projectId: existing.project_id,
        actorId: actor.id,
        action: 'field_report.updated',
        entityType: 'field_report',
        entityId: reportId,
        summary: `Updated field report "${updated.title}"`,
      },
      client
    );

    return updated;
  });
}

export async function submitFieldReport(orgId, reportId, actorId) {
  return withTransaction(async (client) => {
    const existing = await reportRepo.findFieldReportBasic(orgId, reportId, client);
    if (!existing) {
      throw AppError.notFound('Field report not found.');
    }
    if (existing.submitted_by !== actorId) {
      throw AppError.forbidden('Only the report author can submit this field report.');
    }
    if (!canTransitionFieldReport(existing.status, 'submitted')) {
      throw AppError.conflict(
        `Cannot submit a field report from status "${existing.status}".`,
        'INVALID_WORKFLOW_TRANSITION'
      );
    }

    const updated = await reportRepo.updateFieldReportStatus(
      orgId,
      reportId,
      { status: 'submitted', submittedAt: new Date() },
      client
    );

    await reportRepo.insertReviewRecord(
      {
        organizationId: orgId,
        fieldReportId: reportId,
        reviewerId: actorId,
        previousStatus: existing.status,
        newStatus: 'submitted',
        reviewNotes:
          existing.status === 'rejected'
            ? 'Revised and resubmitted for review.'
            : 'Submitted for manager review.',
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: existing.project_id,
        actorId,
        action: 'field_report.submitted',
        entityType: 'field_report',
        entityId: reportId,
        summary: `Submitted field report "${existing.title}" for review`,
      },
      client
    );

    if (existing.project_manager_id && existing.project_manager_id !== actorId) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: existing.project_manager_id,
          type: 'report_submitted',
          title: 'Field Report Submitted',
          message: `Field report "${existing.title}" in [${existing.project_code}] is awaiting review.`,
          entityType: 'field_report',
          entityId: reportId,
        },
        client
      );
    }

    return updated;
  });
}

export async function reviewFieldReport(orgId, reportId, reviewerId, { decision, reviewNotes }) {
  return withTransaction(async (client) => {
    const existing = await reportRepo.findFieldReportBasic(orgId, reportId, client);
    if (!existing) {
      throw AppError.notFound('Field report not found.');
    }

    if (!canTransitionFieldReport(existing.status, decision)) {
      throw AppError.conflict(
        `Invalid workflow transition from "${existing.status}" to "${decision}".`,
        'INVALID_WORKFLOW_TRANSITION'
      );
    }

    const updated = await reportRepo.updateFieldReportStatus(
      orgId,
      reportId,
      {
        status: decision,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
      client
    );

    const reviewRecord = await reportRepo.insertReviewRecord(
      {
        organizationId: orgId,
        fieldReportId: reportId,
        reviewerId,
        previousStatus: existing.status,
        newStatus: decision,
        reviewNotes: reviewNotes || null,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: existing.project_id,
        actorId: reviewerId,
        action: `field_report.${decision}`,
        entityType: 'field_report',
        entityId: reportId,
        summary: `Marked field report "${existing.title}" as ${decision}`,
        metadata: { previousStatus: existing.status, newStatus: decision },
      },
      client
    );

    if (existing.submitted_by !== reviewerId) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: existing.submitted_by,
          type: 'report_reviewed',
          title: `Field Report ${decision.replace('_', ' ')}`,
          message: `Your field report "${existing.title}" was updated to "${decision}".${reviewNotes ? ` Note: ${reviewNotes}` : ''}`,
          entityType: 'field_report',
          entityId: reportId,
        },
        client
      );
    }

    return { report: updated, review: reviewRecord };
  });
}
