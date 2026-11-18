import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Clock, Flag, Plus } from 'lucide-react';
import { milestonesApi, projectsApi, orgsApi } from '../api/endpoints.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  PageHeader,
  StatusBadge,
  inputClass,
  labelClass,
} from '../components/ui/Primitives.jsx';
import { formatDate } from '../utils/format.js';

export default function ProjectTimelinePage() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();

  const [activeProjectId, setActiveProjectId] = useState(projectId || '');
  const [isCreateMilestoneOpen, setIsCreateMilestoneOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    targetDate: '',
    description: '',
    ownerId: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-simple'],
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const projects = projectsData?.data?.items || [];
  const currentProjectId = activeProjectId || projects[0]?.id;

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => orgsApi.listMembers(),
  });

  const { data: timelineData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['timeline', currentProjectId],
    queryFn: () => milestonesApi.getTimeline(currentProjectId),
    enabled: Boolean(currentProjectId),
  });

  const createMilestoneMutation = useMutation({
    mutationFn: (payload) => milestonesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', currentProjectId] });
      setIsCreateMilestoneOpen(false);
      setNewMilestone({ title: '', targetDate: '', description: '', ownerId: '' });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, status }) => milestonesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', currentProjectId] });
    },
  });

  const handleMilestoneSubmit = (e) => {
    e.preventDefault();
    if (!newMilestone.title.trim() || !newMilestone.targetDate) return;
    createMilestoneMutation.mutate({
      projectId: currentProjectId,
      title: newMilestone.title.trim(),
      targetDate: newMilestone.targetDate,
      description: newMilestone.description.trim() || undefined,
      ownerId: newMilestone.ownerId || undefined,
    });
  };

  const timeline = timelineData?.data;
  const project = timeline?.project;
  const milestones = timeline?.milestones || [];
  const tasks = timeline?.tasks || [];
  const members = membersData?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Milestones & Gantt Timeline"
        subtitle="Visualize critical path dependencies, target dates, and phase progress."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentProjectId}
              onChange={(e) => setActiveProjectId(e.target.value)}
              className={`${inputClass} w-auto`}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
            <Button onClick={() => setIsCreateMilestoneOpen(true)} disabled={!currentProjectId}>
              <Plus className="h-4 w-4" /> Add Milestone
            </Button>
          </div>
        }
      />

      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorBanner message={error?.response?.data?.message} onRetry={refetch} />}

      {!isLoading && !isError && !timeline && (
        <EmptyState
          title="Select a project to view its Gantt timeline"
          description="Track phases, critical milestones, and DAG task flow."
        />
      )}

      {!isLoading && !isError && timeline && (
        <>
          {/* Project Header Info */}
          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    [{project.project_code}]
                  </span>
                  <StatusBadge value={project.status} />
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {project.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Timeline Window:{' '}
                  {project.start_date ? formatDate(project.start_date) : 'Start TBD'} &rarr;{' '}
                  {project.expected_end_date ? formatDate(project.expected_end_date) : 'End TBD'}
                </p>
              </div>

              <div className="flex items-center gap-4 text-center">
                <div>
                  <p className="text-xs uppercase text-slate-400">Milestones</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {milestones.filter((m) => m.status === 'completed').length} / {milestones.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Tasks</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {tasks.filter((t) => t.status === 'completed').length} / {tasks.length}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Milestones Cards */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Project Milestones
            </h3>
            {milestones.length === 0 ? (
              <Card className="p-6 text-center text-xs text-slate-400">
                No milestones defined for this project yet. Click &quot;Add Milestone&quot; to establish key delivery gates.
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {milestones.map((m) => {
                  const percent =
                    m.total_tasks > 0
                      ? Math.round((m.completed_tasks / m.total_tasks) * 100)
                      : m.status === 'completed'
                      ? 100
                      : 0;

                  return (
                    <Card key={m.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-blue-500" />
                          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                            {m.title}
                          </h4>
                        </div>
                        <StatusBadge value={m.status} />
                      </div>

                      {m.description && (
                        <p className="mt-2 text-xs text-slate-500 line-clamp-2 dark:text-slate-400">
                          {m.description}
                        </p>
                      )}

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>Progress ({m.completed_tasks}/{m.total_tasks} tasks)</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{percent}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                        <span className={`flex items-center gap-1 ${m.is_overdue ? 'text-rose-500 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                          <Clock className="h-3 w-3" />
                          Target: {formatDate(m.target_date)}
                        </span>

                        <select
                          value={m.status}
                          onChange={(e) =>
                            updateMilestoneMutation.mutate({ id: m.id, status: e.target.value })
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="missed">Missed</option>
                        </select>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gantt Timeline View */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Gantt Execution Timeline
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visual mapping of planned vs completed tasks with duration spans.
                </p>
              </div>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400">No tasks created for this project yet.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const statusColors = {
                    completed: 'bg-emerald-500',
                    in_progress: 'bg-blue-500',
                    in_review: 'bg-indigo-500',
                    blocked: 'bg-rose-500',
                    todo: 'bg-slate-400',
                    backlog: 'bg-slate-300 dark:bg-slate-700',
                  };
                  const barColor = statusColors[task.status] || 'bg-blue-500';

                  return (
                    <div
                      key={task.id}
                      className="group flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs transition hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/40"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge value={task.status} />
                          <Link
                            to={`/tasks/${task.id}`}
                            className="font-medium text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                          >
                            {task.title}
                          </Link>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                          <span>
                            {task.start_date ? formatDate(task.start_date) : 'Start —'} &rarr;{' '}
                            {task.due_date ? formatDate(task.due_date) : 'Due —'}
                          </span>
                          <StatusBadge value={task.priority} />
                        </div>
                      </div>

                      {/* Visual Timeline Bar */}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className={`h-full ${barColor} transition-all`}
                            style={{
                              width:
                                task.status === 'completed'
                                  ? '100%'
                                  : task.progress_percent
                                  ? `${task.progress_percent}%`
                                  : '40%',
                            }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-[11px] text-slate-400">
                          {task.status === 'completed'
                            ? '100%'
                            : `${task.progress_percent || 0}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Create Milestone Modal */}
      <Modal
        open={isCreateMilestoneOpen}
        onClose={() => setIsCreateMilestoneOpen(false)}
        title="Establish Project Milestone"
      >
        <form onSubmit={handleMilestoneSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Milestone Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Phase 1: Substructure & Foundation Pour"
              value={newMilestone.title}
              onChange={(e) => setNewMilestone((prev) => ({ ...prev, title: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Target Completion Date *</label>
            <input
              type="date"
              required
              value={newMilestone.targetDate}
              onChange={(e) => setNewMilestone((prev) => ({ ...prev, targetDate: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Milestone Owner</label>
            <select
              value={newMilestone.ownerId}
              onChange={(e) => setNewMilestone((prev) => ({ ...prev, ownerId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select Team Member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Description / Delivery Criteria</label>
            <textarea
              rows={3}
              placeholder="Key deliverable specifications or sign-off criteria..."
              value={newMilestone.description}
              onChange={(e) =>
                setNewMilestone((prev) => ({ ...prev, description: e.target.value }))
              }
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCreateMilestoneOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMilestoneMutation.isPending}>
              {createMilestoneMutation.isPending ? 'Creating...' : 'Create Milestone'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
