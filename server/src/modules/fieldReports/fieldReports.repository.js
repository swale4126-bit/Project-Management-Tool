import { query } from '../../config/db.js';

export async function listFieldReports(
  orgId,
  { projectId, taskId, submittedBy, status, fromDate, toDate, search, limit, offset },
  { userId, orgRole, isSuperAdmin }
) {
  const conditions = ['fr.organization_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (!isSuperAdmin && orgRole !== 'org_owner' && orgRole !== 'project_manager') {
    conditions.push(`EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = fr.project_id AND pm.user_id = $${idx++}
    )`);
    params.push(userId);
  }

  if (projectId) {
    conditions.push(`fr.project_id = $${idx++}`);
    params.push(projectId);
  }
  if (taskId) {
    conditions.push(`fr.task_id = $${idx++}`);
    params.push(taskId);
  }
  if (submittedBy) {
    conditions.push(`fr.submitted_by = $${idx++}`);
    params.push(submittedBy);
  }
  if (status) {
    conditions.push(`fr.status = $${idx++}`);
    params.push(status);
  }
  if (fromDate) {
    conditions.push(`fr.activity_date >= $${idx++}`);
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push(`fr.activity_date <= $${idx++}`);
    params.push(toDate);
  }
  if (search) {
    conditions.push(
      `(fr.title ILIKE $${idx} OR fr.location_name ILIKE $${idx} OR fr.work_completed ILIKE $${idx})`
    );
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = conditions.join(' AND ');
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM field_reports fr WHERE ${whereClause}`,
    params
  );
  const total = countRes.rows[0].total;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT fr.*,
            p.project_code,
            p.name AS project_name,
            t.title AS task_title,
            sub.full_name AS submitted_by_name,
            rev.full_name AS reviewed_by_name
     FROM field_reports fr
     INNER JOIN projects p ON p.id = fr.project_id
     INNER JOIN users sub ON sub.id = fr.submitted_by
     LEFT JOIN tasks t ON t.id = fr.task_id
     LEFT JOIN users rev ON rev.id = fr.reviewed_by
     WHERE ${whereClause}
     ORDER BY fr.activity_date DESC, fr.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  return { rows, total };
}

export async function findFieldReportBasic(orgId, reportId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT fr.*, p.manager_id AS project_manager_id, p.name AS project_name, p.project_code
     FROM field_reports fr
     INNER JOIN projects p ON p.id = fr.project_id
     WHERE fr.organization_id = $1 AND fr.id = $2`,
    [orgId, reportId]
  );
  return rows[0] || null;
}

export async function findFieldReportDetails(orgId, reportId) {
  const { rows } = await query(
    `SELECT fr.*,
            p.project_code,
            p.name AS project_name,
            t.title AS task_title,
            sub.full_name AS submitted_by_name,
            sub.email AS submitted_by_email,
            rev.full_name AS reviewed_by_name
     FROM field_reports fr
     INNER JOIN projects p ON p.id = fr.project_id
     INNER JOIN users sub ON sub.id = fr.submitted_by
     LEFT JOIN tasks t ON t.id = fr.task_id
     LEFT JOIN users rev ON rev.id = fr.reviewed_by
     WHERE fr.organization_id = $1 AND fr.id = $2`,
    [orgId, reportId]
  );
  const report = rows[0];
  if (!report) return null;

  const reviewsRes = await query(
    `SELECT r.id, r.previous_status, r.new_status, r.review_notes, r.reviewed_at,
            u.id AS reviewer_id, u.full_name AS reviewer_name, u.job_title AS reviewer_title
     FROM field_report_reviews r
     INNER JOIN users u ON u.id = r.reviewer_id
     WHERE r.field_report_id = $1
     ORDER BY r.reviewed_at DESC`,
    [reportId]
  );

  return {
    ...report,
    reviewHistory: reviewsRes.rows,
  };
}

export async function createFieldReport(orgId, submittedBy, payload, file, dbClient) {
  const status = payload.submitNow ? 'submitted' : 'draft';
  const { rows } = await dbClient.query(
    `INSERT INTO field_reports (
       organization_id, project_id, task_id, submitted_by, title, activity_date, location_name,
       work_completed, challenges_blockers, resources_used_summary, progress_contribution_pct,
       evidence_file_name, evidence_stored_path, evidence_mime_type, status, submitted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      orgId,
      payload.projectId,
      payload.taskId || null,
      submittedBy,
      payload.title,
      payload.activityDate,
      payload.locationName,
      payload.workCompleted,
      payload.challengesBlockers || null,
      payload.resourcesUsedSummary || null,
      payload.progressContributionPct ?? 0,
      file?.originalname || null,
      file?.filename || null,
      file?.mimetype || null,
      status,
      payload.submitNow ? new Date() : null,
    ]
  );
  return rows[0];
}

export async function updateFieldReport(orgId, reportId, payload, file, dbClient) {
  const mapping = {
    taskId: 'task_id',
    title: 'title',
    activityDate: 'activity_date',
    locationName: 'location_name',
    workCompleted: 'work_completed',
    challengesBlockers: 'challenges_blockers',
    resourcesUsedSummary: 'resources_used_summary',
    progressContributionPct: 'progress_contribution_pct',
  };

  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, col] of Object.entries(mapping)) {
    if (payload[key] !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(payload[key]);
    }
  }

  if (file) {
    fields.push(`evidence_file_name = $${idx++}`);
    values.push(file.originalname);
    fields.push(`evidence_stored_path = $${idx++}`);
    values.push(file.filename);
    fields.push(`evidence_mime_type = $${idx++}`);
    values.push(file.mimetype);
  }

  values.push(orgId, reportId);
  const { rows } = await dbClient.query(
    `UPDATE field_reports
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function updateFieldReportStatus(
  orgId,
  reportId,
  { status, submittedAt, reviewedBy, reviewedAt },
  dbClient
) {
  const fields = ['status = $1'];
  const values = [status];
  let idx = 2;

  if (submittedAt !== undefined) {
    fields.push(`submitted_at = $${idx++}`);
    values.push(submittedAt);
  }
  if (reviewedBy !== undefined) {
    fields.push(`reviewed_by = $${idx++}`);
    values.push(reviewedBy);
  }
  if (reviewedAt !== undefined) {
    fields.push(`reviewed_at = $${idx++}`);
    values.push(reviewedAt);
  }

  values.push(orgId, reportId);
  const { rows } = await dbClient.query(
    `UPDATE field_reports
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function insertReviewRecord(
  { organizationId, fieldReportId, reviewerId, previousStatus, newStatus, reviewNotes },
  dbClient
) {
  const { rows } = await dbClient.query(
    `INSERT INTO field_report_reviews
       (organization_id, field_report_id, reviewer_id, previous_status, new_status, review_notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [organizationId, fieldReportId, reviewerId, previousStatus, newStatus, reviewNotes || null]
  );
  return rows[0];
}
