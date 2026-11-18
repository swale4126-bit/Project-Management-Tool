import { query } from '../../config/db.js';

export async function listOrganizationBudgets(orgId) {
  const { rows } = await query(
    `SELECT p.id AS project_id, p.project_code, p.name AS project_name, p.status AS project_status,
            b.id AS budget_id,
            COALESCE(b.planned_amount, 0.00)::numeric(14,2) AS planned_amount,
            COALESCE(b.contingency_amount, 0.00)::numeric(14,2) AS contingency_amount,
            COALESCE(b.currency_code, o.currency_code) AS currency_code,
            COALESCE(e.approved_spend, 0.00)::numeric(14,2) AS approved_spend,
            COALESCE(e.pending_spend, 0.00)::numeric(14,2) AS pending_spend,
            COALESCE(e.expense_count, 0)::int AS expense_count
     FROM projects p
     INNER JOIN organizations o ON o.id = p.organization_id
     LEFT JOIN budgets b ON b.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
              COUNT(*) AS expense_count,
              COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) AS approved_spend,
              COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_spend
       FROM expenses
       WHERE organization_id = $1
       GROUP BY project_id
     ) e ON e.project_id = p.id
     WHERE p.organization_id = $1 AND p.is_archived = FALSE
     ORDER BY p.created_at DESC`,
    [orgId]
  );
  return rows;
}

export async function getProjectBudgetDetails(orgId, projectId) {
  const [summaryRes, categoryRes] = await Promise.all([
    query(
      `SELECT p.id AS project_id, p.project_code, p.name AS project_name,
              b.id AS budget_id, b.notes,
              COALESCE(b.planned_amount, 0.00)::numeric(14,2) AS planned_amount,
              COALESCE(b.contingency_amount, 0.00)::numeric(14,2) AS contingency_amount,
              COALESCE(b.currency_code, o.currency_code) AS currency_code,
              COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'approved'), 0.00)::numeric(14,2) AS approved_spend,
              COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'pending'), 0.00)::numeric(14,2) AS pending_spend,
              COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'rejected'), 0.00)::numeric(14,2) AS rejected_spend
       FROM projects p
       INNER JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN budgets b ON b.project_id = p.id
       LEFT JOIN expenses e ON e.project_id = p.id AND e.organization_id = $1
       WHERE p.organization_id = $1 AND p.id = $2
       GROUP BY p.id, b.id, o.currency_code`,
      [orgId, projectId]
    ),
    query(
      `SELECT category,
              COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0.00)::numeric(14,2) AS approved_total,
              COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0.00)::numeric(14,2) AS pending_total,
              COUNT(*)::int AS count
       FROM expenses
       WHERE organization_id = $1 AND project_id = $2
       GROUP BY category
       ORDER BY approved_total DESC`,
      [orgId, projectId]
    ),
  ]);

  if (!summaryRes.rows[0]) return null;
  return {
    ...summaryRes.rows[0],
    byCategory: categoryRes.rows,
  };
}

export async function upsertBudget(
  { organizationId, projectId, plannedAmount, contingencyAmount, currencyCode, notes, createdBy },
  dbClient
) {
  const { rows } = await dbClient.query(
    `INSERT INTO budgets
       (organization_id, project_id, planned_amount, contingency_amount, currency_code, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (project_id)
     DO UPDATE SET planned_amount = EXCLUDED.planned_amount,
                   contingency_amount = EXCLUDED.contingency_amount,
                   currency_code = EXCLUDED.currency_code,
                   notes = EXCLUDED.notes
     RETURNING *`,
    [organizationId, projectId, plannedAmount, contingencyAmount, currencyCode, notes || null, createdBy]
  );
  return rows[0];
}

export async function listExpenses(
  orgId,
  { projectId, category, status, fromDate, toDate, limit, offset },
  { userId, orgRole, isSuperAdmin }
) {
  const conditions = ['e.organization_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (!isSuperAdmin && orgRole !== 'org_owner' && orgRole !== 'project_manager') {
    conditions.push(`EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = e.project_id AND pm.user_id = $${idx++}
    )`);
    params.push(userId);
  }

  if (projectId) {
    conditions.push(`e.project_id = $${idx++}`);
    params.push(projectId);
  }
  if (category) {
    conditions.push(`e.category = $${idx++}`);
    params.push(category);
  }
  if (status) {
    conditions.push(`e.status = $${idx++}`);
    params.push(status);
  }
  if (fromDate) {
    conditions.push(`e.expense_date >= $${idx++}`);
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push(`e.expense_date <= $${idx++}`);
    params.push(toDate);
  }

  const whereClause = conditions.join(' AND ');
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM expenses e WHERE ${whereClause}`,
    params
  );
  const total = countRes.rows[0].total;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT e.*,
            p.project_code,
            p.name AS project_name,
            sub.full_name AS submitted_by_name,
            (SELECT json_agg(json_build_object(
               'id', ea.id,
               'decision', ea.decision,
               'comments', ea.comments,
               'decidedAt', ea.decided_at,
               'approverName', app_u.full_name
             ) ORDER BY ea.decided_at DESC)
             FROM expense_approvals ea
             INNER JOIN users app_u ON app_u.id = ea.approver_id
             WHERE ea.expense_id = e.id) AS approvals
     FROM expenses e
     INNER JOIN projects p ON p.id = e.project_id
     INNER JOIN users sub ON sub.id = e.submitted_by
     WHERE ${whereClause}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  return { rows, total };
}

export async function findExpenseById(orgId, expenseId, dbClient = null) {
  const exec = dbClient ? (t, p) => dbClient.query(t, p) : query;
  const { rows } = await exec(
    `SELECT e.*, p.project_code, p.name AS project_name, p.manager_id AS project_manager_id
     FROM expenses e
     INNER JOIN projects p ON p.id = e.project_id
     WHERE e.organization_id = $1 AND e.id = $2`,
    [orgId, expenseId]
  );
  return rows[0] || null;
}

export async function createExpense(orgId, submittedBy, budgetId, payload, file, dbClient) {
  const { rows } = await dbClient.query(
    `INSERT INTO expenses (
       organization_id, project_id, budget_id, submitted_by, title, category,
       expense_date, amount, vendor_name, description,
       receipt_original_name, receipt_stored_path, receipt_mime_type
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      orgId,
      payload.projectId,
      budgetId || null,
      submittedBy,
      payload.title,
      payload.category,
      payload.expenseDate,
      payload.amount,
      payload.vendorName || null,
      payload.description || null,
      file?.originalname || null,
      file?.filename || null,
      file?.mimetype || null,
    ]
  );
  return rows[0];
}

export async function updateExpenseStatus(orgId, expenseId, status, dbClient) {
  const { rows } = await dbClient.query(
    `UPDATE expenses
     SET status = $1
     WHERE organization_id = $2 AND id = $3
     RETURNING *`,
    [status, orgId, expenseId]
  );
  return rows[0] || null;
}

export async function insertExpenseApproval(
  { organizationId, expenseId, approverId, decision, comments },
  dbClient
) {
  const { rows } = await dbClient.query(
    `INSERT INTO expense_approvals (organization_id, expense_id, approver_id, decision, comments)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [organizationId, expenseId, approverId, decision, comments || null]
  );
  return rows[0];
}
