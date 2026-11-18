import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Calendar,
  Download,
  FileText,
  MapPin,
  Upload,
  Users,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { activityApi, analyticsApi, projectsApi } from '../api/endpoints.js';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  canContribute,
  canManageProject,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatLabel,
} from '../utils/format.js';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  PageHeader,
  StatusBadge,
  inputClass,
  labelClass,
} from '../components/ui/Primitives.jsx';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#64748b'];

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const { activeOrg, activeRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('general');
  const [docFile, setDocFile] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const { data: projRes, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getById(projectId),
  });

  const { data: analyticsRes } = useQuery({
    queryKey: ['analytics', 'project', projectId],
    queryFn: () => analyticsApi.getProject(projectId),
  });

  const { data: docsRes } = useQuery({
    queryKey: ['projects', projectId, 'documents'],
    queryFn: () => projectsApi.listDocuments(projectId),
  });

  const { data: actRes } = useQuery({
    queryKey: ['activity-logs', { projectId }],
    queryFn: () => activityApi.list({ projectId, limit: 10 }),
  });

  const archiveMutation = useMutation({
    mutationFn: (isArchived) => projectsApi.archive(projectId, isArchived),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setArchiveOpen(false);
      navigate('/projects');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('title', docTitle);
      formData.append('category', docCategory);
      formData.append('file', docFile);
      return projectsApi.uploadDocument(projectId, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs', { projectId }] });
      setUploadOpen(false);
      setDocTitle('');
      setDocFile(null);
      setUploadError('');
    },
    onError: (err) => setUploadError(getApiErrorMessage(err)),
  });

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (isError) return <ErrorBanner message={getApiErrorMessage(error)} onRetry={refetch} />;

  const project = projRes?.data;
  const analytics = analyticsRes?.data;
  const documents = docsRes?.data || [];
  const activities = actRes?.data || [];
  const currency = activeOrg?.currencyCode || 'USD';

  const taskDist = (analytics?.taskStatusDistribution || []).map((row) => ({
    name: formatLabel(row.status),
    value: row.count,
  }));

  const gaugeData = [
    { name: 'Completed', value: project.metrics.completionPercent },
    { name: 'Remaining', value: Math.max(0, 100 - project.metrics.completionPercent) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`[${project.projectCode}] ${project.name}`}
        subtitle={project.description || 'Field project overview, metrics, documents, and audit trail.'}
        actions={
          <>
            <StatusBadge value={project.priority} />
            <StatusBadge value={project.status} />
            {canManageProject(activeRole) && (
              <Button variant="secondary" size="sm" onClick={() => setArchiveOpen(true)}>
                <Archive className="h-4 w-4" />
                {project.isArchived ? 'Restore' : 'Archive'}
              </Button>
            )}
          </>
        }
      />

      {/* Project Sub-Navigation Bar (Sample 2 Top Inspired) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { label: 'Overview', to: `/projects/${projectId}`, active: true },
          { label: 'Task Board', to: `/tasks?projectId=${projectId}` },
          { label: 'Milestones & Timeline', to: `/projects/${projectId}/timeline` },
          { label: 'Project Team', to: `/projects/${projectId}/team` },
          { label: 'Field Reports', to: `/field-reports?projectId=${projectId}` },
          { label: 'Budget & Expenses', to: `/budgets?projectId=${projectId}` },
          { label: 'Risks & Issues', to: `/risks?projectId=${projectId}` },
        ].map((tab) => (
          <Link
            key={tab.label}
            to={tab.to}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab.active
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Top Row: Gauge + Task Status Donut + Budget Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Overall Task Completion
          </h3>
          <div className="relative h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  startAngle={180}
                  endAngle={0}
                  innerRadius={58}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#1e293b" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-10">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {project.metrics.completionPercent}%
              </span>
              <span className="text-xs text-slate-400">
                {project.metrics.completedTasks} / {project.metrics.totalTasks} tasks done
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Task Status Breakdown
          </h3>
          <div className="h-48">
            {taskDist.length === 0 ? (
              <p className="pt-16 text-center text-xs text-slate-400">No tasks created yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskDist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {taskDist.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Budget &amp; Risk Snapshot
            </h3>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Planned Budget</span>
                <span className="font-semibold">
                  {formatCurrency(project.metrics.plannedBudget, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Approved Spend</span>
                <span className="font-semibold text-emerald-500">
                  {formatCurrency(project.metrics.approvedSpend, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Remaining Balance</span>
                <span className="font-semibold text-blue-500">
                  {formatCurrency(project.metrics.remainingBudget, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Open / High Risks</span>
                <span className="font-semibold text-rose-500">
                  {project.metrics.openRisks} ({project.metrics.highRisks} critical)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              <span>{project.locationName || 'Location TBD'}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {formatDate(project.startDate)} → {formatDate(project.expectedEndDate)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              <span>Manager: {project.managerName || 'Unassigned'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Grid: Objectives + Documents + Activity */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Objectives &amp; Success Indicators
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Objectives</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  {project.objectives || 'No objectives recorded yet.'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Success Indicators</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  {project.successIndicators || 'No success indicators recorded yet.'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Project Documents ({documents.length})
              </h3>
              {canContribute(activeRole) && (
                <Button size="sm" variant="secondary" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-3.5 w-3.5" />
                  Upload Document
                </Button>
              )}
            </div>
            <div className="mt-4 space-y-2.5">
              {documents.length === 0 ? (
                <p className="text-xs text-slate-400">No documents uploaded to this project yet.</p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-white">
                          {doc.title}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {doc.original_name} • {formatLabel(doc.category)} • {doc.uploaded_by_name}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => projectsApi.downloadDocument(doc.id, doc.original_name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card className="p-5 lg:col-span-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Project Audit History
          </h3>
          <div className="mt-4 space-y-3">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400">No activity recorded yet.</p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="border-l-2 border-blue-500/40 pl-3 text-xs">
                  <p className="text-slate-800 dark:text-slate-200">{a.summary}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {a.actor_name || 'System'} • {formatDateTime(a.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Upload Document Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Project Document">
        {uploadError && (
          <div className="mb-4">
            <ErrorBanner message={uploadError} />
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            uploadMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Document Title</label>
            <input
              required
              placeholder="Site Safety Inspection Permit"
              className={inputClass}
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select
              className={inputClass}
              value={docCategory}
              onChange={(e) => setDocCategory(e.target.value)}
            >
              <option value="general">General</option>
              <option value="blueprint">Blueprint</option>
              <option value="permit">Permit</option>
              <option value="contract">Contract</option>
              <option value="report">Report</option>
              <option value="safety">Safety</option>
              <option value="financial">Financial</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>File (PDF, Image, CSV, DOCX, XLSX — max 5 MB)</label>
            <input
              required
              type="file"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploadMutation.isPending || !docFile}>
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => archiveMutation.mutate(!project.isArchived)}
        title={project.isArchived ? 'Restore Project?' : 'Archive Project?'}
        message={
          project.isArchived
            ? 'This project will reappear on active dashboards.'
            : 'Archived projects are hidden from active lists while preserving all history, tasks, and financial records.'
        }
        confirmLabel={project.isArchived ? 'Restore' : 'Archive Project'}
        variant={project.isArchived ? 'primary' : 'danger'}
        isPending={archiveMutation.isPending}
      />
    </div>
  );
}
