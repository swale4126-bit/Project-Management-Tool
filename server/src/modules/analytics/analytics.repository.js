import { query } from '../../config/db.js';
import { calculateUtilizationPct, subtractMoney } from '../../utils/money.js';

export async function getOrganizationDashboard(orgId, { fromDate, toDate } = {}) {
  const dateFilterTasks = [];
  const taskParams = [orgId];
  let idx = 2;
  if (fromDate) {
    dateFilterTasks.push(`created_at::date >= $${idx++}`);
    taskParams.push(fromDate);
  }
  if (toDate) {
    dateFilterTasks.push(`created_at::date <= $${idx++}`);
    taskParams.push(toDate);
  }
  const taskExtraWhere = dateFilterTasks.length ? `AND ${dateFilterTasks.join(' AND ')}` : '';

  const [
    projSummaryRes,
    projStatusRes,
    membersRes,
    tasksSummaryRes,
    budgetRes,
    shortageRes,
    activeSitesRes,
    monthlyTrendRes,
    recentActivityRes,
  ] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total_projects,
              COUNT(*) FILTER (WHERE status = 'active')::int AS active_projects,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_projects,
              COUNT(*) FILTER (WHERE status = 'at_risk')::int AS at_risk_projects,
              COUNT(*) FILTER (WHERE status = 'planning')::int AS planning_projects,
              COUNT(*) FILTER (WHERE status = 'on_hold')::int AS on_hold_projects
       FROM projects
       WHERE organization_id = $1 AND is_archived = FALSE`,
      [orgId]
    ),
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM projects
       WHERE organization_id = $1 AND is_archived = FALSE
       GROUP BY status`,
      [orgId]
    ),
    query(
      `SELECT COUNT(*)::int AS total_members
       FROM organization_members
       WHERE organization_id = $1 AND status = 'active'`,
      [orgId]
    ),
    query(
      `SELECT COUNT(*)::int AS total_tasks,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_tasks,
              COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked_tasks,
              COUNT(*) FILTER (WHERE status <> 'completed' AND due_date < CURRENT_DATE)::int AS overdue_tasks
       FROM tasks
       WHERE organization_id = $1 ${taskExtraWhere}`,
      taskParams
    ),
    query(
      `SELECT COALESCE((SELECT SUM(planned_amount) FROM budgets WHERE organization_id = $1), 0.00)::numeric(14,2) AS total_planned,
              COALESCE((SELECT SUM(amount) FROM expenses WHERE organization_id = $1 AND status = 'approved'), 0.00)::numeric(14,2) AS total_approved,
              COALESCE((SELECT SUM(amount) FROM expenses WHERE organization_id = $1 AND status = 'pending'), 0.00)::numeric(14,2) AS total_pending`,
      [orgId]
    ),
    query(
      `SELECT COUNT(*)::int AS shortage_count
       FROM resources
       WHERE organization_id = $1 AND available_quantity <= min_threshold`,
      [orgId]
    ),
    query(
      `SELECT p.id, p.project_code, p.name, p.status, p.priority, p.location_name,
              p.latitude, p.longitude, p.start_date, p.expected_end_date,
              COALESCE(t.total_tasks, 0)::int AS total_tasks,
              COALESCE(t.completed_tasks, 0)::int AS completed_tasks,
              COALESCE(t.overdue_tasks, 0)::int AS overdue_tasks,
              COALESCE(m.team_size, 0)::int AS team_size,
              COALESCE(fr.field_progress_pct, 0.00)::numeric(6,2) AS field_progress_pct,
              COALESCE(b.planned_amount, 0.00)::numeric(14,2) AS planned_budget,
              COALESCE(e.approved_spend, 0.00)::numeric(14,2) AS approved_spend
       FROM projects p
       LEFT JOIN budgets b ON b.project_id = p.id
       LEFT JOIN (
         SELECT project_id,
                COUNT(*) AS total_tasks,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
                COUNT(*) FILTER (WHERE status <> 'completed' AND due_date < CURRENT_DATE) AS overdue_tasks
         FROM tasks WHERE organization_id = $1 GROUP BY project_id
       ) t ON t.project_id = p.id
       LEFT JOIN (
         SELECT project_id, COUNT(*) AS team_size
         FROM project_members WHERE organization_id = $1 GROUP BY project_id
       ) m ON m.project_id = p.id
       LEFT JOIN (
         SELECT project_id, LEAST(100, SUM(progress_contribution_pct)) AS field_progress_pct
         FROM field_reports WHERE organization_id = $1 AND status = 'approved' GROUP BY project_id
       ) fr ON fr.project_id = p.id
       LEFT JOIN (
         SELECT project_id, SUM(amount) AS approved_spend
         FROM expenses WHERE organization_id = $1 AND status = 'approved' GROUP BY project_id
       ) e ON e.project_id = p.id
       WHERE p.organization_id = $1 AND p.is_archived = FALSE
       ORDER BY
         CASE WHEN p.status = 'at_risk' THEN 1 WHEN p.status = 'active' THEN 2 ELSE 3 END,
         p.expected_end_date ASC`,
      [orgId]
    ),
    query(
      `SELECT TO_CHAR(month_bucket, 'YYYY-MM') AS month,
              COALESCE(t_done.completed_tasks, 0)::int AS completed_tasks,
              COALESCE(fr_app.approved_reports, 0)::int AS approved_reports
       FROM generate_series(
         DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
         DATE_TRUNC('month', CURRENT_DATE),
         INTERVAL '1 month'
       ) AS month_bucket
       LEFT JOIN (
         SELECT DATE_TRUNC('month', completed_at) AS m, COUNT(*) AS completed_tasks
         FROM tasks
         WHERE organization_id = $1 AND completed_at IS NOT NULL
         GROUP BY 1
       ) t_done ON t_done.m = month_bucket
       LEFT JOIN (
         SELECT DATE_TRUNC('month', activity_date) AS m, COUNT(*) AS approved_reports
         FROM field_reports
         WHERE organization_id = $1 AND status = 'approved'
         GROUP BY 1
       ) fr_app ON fr_app.m = month_bucket
       ORDER BY month_bucket ASC`,
      [orgId]
    ),
    query(
      `SELECT al.id, al.action, al.entity_type, al.summary, al.created_at,
              u.full_name AS actor_name, p.project_code
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       LEFT JOIN projects p ON p.id = al.project_id
       WHERE al.organization_id = $1
       ORDER BY al.created_at DESC
       LIMIT 10`,
      [orgId]
    ),
  ]);

  const budget = budgetRes.rows[0];
  const sites = activeSitesRes.rows.map((s) => {
    const taskCompletionPct =
      s.total_tasks > 0 ? Math.round((s.completed_tasks / s.total_tasks) * 100) : 0;
    const budgetUtilPct = calculateUtilizationPct(s.approved_spend, s.planned_budget);
    return {
      ...s,
      latitude: s.latitude !== null ? Number(s.latitude) : null,
      longitude: s.longitude !== null ? Number(s.longitude) : null,
      field_progress_pct: Number(s.field_progress_pct),
      task_completion_pct: taskCompletionPct,
      budget_utilization_pct: budgetUtilPct,
    };
  });

  const atRiskWatchlist = sites.filter(
    (s) => s.status === 'at_risk' || s.overdue_tasks > 0 || s.budget_utilization_pct >= 85
  );

  return {
    kpis: {
      ...projSummaryRes.rows[0],
      total_members: membersRes.rows[0].total_members,
      ...tasksSummaryRes.rows[0],
      total_planned_budget: String(budget.total_planned),
      total_approved_spend: String(budget.total_approved),
      total_pending_spend: String(budget.total_pending),
      remaining_budget: subtractMoney(budget.total_planned, budget.total_approved),
      budget_utilization_pct: calculateUtilizationPct(budget.total_approved, budget.total_planned),
      resource_shortages: shortageRes.rows[0].shortage_count,
    },
    projectsByStatus: projStatusRes.rows,
    activeSites: sites,
    atRiskWatchlist,
    monthlyTrend: monthlyTrendRes.rows,
    recentActivity: recentActivityRes.rows,
  };
}

