import { query } from '../../config/db.js';

export async function listMilestones(orgId, projectId = null) {
  const params = [orgId];
  let projectFilter = '';
  if (projectId) {
    projectFilter = 'AND m.project_id = $2';
    params.push(projectId);
  }

  const { rows } = await query(
    `SELECT m.*,
            p.project_code,
            p.name AS project_name,
            u.full_name AS owner_name,
            (m.status <> 'completed' AND m.target_date < CURRENT_DATE) AS is_overdue,
            COALESCE(t_stats.total_tasks, 0)::int AS total_tasks,
            COALESCE(t_stats.completed_tasks, 0)::int AS completed_tasks
     FROM project_milestones m
     INNER JOIN projects p ON p.id = m.project_id
     LEFT JOIN users u ON u.id = m.owner_id
     LEFT JOIN (
       SELECT milestone_id,
              COUNT(*) AS total_tasks,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks
       FROM tasks
       WHERE organization_id = $1 AND milestone_id IS NOT NULL
       GROUP BY milestone_id
     ) t_stats ON t_stats.milestone_id = m.id
     WHERE m.organization_id = $1 ${projectFilter}
     ORDER BY m.target_date ASC, m.created_at ASC`,
    params
  );

  return rows;
}

export async function findMilestoneById(orgId, milestoneId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT * FROM project_milestones WHERE organization_id = $1 AND id = $2`,
    [orgId, milestoneId]
  );
  return rows[0] || null;
}

export async function createMilestone(orgId, payload, dbClient) {
  const isCompleted = payload.status === 'completed';
  const { rows } = await dbClient.query(
    `INSERT INTO project_milestones
       (organization_id, project_id, owner_id, title, description, target_date, status, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      orgId,
      payload.projectId,
      payload.ownerId || null,
      payload.title,
      payload.description || null,
      payload.targetDate,
      payload.status || 'pending',
      isCompleted ? new Date() : null,
    ]
  );
  return rows[0];
}

export async function updateMilestone(orgId, milestoneId, payload, dbClient) {
  const mapping = {
    ownerId: 'owner_id',
    title: 'title',
    description: 'description',
    targetDate: 'target_date',
    status: 'status',
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

  values.push(orgId, milestoneId);
  const { rows } = await dbClient.query(
    `UPDATE project_milestones
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function deleteMilestone(orgId, milestoneId, dbClient) {
  const { rows } = await dbClient.query(
    `DELETE FROM project_milestones
     WHERE organization_id = $1 AND id = $2
     RETURNING id, project_id, title`,
    [orgId, milestoneId]
  );
  return rows[0] || null;
}

/**
 * Returns real PostgreSQL timeline dataset for Gantt visualization:
 * project date bounds, milestones, tasks, and dependencies.
 */
export async function getProjectTimeline(orgId, projectId) {
  const [projectRes, milestones, tasksRes, depsRes] = await Promise.all([
    query(
      `SELECT id, project_code, name, status, start_date, expected_end_date, actual_completion_date
       FROM projects
       WHERE organization_id = $1 AND id = $2`,
      [orgId, projectId]
    ),
    listMilestones(orgId, projectId),
    query(
      `SELECT t.id, t.title, t.status, t.priority, t.start_date, t.due_date,
              t.progress_percent, t.milestone_id, t.parent_task_id,
              (t.status <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE) AS is_overdue,
              COALESCE(
                (SELECT json_agg(json_build_object('id', u.id, 'fullName', u.full_name))
                 FROM task_assignees ta
                 INNER JOIN users u ON u.id = ta.user_id
                 WHERE ta.task_id = t.id),
                '[]'::json
              ) AS assignees
       FROM tasks t
       WHERE t.organization_id = $1 AND t.project_id = $2
       ORDER BY COALESCE(t.start_date, t.due_date, CURRENT_DATE) ASC, t.created_at ASC`,
      [orgId, projectId]
    ),
    query(
      `SELECT id, task_id, depends_on_task_id
       FROM task_dependencies
       WHERE organization_id = $1 AND project_id = $2`,
      [orgId, projectId]
    ),
  ]);

  if (!projectRes.rows[0]) {
    return null;
  }

  return {
    project: projectRes.rows[0],
    milestones,
    tasks: tasksRes.rows,
    dependencies: depsRes.rows,
  };
}
