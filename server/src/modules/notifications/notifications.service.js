import { query, withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Creates an in-app notification for a recipient inside an organization.
 * Supports running inside an active PostgreSQL transaction via `dbClient`.
 */
export async function createNotification(
  {
    organizationId,
    recipientId,
    type,
    title,
    message,
    entityType = null,
    entityId = null,
  },
  dbClient = null
) {
  if (!recipientId) return null;
  const executor = dbClient ? (text, params) => dbClient.query(text, params) : query;

  const { rows } = await executor(
    `INSERT INTO notifications
       (organization_id, recipient_id, type, title, message, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, type, title, is_read, created_at`,
    [organizationId, recipientId, type, title, message, entityType, entityId]
  );

  return rows[0];
}

export async function listUserNotifications(
  orgId,
  userId,
  { unreadOnly = false, limit = 20, offset = 0 } = {}
) {
  const conditions = ['organization_id = $1', 'recipient_id = $2'];
  const params = [orgId, userId];

  if (unreadOnly) {
    conditions.push('is_read = FALSE');
  }
  const whereClause = conditions.join(' AND ');

  const [countRes, unreadRes, listRes] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM notifications WHERE ${whereClause}`, params),
    query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notifications
       WHERE organization_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
      [orgId, userId]
    ),
    query(
      `SELECT id, type, title, message, entity_type, entity_id, is_read, read_at, created_at
       FROM notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [...params, limit, offset]
    ),
  ]);

  return {
    items: listRes.rows,
    total: countRes.rows[0].total,
    unreadCount: unreadRes.rows[0].unread_count,
  };
}

export async function markNotificationRead(orgId, userId, notificationId) {
  const { rows } = await query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE organization_id = $1 AND recipient_id = $2 AND id = $3
     RETURNING id, is_read, read_at`,
    [orgId, userId, notificationId]
  );

  if (!rows[0]) {
    throw AppError.notFound('Notification not found.');
  }
  return rows[0];
}

export async function markAllNotificationsRead(orgId, userId) {
  const { rowCount } = await query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE organization_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
    [orgId, userId]
  );
  return { markedCount: rowCount };
}

/**
 * Scans an organization for overdue tasks, tasks due within 48 hours, and overdue milestones,
 * creating deduplicated daily notifications (at most once per calendar day per entity/recipient/type).
 */
export async function generateDeadlineReminders(orgId) {
  return withTransaction(async (client) => {
    const overdueTasksRes = await client.query(
      `SELECT t.id, t.title, t.due_date, p.project_code, ta.user_id AS recipient_id
       FROM tasks t
       INNER JOIN projects p ON p.id = t.project_id
       INNER JOIN task_assignees ta ON ta.task_id = t.id
       WHERE t.organization_id = $1
         AND t.status <> 'completed'
         AND t.due_date IS NOT NULL
         AND t.due_date < CURRENT_DATE
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.organization_id = $1
             AND n.recipient_id = ta.user_id
             AND n.entity_id = t.id
             AND n.type = 'task_overdue'
             AND n.created_at::date = CURRENT_DATE
         )`,
      [orgId]
    );

    const dueSoonTasksRes = await client.query(
      `SELECT t.id, t.title, t.due_date, p.project_code, ta.user_id AS recipient_id
       FROM tasks t
       INNER JOIN projects p ON p.id = t.project_id
       INNER JOIN task_assignees ta ON ta.task_id = t.id
       WHERE t.organization_id = $1
         AND t.status <> 'completed'
         AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.organization_id = $1
             AND n.recipient_id = ta.user_id
             AND n.entity_id = t.id
             AND n.type = 'task_due_soon'
             AND n.created_at::date = CURRENT_DATE
         )`,
      [orgId]
    );

    const overdueMilestonesRes = await client.query(
      `SELECT m.id, m.title, m.target_date, p.project_code, COALESCE(m.owner_id, p.manager_id) AS recipient_id
       FROM project_milestones m
       INNER JOIN projects p ON p.id = m.project_id
       WHERE m.organization_id = $1
         AND m.status <> 'completed'
         AND m.target_date < CURRENT_DATE
         AND COALESCE(m.owner_id, p.manager_id) IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.organization_id = $1
             AND n.recipient_id = COALESCE(m.owner_id, p.manager_id)
             AND n.entity_id = m.id
             AND n.type = 'milestone_overdue'
             AND n.created_at::date = CURRENT_DATE
         )`,
      [orgId]
    );

    let created = 0;

    for (const row of overdueTasksRes.rows) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: row.recipient_id,
          type: 'task_overdue',
          title: 'Overdue Task Alert',
          message: `[${row.project_code}] "${row.title}" was due on ${String(row.due_date).slice(0, 10)}.`,
          entityType: 'task',
          entityId: row.id,
        },
        client
      );
      created++;
    }

    for (const row of dueSoonTasksRes.rows) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: row.recipient_id,
          type: 'task_due_soon',
          title: 'Upcoming Task Deadline',
          message: `[${row.project_code}] "${row.title}" is due on ${String(row.due_date).slice(0, 10)}.`,
          entityType: 'task',
          entityId: row.id,
        },
        client
      );
      created++;
    }

    for (const row of overdueMilestonesRes.rows) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: row.recipient_id,
          type: 'milestone_overdue',
          title: 'Overdue Milestone Alert',
          message: `[${row.project_code}] Milestone "${row.title}" missed target date ${String(row.target_date).slice(0, 10)}.`,
          entityType: 'milestone',
          entityId: row.id,
        },
        client
      );
      created++;
    }

    return {
      createdCount: created,
      overdueTasksNotified: overdueTasksRes.rowCount,
      dueSoonTasksNotified: dueSoonTasksRes.rowCount,
      overdueMilestonesNotified: overdueMilestonesRes.rowCount,
    };
  });
}