export async function getProjectDashboard(orgId, projectId) {
  const [
    projRes,
    taskDistRes,
    milestonesRes,
    deadlinesRes,
    budgetRes,
    workloadRes,
    risksRes,
    fieldReportsRes,
  ] = await Promise.all([
    query(
      `SELECT id, project_code, name, status, priority, location_name, start_date, expected_end_date
       FROM projects WHERE organization_id = $1 AND id = $2`,
      [orgId, projectId]
    ),
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM tasks
       WHERE organization_id = $1 AND project_id = $2
       GROUP BY status`,
      [orgId, projectId]
    ),
    query(
      `SELECT id, title, target_date, status,
              (status <> 'completed' AND target_date < CURRENT_DATE) AS is_overdue
       FROM project_milestones
       WHERE organization_id = $1 AND project_id = $2
       ORDER BY target_date ASC`,
      [orgId, projectId]
    ),
    query(
      `SELECT id, title, status, priority, due_date,
              (due_date < CURRENT_DATE) AS is_overdue
       FROM tasks
       WHERE organization_id = $1 AND project_id = $2
         AND status <> 'completed' AND due_date IS NOT NULL
       ORDER BY due_date ASC
       LIMIT 10`,
      [orgId, projectId]
    ),
    query(
      `SELECT COALESCE(b.planned_amount, 0.00)::numeric(14,2) AS planned_amount,
              COALESCE(b.contingency_amount, 0.00)::numeric(14,2) AS contingency_amount,
              COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'approved'), 0.00)::numeric(14,2) AS approved_spend,
              COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'pending'), 0.00)::numeric(14,2) AS pending_spend
       FROM projects p
       LEFT JOIN budgets b ON b.project_id = p.id
       LEFT JOIN expenses e ON e.project_id = p.id
       WHERE p.organization_id = $1 AND p.id = $2
       GROUP BY b.planned_amount, b.contingency_amount`,
      [orgId, projectId]
    ),
    query(
      `SELECT u.id, u.full_name, u.job_title, pm.project_role, pm.weekly_capacity_hours,
              COUNT(t.id)::int AS assigned_tasks,
              COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed_tasks,
              COUNT(t.id) FILTER (WHERE t.status = 'blocked')::int AS blocked_tasks,
              COALESCE(SUM(t.estimated_hours) FILTER (WHERE t.status <> 'completed'), 0)::numeric(8,2) AS active_estimated_hours,
              COALESCE(SUM(t.actual_hours), 0)::numeric(8,2) AS total_actual_hours
       FROM project_members pm
       INNER JOIN users u ON u.id = pm.user_id
       LEFT JOIN task_assignees ta ON ta.user_id = pm.user_id
       LEFT JOIN tasks t ON t.id = ta.task_id AND t.project_id = pm.project_id
       WHERE pm.organization_id = $1 AND pm.project_id = $2
       GROUP BY u.id, pm.project_role, pm.weekly_capacity_hours
       ORDER BY assigned_tasks DESC, u.full_name ASC`,
      [orgId, projectId]
    ),
    query(
      `SELECT id, title, probability, impact, severity, status, review_date
       FROM risks
       WHERE organization_id = $1 AND project_id = $2 AND status NOT IN ('mitigated', 'closed')
       ORDER BY severity DESC
       LIMIT 8`,
      [orgId, projectId]
    ),
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM field_reports
       WHERE organization_id = $1 AND project_id = $2
       GROUP BY status`,
      [orgId, projectId]
    ),
  ]);

  if (!projRes.rows[0]) return null;

  const totalTasks = taskDistRes.rows.reduce((sum, r) => sum + r.count, 0);
  const completedTasks =
    taskDistRes.rows.find((r) => r.status === 'completed')?.count || 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const bud = budgetRes.rows[0] || {
    planned_amount: '0.00',
    contingency_amount: '0.00',
    approved_spend: '0.00',
    pending_spend: '0.00',
  };

  return {
    project: projRes.rows[0],
    completionPercent: completionPct,
    totalTasks,
    completedTasks,
    taskStatusDistribution: taskDistRes.rows,
    milestones: milestonesRes.rows,
    upcomingDeadlines: deadlinesRes.rows,
    budgetPerformance: {
      ...bud,
      remaining_budget: subtractMoney(bud.planned_amount, bud.approved_spend),
      utilization_pct: calculateUtilizationPct(bud.approved_spend, bud.planned_amount),
    },
    teamWorkload: workloadRes.rows,
    openRisks: risksRes.rows,
    fieldReportStatus: fieldReportsRes.rows,
  };
}

