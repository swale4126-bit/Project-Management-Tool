import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, MapPin, Plus, Search, Users } from 'lucide-react';
import { projectsApi } from '../api/endpoints.js';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { canManageProject, formatCurrency, formatDate } from '../utils/format.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  inputClass,
} from '../components/ui/Primitives.jsx';

export default function ProjectsPage() {
  const { activeOrg, activeRole } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [archived, setArchived] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects', activeOrg?.id, { search, status, priority, archived }],
    queryFn: () =>
      projectsApi.list({
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        archived: String(archived),
        limit: 50,
      }),
    enabled: Boolean(activeOrg?.id),
  });

  const projects = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Plan, coordinate, and monitor all active and archived field operations."
        actions={
          canManageProject(activeRole) && (
            <Link to="/projects/new">
              <Button>
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </Link>
          )
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              placeholder="Search code, name, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="at_risk">At Risk</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputClass}
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600"
            />
            Show archived projects
          </label>
        </div>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorBanner message={getApiErrorMessage(error)} onRetry={refetch} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No matching projects found"
          description="Try adjusting your filters or launch a new project for your team."
          action={
            canManageProject(activeRole) && (
              <Link to="/projects/new">
                <Button>Create Project</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-col justify-between p-5 transition hover:border-blue-500/40">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {p.projectCode}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge value={p.priority} />
                    <StatusBadge value={p.status} />
                  </div>
                </div>

                <Link
                  to={`/projects/${p.id}`}
                  className="mt-3 block text-lg font-semibold text-slate-900 hover:text-blue-500 dark:text-white"
                >
                  {p.name}
                </Link>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {p.description}
                  </p>
                )}

                <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Task Completion</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {p.metrics.completionPercent}% ({p.metrics.completedTasks}/{p.metrics.totalTasks})
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${p.metrics.completionPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.locationName || 'No site set'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {p.metrics.teamSize}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Due {formatDate(p.expectedEndDate)}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {formatCurrency(p.metrics.approvedSpend, activeOrg?.currencyCode)} /{' '}
                    {formatCurrency(p.metrics.plannedBudget, activeOrg?.currencyCode)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
