import { withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { calculateUtilizationPct, subtractMoney, addMoney } from '../../utils/money.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as budgetRepo from './budgets.repository.js';

function enrichBudgetRow(row) {
  const planned = String(row.planned_amount ?? '0.00');
  const contingency = String(row.contingency_amount ?? '0.00');
  const approved = String(row.approved_spend ?? '0.00');
  const pending = String(row.pending_spend ?? '0.00');
  const totalBudget = addMoney(planned, contingency);

  return {
    ...row,
    planned_amount: planned,
    contingency_amount: contingency,
    total_allocated_budget: totalBudget,
    approved_spend: approved,
    pending_spend: pending,
    remaining_budget: subtractMoney(planned, approved),
    utilization_pct: calculateUtilizationPct(approved, planned),
    is_over_budget: Number(approved) > Number(planned) && Number(planned) > 0,
  };
}

export async function listOrganizationBudgets(orgId) {
  const rows = await budgetRepo.listOrganizationBudgets(orgId);
  return rows.map(enrichBudgetRow);
}

export async function getProjectBudget(orgId, projectId) {
  const details = await budgetRepo.getProjectBudgetDetails(orgId, projectId);
  if (!details) {
    throw AppError.notFound('Project not found.');
  }
  return enrichBudgetRow(details);
}

export async function upsertProjectBudget(orgId, projectId, actorId, defaultCurrency, payload) {
  return withTransaction(async (client) => {
    const projectRes = await client.query(
      `SELECT id, project_code, name FROM projects WHERE organization_id = $1 AND id = $2`,
      [orgId, projectId]
    );
    const project = projectRes.rows[0];
    if (!project) {
      throw AppError.notFound('Project not found.');
    }

    const budget = await budgetRepo.upsertBudget(
      {
        organizationId: orgId,
        projectId,
        plannedAmount: payload.plannedAmount,
        contingencyAmount: payload.contingencyAmount || '0.00',
        currencyCode: payload.currencyCode || defaultCurrency || 'USD',
        notes: payload.notes,
        createdBy: actorId,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId,
        actorId,
        action: 'budget.updated',
        entityType: 'budget',
        entityId: budget.id,
        summary: `Set budget for [${project.project_code}] to ${budget.currency_code} ${budget.planned_amount}`,
      },
      client
    );

    return budget;
  });
}

export async function listExpenses(orgId, filters, userContext) {
  const { rows, total } = await budgetRepo.listExpenses(orgId, filters, userContext);
  return { items: rows, total };
}

export async function createExpense(orgId, actorId, payload, file) {
  return withTransaction(async (client) => {
    const projectRes = await client.query(
      `SELECT p.id, p.project_code, p.name, p.manager_id, b.id AS budget_id
       FROM projects p
       LEFT JOIN budgets b ON b.project_id = p.id
       WHERE p.organization_id = $1 AND p.id = $2`,
      [orgId, payload.projectId]
    );
    const project = projectRes.rows[0];
    if (!project) {
      throw AppError.notFound('Project not found.');
    }

    const created = await budgetRepo.createExpense(
      orgId,
      actorId,
      project.budget_id,
      payload,
      file,
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: payload.projectId,
        actorId,
        action: 'expense.submitted',
        entityType: 'expense',
        entityId: created.id,
        summary: `Submitted expense "${created.title}" (${created.amount})`,
        metadata: { category: created.category, amount: created.amount },
      },
      client
    );

    if (project.manager_id && project.manager_id !== actorId) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: project.manager_id,
          type: 'expense_submitted',
          title: 'Expense Pending Approval',
          message: `Expense "${created.title}" (${created.amount}) submitted for [${project.project_code}].`,
          entityType: 'expense',
          entityId: created.id,
        },
        client
      );
    }

    return created;
  });
}

export async function decideExpense(orgId, expenseId, approverId, { decision, comments }) {
  return withTransaction(async (client) => {
    const existing = await budgetRepo.findExpenseById(orgId, expenseId, client);
    if (!existing) {
      throw AppError.notFound('Expense not found.');
    }
    if (existing.status !== 'pending') {
      throw AppError.conflict(
        `This expense has already been ${existing.status}.`,
        'EXPENSE_ALREADY_DECIDED'
      );
    }

    const updated = await budgetRepo.updateExpenseStatus(orgId, expenseId, decision, client);
    const approval = await budgetRepo.insertExpenseApproval(
      {
        organizationId: orgId,
        expenseId,
        approverId,
        decision,
        comments,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        projectId: existing.project_id,
        actorId: approverId,
        action: `expense.${decision}`,
        entityType: 'expense',
        entityId: expenseId,
        summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} expense "${existing.title}" (${existing.amount})`,
        metadata: { decision, amount: existing.amount, comments: comments || null },
      },
      client
    );

    if (existing.submitted_by !== approverId) {
      await createNotification(
        {
          organizationId: orgId,
          recipientId: existing.submitted_by,
          type: 'expense_reviewed',
          title: `Expense ${decision}`,
          message: `Your expense "${existing.title}" (${existing.amount}) was ${decision}.${comments ? ` Note: ${comments}` : ''}`,
          entityType: 'expense',
          entityId: expenseId,
        },
        client
      );
    }

    return { expense: updated, approval };
  });
}

export async function getExpenseForReceiptDownload(orgId, expenseId) {
  const expense = await budgetRepo.findExpenseById(orgId, expenseId);
  if (!expense) {
    throw AppError.notFound('Expense not found.');
  }
  return expense;
}
