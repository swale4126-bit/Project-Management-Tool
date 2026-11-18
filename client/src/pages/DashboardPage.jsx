import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  FolderKanban,
  MapPin,
  Plus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '../api/endpoints.js';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { canManageProject, formatCurrency, formatDate, formatDateTime } from '../utils/format.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../components/ui/Primitives.jsx';

export default function DashboardPage() {
  const { activeOrg, activeRole } = useAuth();
  const currency = activeOrg?.currencyCode || 'USD';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics', 'organization', activeOrg?.id],
    queryFn: () => analyticsApi.getOrganization(),
    enabled: Boolean(activeOrg?.id),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Operations Command Center" subtitle="Loading live organization telemetry..." />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader title="Operations Command Center" />
        <ErrorBanner message={getApiErrorMessage(error)} onRetry={refetch} />
      </div>
    );
  }

  const dashboard = data?.data;
  const kpis = dashboard?.kpis || {};
  const activeSites = dashboard?.activeSites || [];
  const watchlist = dashboard?.atRiskWatchlist || [];
  const monthlyTrend = dashboard?.monthlyTrend || [];
  const recentActivity = dashboard?.recentActivity || [];

  const progressChartData = activeSites.slice(0, 6).map((site) => ({
    name: site.project_code,
    PlannedTasks: site.task_completion_pct,
    FieldReported: Math.round(site.field_progress_pct),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${activeOrg?.name || 'Organization'} — Command Center`}
        subtitle="Real-time project execution, field progress, budget burn, and risk monitoring."
        actions={
          <>
            <Link to="/field-reports">
              <Button variant="secondary">
                <Activity className="h-4 w-4" />
                Submit Field Report
              </Button>
            </Link>
            {canManageProject(activeRole) && (
              <Link to="/projects/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Top 5 KPI Cards (Sample 1 Inspired) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active Projects"
          value={kpis.active_projects ?? 0}
          sublabel={`${kpis.total_projects ?? 0} total • ${kpis.completed_projects ?? 0} completed`}
          icon={FolderKanban}
          accent="blue"
        />
        <StatCard
          label="Team Members"
          value={kpis.total_members ?? 0}
          sublabel={`${kpis.resource_shortages ?? 0} resource shortage alerts`}
          icon={Users}
          accent="indigo"
        />
        <StatCard
          label="Overdue Tasks"
          value={kpis.overdue_tasks ?? 0}
          sublabel={`${kpis.blocked_tasks ?? 0} blocked • ${kpis.completed_tasks ?? 0}/${kpis.total_tasks ?? 0} done`}
          icon={Clock}
          accent={Number(kpis.overdue_tasks) > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="Budget Utilization"
          value={`${kpis.budget_utilization_pct ?? 0}%`}
          sublabel={`${formatCurrency(kpis.total_approved_spend, currency)} / ${formatCurrency(kpis.total_planned_budget, currency)}`}
          icon={Wallet}
          accent={Number(kpis.budget_utilization_pct) >= 85 ? 'rose' : 'emerald'}
        />
        <StatCard
          label="Critical / At Risk"
          value={kpis.at_risk_projects ?? 0}
          sublabel={`${watchlist.length} project(s) flagged to monitor`}
          icon={AlertTriangle}
          accent="rose"
        />
      </div>

      {/* Main 12-Col Command Grid */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Left 8 Columns: Active Sites Progress Table + Charts */}
        <div className="space-y-6 xl:col-span-8">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Active Projects &amp; Field Progress
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comparing task completion against manager-approved field progress
                </p>
              </div>
              <Link
                to="/projects"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {activeSites.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No active projects yet"
                  description="Create your first field project to start tracking tasks, milestones, budgets, and field progress."
                  action={
                    canManageProject(activeRole) && (
                      <Link to="/projects/new">
                        <Button>Create First Project</Button>
                      </Link>
                    )
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Project / Site</th>
                      <th className="px-4 py-3">Tasks %</th>
                      <th className="px-4 py-3">Field %</th>
                      <th className="px-4 py-3">Target End</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {activeSites.map((site) => (
                      <tr
                        key={site.id}
                        className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-3.5">
                          <Link
                            to={`/projects/${site.id}`}
                            className="font-medium text-slate-900 hover:text-blue-500 dark:text-white"
                          >
                            [{site.project_code}] {site.name}
                          </Link>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3" />
                            {site.location_name || 'Location not specified'} • {site.team_size} crew
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-500">
                            {site.task_completion_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                            {Math.round(site.field_progress_pct)}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(site.expected_end_date)}
                          {site.overdue_tasks > 0 && (
                            <span className="ml-1.5 font-semibold text-rose-500">
                              ({site.overdue_tasks} overdue)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge value={site.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            to={`/projects/${site.id}`}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Task vs. Field Progress (%)
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Real database task completion vs approved field logs
              </p>
              <div className="h-60">
                {progressChartData.length === 0 ? (
                  <p className="pt-20 text-center text-xs text-slate-400">No project metrics yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={progressChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                      <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="PlannedTasks" name="Tasks Done %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="FieldReported" name="Field Approved %" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                6-Month Execution Velocity
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Completed tasks &amp; approved field reports per month
              </p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="completed_tasks"
                      name="Completed Tasks"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="approved_reports"
                      name="Approved Reports"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        {/* Right 4 Columns: At-Risk Watchlist + Operating Locations + Recent Activity */}
        <div className="space-y-6 xl:col-span-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Projects to Monitor
              </h2>
              <span className="text-xs font-medium text-rose-500">
                {watchlist.length} flagged
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              At-risk status, overdue tasks, or &gt;=85% budget burn
            </p>
            <div className="mt-4 space-y-3">
              {watchlist.length === 0 ? (
                <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-500">
                  All active projects are currently within schedule and budget thresholds.
                </p>
              ) : (
                watchlist.map((site) => (
                  <Link
                    key={site.id}
                    to={`/projects/${site.id}`}
                    className="block rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 transition hover:bg-rose-500/15"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {site.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {site.overdue_tasks} overdue tasks • Budget {site.budget_utilization_pct}%
                        </p>
                      </div>
                      <span className="text-sm font-bold text-rose-500">
                        {site.task_completion_pct}%
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Operating Sites &amp; Coordinates
            </h2>
            <div className="mt-3 space-y-2.5">
              {activeSites.filter((s) => s.location_name).length === 0 ? (
                <p className="text-xs text-slate-400">No site locations recorded yet.</p>
              ) : (
                activeSites
                  .filter((s) => s.location_name)
                  .slice(0, 5)
                  .map((site) => (
                    <div
                      key={site.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {site.location_name}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {site.latitude !== null && site.longitude !== null
                            ? `${site.latitude.toFixed(3)}, ${site.longitude.toFixed(3)}`
                            : site.project_code}
                        </p>
                      </div>
                      <StatusBadge value={site.status} />
                    </div>
                  ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Audit Activity
            </h2>
            <div className="mt-3 space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-400">No recorded activity yet.</p>
              ) : (
                recentActivity.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="border-l-2 border-blue-500/40 pl-3 text-xs"
                  >
                    <p className="text-slate-800 dark:text-slate-200">{item.summary}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {item.actor_name || 'System'} • {formatDateTime(item.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
