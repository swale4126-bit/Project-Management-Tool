import { query } from '../../config/db.js';

export function classifyRiskSeverity(score) {
  const s = Number(score);
  if (s >= 15) return 'critical';
  if (s >= 10) return 'high';
  if (s >= 5) return 'medium';
  return 'low';
}

export async function listRisks(orgId, { projectId, status, minSeverity } = {}) {
  const conditions = ['r.organization_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (projectId) {
    conditions.push(`r.project_id = $${idx++}`);
    params.push(projectId);
  }
  if (status) {
    conditions.push(`r.status = $${idx++}`);
    params.push(status);
  }
  if (minSeverity !== undefined) {
    conditions.push(`r.severity >= $${idx++}`);
    params.push(minSeverity);
  }

  const { rows } = await query(
    `SELECT r.*,
            p.project_code,
            p.name AS project_name,
            owner_u.full_name AS owner_name,
            creator_u.full_name AS created_by_name
     FROM risks r
     INNER JOIN projects p ON p.id = r.project_id
     INNER JOIN users creator_u ON creator_u.id = r.created_by
     LEFT JOIN users owner_u ON owner_u.id = r.owner_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.severity DESC, r.review_date ASC NULLS LAST, r.created_at DESC`,
    params
  );

  return rows.map((row) => ({
    ...row,
    severity_level: classifyRiskSeverity(row.severity),
  }));
}

export async function createRisk(orgId, createdBy, payload, dbClient) {
  const { rows } = await dbClient.query(
    `INSERT INTO risks (
       organization_id, project_id, owner_id, created_by, title, description,
       probability, impact, mitigation_plan, review_date, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      orgId,
      payload.projectId,
      payload.ownerId || null,
      createdBy,
      payload.title,
      payload.description,
      payload.probability,
      payload.impact,
      payload.mitigationPlan || null,
      payload.reviewDate || null,
      payload.status || 'identified',
    ]
  );
  return {
    ...rows[0],
    severity_level: classifyRiskSeverity(rows[0].severity),
  };
}

export async function updateRisk(orgId, riskId, payload, dbClient) {
  const mapping = {
    ownerId: 'owner_id',
    title: 'title',
    description: 'description',
    probability: 'probability',
    impact: 'impact',
    mitigationPlan: 'mitigation_plan',
    reviewDate: 'review_date',
    status: 'status',
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

  values.push(orgId, riskId);
  const { rows } = await dbClient.query(
    `UPDATE risks
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    severity_level: classifyRiskSeverity(rows[0].severity),
  };
}

export async function deleteRisk(orgId, riskId, dbClient) {
  const { rows } = await dbClient.query(
    `DELETE FROM risks WHERE organization_id = $1 AND id = $2 RETURNING id, project_id, title`,
    [orgId, riskId]
  );
  return rows[0] || null;
}

export async function listIssues(orgId, { projectId, status, severity, assignedTo } = {}) {
  const conditions = ['i.organization_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (projectId) {
    conditions.push(`i.project_id = $${idx++}`);
    params.push(projectId);
  }
  if (status) {
    conditions.push(`i.status = $${idx++}`);
    params.push(status);
  }
  if (severity) {
    conditions.push(`i.severity = $${idx++}`);
    params.push(severity);
  }
  if (assignedTo) {
    conditions.push(`i.assigned_to = $${idx++}`);
    params.push(assignedTo);
  }

  const { rows } = await query(
    `SELECT i.*,
            p.project_code,
            p.name AS project_name,
            t.title AS task_title,
            rep.full_name AS reported_by_name,
            ass.full_name AS assigned_to_name
     FROM issues i
     INNER JOIN projects p ON p.id = i.project_id
     INNER JOIN users rep ON rep.id = i.reported_by
     LEFT JOIN tasks t ON t.id = i.task_id
     LEFT JOIN users ass ON ass.id = i.assigned_to
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       i.created_at DESC`,
    params
  );

  return rows;
}

export async function findIssueById(orgId, issueId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT * FROM issues WHERE organization_id = $1 AND id = $2`,
    [orgId, issueId]
  );
  return rows[0] || null;
}

export async function createIssue(orgId, reportedBy, payload, dbClient) {
  const { rows } = await dbClient.query(
    `INSERT INTO issues (
       organization_id, project_id, task_id, reported_by, assigned_to, title, description, severity
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      orgId,
      payload.projectId,
      payload.taskId || null,
      reportedBy,
      payload.assignedTo || null,
      payload.title,
      payload.description,
      payload.severity || 'medium',
    ]
  );
  return rows[0];
}

export async function updateIssue(orgId, issueId, payload, dbClient) {
  const mapping = {
    assignedTo: 'assigned_to',
    title: 'title',
    description: 'description',
    severity: 'severity',
    status: 'status',
    resolutionNotes: 'resolution_notes',
    resolvedAt: 'resolved_at',
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

  values.push(orgId, issueId);
  const { rows } = await dbClient.query(
    `UPDATE issues
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}
