import { query } from '../../config/db.js';

const SORT_COLUMNS = {
  created_at: 'p.created_at',
  name: 'p.name',
  expected_end_date: 'p.expected_end_date',
  status: 'p.status',
  priority: 'p.priority',
};

export async function listProjects(
  orgId,
  { status, priority, managerId, archived = false, search, sortBy = 'created_at', sortOrder = 'desc', limit, offset },
  { userId, orgRole, isSuperAdmin }
) {
  const conditions = ['p.organization_id = $1', 'p.is_archived = $2'];
  const params = [orgId, archived];
  let idx = 3;

  // Non-owners and non-PMs only see projects they are assigned to
  if (!isSuperAdmin && orgRole !== 'org_owner' && orgRole !== 'project_manager') {
    conditions.push(`EXISTS (
      SELECT 1 FROM project_members pm_access
      WHERE pm_access.project_id = p.id AND pm_access.user_id = $${idx++}
    )`);
    params.push(userId);
  }

  if (status) {
    conditions.push(`p.status = $${idx++}`);
    params.push(status);
  }
  if (priority) {
    conditions.push(`p.priority = $${idx++}`);
    params.push(priority);
  }
  if (managerId) {
    conditions.push(`p.manager_id = $${idx++}`);
    params.push(managerId);
  }
  if (search) {
    conditions.push(`(p.name ILIKE $${idx} OR p.project_code ILIKE $${idx} OR COALESCE(p.location_name, '') ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = conditions.join(' AND ');
  const orderCol = SORT_COLUMNS[sortBy] || 'p.created_at';
  const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countRes = await query(`SELECT COUNT(*)::int AS total FROM projects p WHERE ${whereClause}`, params);
  const total = countRes.rows[0].total;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT p.*,
            mgr.full_name AS manager_name,
            mgr.email AS manager_email,
            COALESCE(t_stats.total_tasks, 0)::int AS total_tasks,
            COALESCE(t_stats.completed_tasks, 0)::int AS completed_tasks,
            COALESCE(t_stats.overdue_tasks, 0)::int AS overdue_tasks,
            COALESCE(m_stats.team_size, 0)::int AS team_size,
            COALESCE(r_stats.open_risks, 0)::int AS open_risks,
            COALESCE(b.planned_amount, 0.00)::numeric(14,2) AS planned_budget,
            COALESCE(e_stats.approved_spend, 0.00)::numeric(14,2) AS approved_spend
     FROM projects p
     LEFT JOIN users mgr ON mgr.id = p.manager_id
     LEFT JOIN budgets b ON b.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
              COUNT(*) AS total_tasks,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
              COUNT(*) FILTER (WHERE status <> 'completed' AND due_date < CURRENT_DATE) AS overdue_tasks
       FROM tasks
       WHERE organization_id = $1
       GROUP BY project_id
     ) t_stats ON t_stats.project_id = p.id
     LEFT JOIN (
       SELECT project_id, COUNT(*) AS team_size
       FROM project_members
       WHERE organization_id = $1
       GROUP BY project_id
     ) m_stats ON m_stats.project_id = p.id
     LEFT JOIN (
       SELECT project_id, COUNT(*) AS open_risks
       FROM risks
       WHERE organization_id = $1 AND status NOT IN ('mitigated', 'closed')
       GROUP BY project_id
     ) r_stats ON r_stats.project_id = p.id
     LEFT JOIN (
       SELECT project_id, SUM(amount) AS approved_spend
       FROM expenses
       WHERE organization_id = $1 AND status = 'approved'
       GROUP BY project_id
     ) e_stats ON e_stats.project_id = p.id
     WHERE ${whereClause}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  return { rows, total };
}

export async function findProjectDetailsById(orgId, projectId) {
  const { rows } = await query(
    `SELECT p.*,
            mgr.full_name AS manager_name,
            mgr.email AS manager_email,
            COALESCE(t_stats.total_tasks, 0)::int AS total_tasks,
            COALESCE(t_stats.completed_tasks, 0)::int AS completed_tasks,
            COALESCE(t_stats.blocked_tasks, 0)::int AS blocked_tasks,
            COALESCE(t_stats.overdue_tasks, 0)::int AS overdue_tasks,
            COALESCE(m_stats.total_milestones, 0)::int AS total_milestones,
            COALESCE(m_stats.completed_milestones, 0)::int AS completed_milestones,
            COALESCE(r_stats.open_risks, 0)::int AS open_risks,
            COALESCE(r_stats.high_risks, 0)::int AS high_risks,
            COALESCE(fr_stats.pending_field_reports, 0)::int AS pending_field_reports,
            COALESCE(fr_stats.approved_field_reports, 0)::int AS approved_field_reports,
            COALESCE(b.planned_amount, 0.00)::numeric(14,2) AS planned_budget,
            COALESCE(b.contingency_amount, 0.00)::numeric(14,2) AS contingency_amount,
            COALESCE(e_stats.approved_spend, 0.00)::numeric(14,2) AS approved_spend,
            COALESCE(e_stats.pending_spend, 0.00)::numeric(14,2) AS pending_spend
     FROM projects p
     LEFT JOIN users mgr ON mgr.id = p.manager_id
     LEFT JOIN budgets b ON b.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
              COUNT(*) AS total_tasks,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
              COUNT(*) FILTER (WHERE status = 'blocked') AS blocked_tasks,
              COUNT(*) FILTER (WHERE status <> 'completed' AND due_date < CURRENT_DATE) AS overdue_tasks
       FROM tasks
       WHERE project_id = $2 AND organization_id = $1
       GROUP BY project_id
     ) t_stats ON t_stats.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
              COUNT(*) AS total_milestones,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed_milestones
       FROM project_milestones
       WHERE project_id = $2 AND organization_id = $1
       GROUP BY project_id
     ) m_stats ON m_stats.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
              COUNT(*) FILTER (WHERE status NOT IN ('mitigated', 'closed')) AS open_risks,
              COUNT(*) FILTER (WHERE status NOT IN ('mitigated', 'closed') AND severity >= 15) AS high_risks
       FROM risks
       WHERE project_id = $2 AND organization_id = $1
       GROUP BY project_id
     ) r_stats ON r_stats.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
              COUNT(*) FILTER (WHERE status IN ('submitted', 'under_review')) AS pending_field_reports,
              COUNT(*) FILTER (WHERE status = 'approved') AS approved_field_reports
       FROM field_reports
       WHERE project_id = $2 AND organization_id = $1
       GROUP BY project_id
     ) fr_stats ON fr_stats.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
              COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) AS approved_spend,
              COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_spend
       FROM expenses
       WHERE project_id = $2 AND organization_id = $1
       GROUP BY project_id
     ) e_stats ON e_stats.project_id = p.id
     WHERE p.organization_id = $1 AND p.id = $2`,
    [orgId, projectId]
  );

  return rows[0] || null;
}

export async function createProject(orgId, createdBy, payload, dbClient) {
  const { rows } = await dbClient.query(
    `INSERT INTO projects (
       organization_id, project_code, name, description, status, priority, manager_id,
       location_name, latitude, longitude, start_date, expected_end_date,
       objectives, success_indicators, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      orgId,
      payload.projectCode,
      payload.name,
      payload.description || null,
      payload.status || 'planning',
      payload.priority || 'medium',
      payload.managerId || createdBy,
      payload.locationName || null,
      payload.latitude ?? null,
      payload.longitude ?? null,
      payload.startDate,
      payload.expectedEndDate,
      payload.objectives || null,
      payload.successIndicators || null,
      createdBy,
    ]
  );
  return rows[0];
}

