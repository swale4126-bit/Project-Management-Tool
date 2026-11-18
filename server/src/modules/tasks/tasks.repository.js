import { query } from '../../config/db.js';

const SORT_COLUMNS = {
  created_at: 't.created_at',
  due_date: 't.due_date',
  priority: "CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END",
  status: 't.status',
  title: 't.title',
};

export async function listTasks(
  orgId,
  { projectId, assigneeId, milestoneId, status, priority, overdue, search, sortBy = 'due_date', sortOrder = 'asc', limit, offset },
  { userId, orgRole, isSuperAdmin }
) {
  const conditions = ['t.organization_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (!isSuperAdmin && orgRole !== 'org_owner' && orgRole !== 'project_manager') {
    conditions.push(`EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = t.project_id AND pm.user_id = $${idx++}
    )`);
    params.push(userId);
  }

  if (projectId) {
    conditions.push(`t.project_id = $${idx++}`);
    params.push(projectId);
  }
  if (milestoneId) {
    conditions.push(`t.milestone_id = $${idx++}`);
    params.push(milestoneId);
  }
  if (status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(status);
  }
  if (priority) {
    conditions.push(`t.priority = $${idx++}`);
    params.push(priority);
  }
  if (assigneeId) {
    conditions.push(`EXISTS (
      SELECT 1 FROM task_assignees ta_filter
      WHERE ta_filter.task_id = t.id AND ta_filter.user_id = $${idx++}
    )`);
    params.push(assigneeId);
  }
  if (overdue === true) {
    conditions.push(`t.status <> 'completed' AND t.due_date < CURRENT_DATE`);
  }
  if (search) {
    conditions.push(`(t.title ILIKE $${idx} OR COALESCE(t.description, '') ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = conditions.join(' AND ');
  const orderExpr = SORT_COLUMNS[sortBy] || 't.due_date';
  const orderDir = sortOrder === 'desc' ? 'DESC NULLS LAST' : 'ASC NULLS LAST';

  const countRes = await query(`SELECT COUNT(*)::int AS total FROM tasks t WHERE ${whereClause}`, params);
  const total = countRes.rows[0].total;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT t.*,
            p.project_code,
            p.name AS project_name,
            m.title AS milestone_title,
            (t.status <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE) AS is_overdue,
            COALESCE(
              (SELECT json_agg(json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email))
               FROM task_assignees ta
               INNER JOIN users u ON u.id = ta.user_id
               WHERE ta.task_id = t.id),
              '[]'::json
            ) AS assignees,
            (SELECT COUNT(*)::int FROM tasks sub WHERE sub.parent_task_id = t.id) AS subtask_count,
            (SELECT COUNT(*)::int FROM task_dependencies td WHERE td.task_id = t.id) AS dependency_count
     FROM tasks t
     INNER JOIN projects p ON p.id = t.project_id
     LEFT JOIN project_milestones m ON m.id = t.milestone_id
     WHERE ${whereClause}
     ORDER BY ${orderExpr} ${orderDir}, t.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  return { rows, total };
}

export async function findTaskBasic(orgId, taskId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT * FROM tasks WHERE organization_id = $1 AND id = $2`,
    [orgId, taskId]
  );
  return rows[0] || null;
}

export async function findTaskDetails(orgId, taskId) {
  const { rows } = await query(
    `SELECT t.*,
            p.project_code,
            p.name AS project_name,
            m.title AS milestone_title,
            creator.full_name AS creator_name,
            (t.status <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE) AS is_overdue
     FROM tasks t
     INNER JOIN projects p ON p.id = t.project_id
     INNER JOIN users creator ON creator.id = t.creator_id
     LEFT JOIN project_milestones m ON m.id = t.milestone_id
     WHERE t.organization_id = $1 AND t.id = $2`,
    [orgId, taskId]
  );
  const task = rows[0];
  if (!task) return null;

  const [assigneesRes, subtasksRes, prereqRes, dependentRes, commentsRes, attachmentsRes] =
    await Promise.all([
      query(
        `SELECT u.id, u.full_name, u.email, u.job_title, ta.assigned_at
         FROM task_assignees ta
         INNER JOIN users u ON u.id = ta.user_id
         WHERE ta.task_id = $1
         ORDER BY u.full_name ASC`,
        [taskId]
      ),
      query(
        `SELECT id, title, status, priority, due_date, progress_percent
         FROM tasks
         WHERE organization_id = $1 AND parent_task_id = $2
         ORDER BY created_at ASC`,
        [orgId, taskId]
      ),
      query(
        `SELECT td.id AS dependency_id, t.id AS task_id, t.title, t.status, t.due_date
         FROM task_dependencies td
         INNER JOIN tasks t ON t.id = td.depends_on_task_id
         WHERE td.task_id = $1`,
        [taskId]
      ),
      query(
        `SELECT td.id AS dependency_id, t.id AS task_id, t.title, t.status, t.due_date
         FROM task_dependencies td
         INNER JOIN tasks t ON t.id = td.task_id
         WHERE td.depends_on_task_id = $1`,
        [taskId]
      ),
      query(
        `SELECT c.id, c.body, c.created_at, c.updated_at,
                u.id AS author_id, u.full_name AS author_name, u.job_title AS author_title
         FROM task_comments c
         INNER JOIN users u ON u.id = c.author_id
         WHERE c.task_id = $1
         ORDER BY c.created_at ASC`,
        [taskId]
      ),
      query(
        `SELECT a.id, a.original_name, a.mime_type, a.file_size_bytes, a.created_at,
                u.full_name AS uploaded_by_name
         FROM task_attachments a
         INNER JOIN users u ON u.id = a.uploaded_by
         WHERE a.task_id = $1
         ORDER BY a.created_at DESC`,
        [taskId]
      ),
    ]);

  return {
    ...task,
    assignees: assigneesRes.rows,
    subtasks: subtasksRes.rows,
    prerequisites: prereqRes.rows,
    dependents: dependentRes.rows,
    comments: commentsRes.rows,
    attachments: attachmentsRes.rows,
  };
}

export async function createTask(orgId, creatorId, payload, dbClient) {
  const isCompleted = payload.status === 'completed';
  const { rows } = await dbClient.query(
    `INSERT INTO tasks (
       organization_id, project_id, milestone_id, parent_task_id, creator_id,
       title, description, priority, status, start_date, due_date, completed_at,
       estimated_hours, actual_hours, progress_percent, labels
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      orgId,
      payload.projectId,
      payload.milestoneId || null,
      payload.parentTaskId || null,
      creatorId,
      payload.title,
      payload.description || null,
      payload.priority || 'medium',
      payload.status || 'todo',
      payload.startDate || null,
      payload.dueDate || null,
      isCompleted ? new Date() : null,
      payload.estimatedHours ?? null,
      payload.actualHours ?? 0,
      isCompleted ? 100 : (payload.progressPercent ?? 0),
      payload.labels || [],
    ]
  );
  return rows[0];
}

export async function updateTask(orgId, taskId, payload, dbClient) {
  const mapping = {
    milestoneId: 'milestone_id',
    title: 'title',
    description: 'description',
    priority: 'priority',
    status: 'status',
    startDate: 'start_date',
    dueDate: 'due_date',
    estimatedHours: 'estimated_hours',
    actualHours: 'actual_hours',
    progressPercent: 'progress_percent',
    labels: 'labels',
    completedAt: 'completed_at',
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

  values.push(orgId, taskId);
  const { rows } = await dbClient.query(
    `UPDATE tasks
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function deleteTask(orgId, taskId, dbClient) {
  const { rows } = await dbClient.query(
    `DELETE FROM tasks WHERE organization_id = $1 AND id = $2 RETURNING id, project_id, title`,
    [orgId, taskId]
  );
  return rows[0] || null;
}

export async function replaceAssignees(taskId, assigneeIds, assignedBy, dbClient) {
  await dbClient.query(`DELETE FROM task_assignees WHERE task_id = $1`, [taskId]);
  const uniqueIds = [...new Set(assigneeIds)];
  for (const userId of uniqueIds) {
    await dbClient.query(
      `INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES ($1, $2, $3)`,
      [taskId, userId, assignedBy]
    );
  }
  return uniqueIds;
}

export async function getTaskAssigneeIds(taskId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(`SELECT user_id FROM task_assignees WHERE task_id = $1`, [taskId]);
  return rows.map((r) => r.user_id);
}

export async function getProjectDependencies(orgId, projectId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT task_id, depends_on_task_id
     FROM task_dependencies
     WHERE organization_id = $1 AND project_id = $2`,
    [orgId, projectId]
  );
  return rows;
}

export async function addDependency({ organizationId, projectId, taskId, dependsOnTaskId }, dbClient) {
  const { rows } = await dbClient.query(
    `INSERT INTO task_dependencies (organization_id, project_id, task_id, depends_on_task_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [organizationId, projectId, taskId, dependsOnTaskId]
  );
  return rows[0];
}

export async function removeDependency(orgId, taskId, dependencyId, dbClient) {
  const { rows } = await dbClient.query(
    `DELETE FROM task_dependencies
     WHERE organization_id = $1 AND task_id = $2 AND id = $3
     RETURNING id`,
    [orgId, taskId, dependencyId]
  );
  return rows[0] || null;
}

export async function addComment({ organizationId, taskId, authorId, body }, dbClient) {
  const { rows } = await dbClient.query(
    `INSERT INTO task_comments (organization_id, task_id, author_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [organizationId, taskId, authorId, body]
  );
  return rows[0];
}

export async function addAttachment(
  { organizationId, taskId, uploadedBy, originalName, storedFilename, mimeType, fileSizeBytes },
  dbClient
) {
  const { rows } = await dbClient.query(
    `INSERT INTO task_attachments
       (organization_id, task_id, uploaded_by, original_name, stored_filename, mime_type, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, task_id, original_name, mime_type, file_size_bytes, created_at`,
    [organizationId, taskId, uploadedBy, originalName, storedFilename, mimeType, fileSizeBytes]
  );
  return rows[0];
}

export async function findAttachmentById(orgId, attachmentId) {
  const { rows } = await query(
    `SELECT * FROM task_attachments WHERE organization_id = $1 AND id = $2`,
    [orgId, attachmentId]
  );
  return rows[0] || null;
}