export async function getMyDashboard(orgId, userId) {
  const [countsRes, myTasksRes, myReportsRes] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total_assigned,
              COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed_tasks,
              COUNT(*) FILTER (WHERE t.status = 'blocked')::int AS blocked_tasks,
              COUNT(*) FILTER (WHERE t.status = 'in_progress')::int AS in_progress_tasks,
              COUNT(*) FILTER (WHERE t.status <> 'completed' AND t.due_date < CURRENT_DATE)::int AS overdue_tasks,
              COUNT(*) FILTER (WHERE t.status <> 'completed' AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')::int AS upcoming_7d,
              COALESCE(SUM(t.estimated_hours) FILTER (WHERE t.status <> 'completed'), 0)::numeric(8,2) AS active_estimated_hours,
              COALESCE(SUM(t.actual_hours), 0)::numeric(8,2) AS logged_actual_hours
       FROM task_assignees ta
       INNER JOIN tasks t ON t.id = ta.task_id
       WHERE t.organization_id = $1 AND ta.user_id = $2`,
      [orgId, userId]
    ),
    query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.progress_percent,
              t.estimated_hours, t.actual_hours,
              p.id AS project_id, p.project_code, p.name AS project_name,
              (t.status <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE) AS is_overdue
       FROM task_assignees ta
       INNER JOIN tasks t ON t.id = ta.task_id
       INNER JOIN projects p ON p.id = t.project_id
       WHERE t.organization_id = $1 AND ta.user_id = $2 AND t.status <> 'completed'
       ORDER BY is_overdue DESC, t.due_date ASC NULLS LAST, t.created_at DESC
       LIMIT 25`,
      [orgId, userId]
    ),
    query(
      `SELECT fr.id, fr.title, fr.status, fr.activity_date, fr.location_name,
              p.project_code, p.name AS project_name
       FROM field_reports fr
       INNER JOIN projects p ON p.id = fr.project_id
       WHERE fr.organization_id = $1 AND fr.submitted_by = $2
       ORDER BY fr.activity_date DESC, fr.created_at DESC
       LIMIT 10`,
      [orgId, userId]
    ),
  ]);

  return {
    summary: countsRes.rows[0],
    myTasks: myTasksRes.rows,
    myRecentReports: myReportsRes.rows,
  };
}

