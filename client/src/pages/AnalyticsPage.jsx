import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import { analyticsApi, projectsApi } from '../api/endpoints.js';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingSkeleton,
  PageHeader,
  StatCard,
  inputClass,
} from '../components/ui/Primitives.jsx';
import { formatCurrency } from '../utils/format.js';

const STATUS_COLORS = {
  active: '#3b82f6',
  completed: '#10b981',
  at_risk: '#f43f5e',
  planning: '#6366f1',
  on_hold: '#f59e0b',
};

export default function AnalyticsPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [downloadingType, setDownloadingType] = useState(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-simple'],
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics-org', { fromDate, toDate }],
    queryFn: () =>
      analyticsApi.getOrganization({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
  });

  const handleExport = async (type) => {
    try {
      setDownloadingType(type);
      await analyticsApi.exportCsv(type, selectedProject || undefined);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setDownloadingType(null);
    }
  };

  const analytics = data?.data || {};
  const projects = projectsData?.data?.items || [];

  const kpis = analytics.kpis || {};
  const monthlyTrend = analytics.monthlyTrend || [];
  const projectsByStatus = analytics.projectsByStatus || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Analytics & Audit Exports"
        subtitle="Cross-project execution velocity, budget burn rates, and formula-safe CSV exports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={`${inputClass} w-auto text-xs py-1`}
              />
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={`${inputClass} w-auto text-xs py-1`}
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
              >
                Reset
              </Button>
            )}
          </div>
        }
      />

      {isLoading && <LoadingSkeleton rows={6} />}
      {isError && <ErrorBanner message={error?.response?.data?.message} onRetry={refetch} />}

      {!isLoading && !isError && (
        <>
          {/* Executive KPI Overview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Capital Planned"
              value={formatCurrency(kpis.totalPlannedCents || 0)}
              icon={DollarSign}
              accent="blue"
            />
            <StatCard
              label="Approved Spend"
              value={formatCurrency(kpis.totalSpentCents || 0)}
              sublabel={`${kpis.utilizationPct || 0}% utilization`}
              icon={TrendingUp}
              accent="emerald"
            />
            <StatCard
              label="Task Completion Rate"
              value={`${kpis.totalTasks > 0 ? Math.round((kpis.completedTasks / kpis.totalTasks) * 100) : 0}%`}
              sublabel={`${kpis.completedTasks || 0} of ${kpis.totalTasks || 0} completed`}
              icon={CheckCircle2}
              accent="indigo"
            />
            <StatCard
              label="Critical Risks Active"
              value={kpis.criticalRisksCount || 0}
              sublabel={kpis.criticalRisksCount > 0 ? 'Requires attention' : 'No critical risks'}
              icon={AlertTriangle}
              accent={kpis.criticalRisksCount > 0 ? 'rose' : 'emerald'}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 6-Month Velocity Bar Chart */}
            <Card className="p-6 lg:col-span-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                6-Month Execution Velocity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks completed vs approved field activity reports per month.
              </p>

              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        color: '#fff',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="completedTasks"
                      name="Completed Tasks"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="approvedReports"
                      name="Approved Field Reports"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Project Distribution Pie Chart */}
            <Card className="p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Project Health Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Breakdown of projects by current operational status.
              </p>

              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectsByStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {projectsByStatus.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={STATUS_COLORS[entry.status] || '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Formula-Safe CSV Export Center */}
          <Card className="p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Compliance & Audit CSV Export Center
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Export structured datasets for stakeholders and auditors. Built-in OWASP formula
                  injection defense neutralizes executable spreadsheet payloads.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filter Project:</span>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className={`${inputClass} w-auto text-xs`}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.project_code}] {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Button
                variant="secondary"
                className="flex flex-col items-start gap-1 p-4 text-left h-auto"
                disabled={Boolean(downloadingType)}
                onClick={() => handleExport('projects')}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">
                    Projects Dataset
                  </span>
                  <ArrowDownToLine className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-[10px] text-slate-400">
                  {downloadingType === 'projects' ? 'Generating...' : 'Budgets, dates, KPIs'}
                </span>
              </Button>

              <Button
                variant="secondary"
                className="flex flex-col items-start gap-1 p-4 text-left h-auto"
                disabled={Boolean(downloadingType)}
                onClick={() => handleExport('tasks')}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">
                    Tasks & Milestones
                  </span>
                  <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-[10px] text-slate-400">
                  {downloadingType === 'tasks' ? 'Generating...' : 'Assignments & hours'}
                </span>
              </Button>

              <Button
                variant="secondary"
                className="flex flex-col items-start gap-1 p-4 text-left h-auto"
                disabled={Boolean(downloadingType)}
                onClick={() => handleExport('expenses')}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">
                    Expenses & Spend
                  </span>
                  <ArrowDownToLine className="h-4 w-4 text-amber-500" />
                </div>
                <span className="text-[10px] text-slate-400">
                  {downloadingType === 'expenses' ? 'Generating...' : 'Vendors, receipts, approvals'}
                </span>
              </Button>

              <Button
                variant="secondary"
                className="flex flex-col items-start gap-1 p-4 text-left h-auto"
                disabled={Boolean(downloadingType)}
                onClick={() => handleExport('field-reports')}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">
                    Field Reports
                  </span>
                  <ArrowDownToLine className="h-4 w-4 text-indigo-500" />
                </div>
                <span className="text-[10px] text-slate-400">
                  {downloadingType === 'field-reports' ? 'Generating...' : 'Inspections & GPS logs'}
                </span>
              </Button>

              <Button
                variant="secondary"
                className="flex flex-col items-start gap-1 p-4 text-left h-auto"
                disabled={Boolean(downloadingType)}
                onClick={() => handleExport('risks')}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">
                    Risk Register
                  </span>
                  <ArrowDownToLine className="h-4 w-4 text-rose-500" />
                </div>
                <span className="text-[10px] text-slate-400">
                  {downloadingType === 'risks' ? 'Generating...' : '5x5 scores & mitigation'}
                </span>
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