export async function updateProject(orgId, projectId, payload, dbClient) {
  const map = {
    name: 'name',
    description: 'description',
    status: 'status',
    priority: 'priority',
    managerId: 'manager_id',
    locationName: 'location_name',
    latitude: 'latitude',
    longitude: 'longitude',
    startDate: 'start_date',
    expectedEndDate: 'expected_end_date',
    actualCompletionDate: 'actual_completion_date',
    objectives: 'objectives',
    successIndicators: 'success_indicators',
  };

  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, col] of Object.entries(map)) {
    if (payload[key] !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(payload[key]);
    }
  }

  values.push(orgId, projectId);
  const { rows } = await dbClient.query(
    `UPDATE projects
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function setProjectArchived(orgId, projectId, isArchived, dbClient) {
  const { rows } = await dbClient.query(
    `UPDATE projects
     SET is_archived = $1
     WHERE organization_id = $2 AND id = $3
     RETURNING id, project_code, name, is_archived`,
    [isArchived, orgId, projectId]
  );
  return rows[0] || null;
}

export async function listProjectMembers(orgId, projectId) {
  const { rows } = await query(
    `SELECT pm.id, pm.project_id, pm.user_id, pm.project_role, pm.weekly_capacity_hours, pm.assigned_at,
            u.full_name, u.email, u.job_title, u.avatar_url,
            COALESCE(t_counts.assigned_tasks, 0)::int AS assigned_tasks,
            COALESCE(t_counts.active_tasks, 0)::int AS active_tasks
     FROM project_members pm
     INNER JOIN users u ON u.id = pm.user_id
     LEFT JOIN (
       SELECT ta.user_id,
              COUNT(*) AS assigned_tasks,
              COUNT(*) FILTER (WHERE t.status NOT IN ('completed')) AS active_tasks
       FROM task_assignees ta
       INNER JOIN tasks t ON t.id = ta.task_id
       WHERE t.project_id = $2 AND t.organization_id = $1
       GROUP BY ta.user_id
     ) t_counts ON t_counts.user_id = pm.user_id
     WHERE pm.organization_id = $1 AND pm.project_id = $2
     ORDER BY pm.project_role ASC, u.full_name ASC`,
    [orgId, projectId]
  );
  return rows;
}

export async function upsertProjectMember(
  { organizationId, projectId, userId, projectRole, weeklyCapacityHours = 40 },
  dbClient
) {
  const { rows } = await dbClient.query(
    `INSERT INTO project_members (organization_id, project_id, user_id, project_role, weekly_capacity_hours)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (project_id, user_id)
     DO UPDATE SET project_role = EXCLUDED.project_role,
                   weekly_capacity_hours = EXCLUDED.weekly_capacity_hours
     RETURNING *`,
    [organizationId, projectId, userId, projectRole, weeklyCapacityHours]
  );
  return rows[0];
}

export async function removeProjectMember(orgId, projectId, userId, dbClient) {
  const { rows } = await dbClient.query(
    `DELETE FROM project_members
     WHERE organization_id = $1 AND project_id = $2 AND user_id = $3
     RETURNING id, user_id`,
    [orgId, projectId, userId]
  );
  return rows[0] || null;
}

export async function listProjectDocuments(orgId, projectId) {
  const { rows } = await query(
    `SELECT d.id, d.project_id, d.title, d.category, d.original_name, d.mime_type,
            d.file_size_bytes, d.version, d.created_at,
            u.full_name AS uploaded_by_name
     FROM documents d
     INNER JOIN users u ON u.id = d.uploaded_by
     WHERE d.organization_id = $1 AND d.project_id = $2
     ORDER BY d.created_at DESC`,
    [orgId, projectId]
  );
  return rows;
}

export async function createProjectDocument(
  { organizationId, projectId, uploadedBy, title, category, originalName, storedFilename, mimeType, fileSizeBytes },
  dbClient
) {
  const { rows } = await dbClient.query(
    `INSERT INTO documents (
       organization_id, project_id, uploaded_by, title, category,
       original_name, stored_filename, mime_type, file_size_bytes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, project_id, title, category, original_name, mime_type, file_size_bytes, version, created_at`,
    [
      organizationId,
      projectId,
      uploadedBy,
      title,
      category,
      originalName,
      storedFilename,
      mimeType,
      fileSizeBytes,
    ]
  );
  return rows[0];
}

export async function findDocumentById(orgId, documentId) {
  const { rows } = await query(
    `SELECT d.*, p.organization_id
     FROM documents d
     INNER JOIN projects p ON p.id = d.project_id
     WHERE d.organization_id = $1 AND d.id = $2`,
    [orgId, documentId]
  );
  return rows[0] || null;
}