export async function getExportRows(orgId, reportType, { projectId } = {}) {
  const params = [orgId];
  const projFilter = projectId ? 'AND project_id = $2' : '';
  if (projectId) params.push(projectId);

  switch (reportType) {
    case 'projects': {
      const { rows } = await query(
        `SELECT project_code, name, status, priority, location_name, start_date, expected_end_date, actual_completion_date
         FROM projects
         WHERE organization_id = $1 AND is_archived = FALSE
         ORDER BY created_at DESC`,
        [orgId]
      );
      return {
        rows,
        columns: [
          { key: 'project_code', header: 'Project Code' },
          { key: 'name', header: 'Project Name' },
          { key: 'status', header: 'Status' },
          { key: 'priority', header: 'Priority' },
          { key: 'location_name', header: 'Location' },
          { key: 'start_date', header: 'Start Date' },
          { key: 'expected_end_date', header: 'Expected End Date' },
          { key: 'actual_completion_date', header: 'Actual Completion' },
        ],
      };
    }
    case 'tasks': {
      const { rows } = await query(
        `SELECT p.project_code, t.title, t.status, t.priority, t.start_date, t.due_date,
                t.estimated_hours, t.actual_hours, t.progress_percent
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         WHERE t.organization_id = $1 ${projectId ? 'AND t.project_id = $2' : ''}
         ORDER BY t.due_date ASC NULLS LAST`,
        params
      );
      return {
        rows,
        columns: [
          { key: 'project_code', header: 'Project' },
          { key: 'title', header: 'Task Title' },
          { key: 'status', header: 'Status' },
          { key: 'priority', header: 'Priority' },
          { key: 'start_date', header: 'Start Date' },
          { key: 'due_date', header: 'Due Date' },
          { key: 'estimated_hours', header: 'Estimated Hours' },
          { key: 'actual_hours', header: 'Actual Hours' },
          { key: 'progress_percent', header: 'Progress (%)' },
        ],
      };
    }
    case 'expenses': {
      const { rows } = await query(
        `SELECT p.project_code, e.title, e.category, e.expense_date, e.amount, e.vendor_name, e.status,
                u.full_name AS submitted_by
         FROM expenses e
         INNER JOIN projects p ON p.id = e.project_id
         INNER JOIN users u ON u.id = e.submitted_by
         WHERE e.organization_id = $1 ${projectId ? 'AND e.project_id = $2' : ''}
         ORDER BY e.expense_date DESC`,
        params
      );
      return {
        rows,
        columns: [
          { key: 'project_code', header: 'Project' },
          { key: 'title', header: 'Expense Title' },
          { key: 'category', header: 'Category' },
          { key: 'expense_date', header: 'Expense Date' },
          { key: 'amount', header: 'Amount' },
          { key: 'vendor_name', header: 'Vendor' },
          { key: 'status', header: 'Status' },
          { key: 'submitted_by', header: 'Submitted By' },
        ],
      };
    }
    case 'field-reports': {
      const { rows } = await query(
        `SELECT p.project_code, fr.title, fr.activity_date, fr.location_name,
                fr.progress_contribution_pct, fr.status, u.full_name AS submitted_by
         FROM field_reports fr
         INNER JOIN projects p ON p.id = fr.project_id
         INNER JOIN users u ON u.id = fr.submitted_by
         WHERE fr.organization_id = $1 ${projectId ? 'AND fr.project_id = $2' : ''}
         ORDER BY fr.activity_date DESC`,
        params
      );
      return {
        rows,
        columns: [
          { key: 'project_code', header: 'Project' },
          { key: 'title', header: 'Report Title' },
          { key: 'activity_date', header: 'Activity Date' },
          { key: 'location_name', header: 'Location' },
          { key: 'progress_contribution_pct', header: 'Progress Contribution (%)' },
          { key: 'status', header: 'Status' },
          { key: 'submitted_by', header: 'Submitted By' },
        ],
      };
    }
    case 'risks': {
      const { rows } = await query(
        `SELECT p.project_code, r.title, r.probability, r.impact, r.severity, r.status, r.review_date, r.mitigation_plan
         FROM risks r
         INNER JOIN projects p ON p.id = r.project_id
         WHERE r.organization_id = $1 ${projFilter.replace('project_id', 'r.project_id')}
         ORDER BY r.severity DESC`,
        params
      );
      return {
        rows,
        columns: [
          { key: 'project_code', header: 'Project' },
          { key: 'title', header: 'Risk Title' },
          { key: 'probability', header: 'Probability (1-5)' },
          { key: 'impact', header: 'Impact (1-5)' },
          { key: 'severity', header: 'Severity Score' },
          { key: 'status', header: 'Status' },
          { key: 'review_date', header: 'Review Date' },
          { key: 'mitigation_plan', header: 'Mitigation Plan' },
        ],
      };
    }
    default:
      return null;
  }
}
