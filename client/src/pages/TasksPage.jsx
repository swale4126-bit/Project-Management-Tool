import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Kanban,
  List as ListIcon,
  Plus,
  Search,
} from 'lucide-react';
import { projectsApi, tasksApi, orgsApi, milestonesApi } from '../api/endpoints.js';
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

const STATUS_COLUMNS = [
  { key: 'backlog', label: 'Backlog', accent: 'border-slate-500' },
  { key: 'todo', label: 'To Do', accent: 'border-blue-500' },
  { key: 'in_progress', label: 'In Progress', accent: 'border-amber-500' },
  { key: 'in_review', label: 'In Review', accent: 'border-indigo-500' },
  { key: 'blocked', label: 'Blocked', accent: 'border-rose-500' },
  { key: 'completed', label: 'Completed', accent: 'border-emerald-500' },
];

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState({
    projectId: '',
    milestoneId: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    dueDate: '',
    estimatedHours: '',
    assigneeIds: [],
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-simple'],
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => orgsApi.listMembers(),
  });

  const { data: milestonesData } = useQuery({
    queryKey: ['milestones', newTask.projectId],
    queryFn: () => milestonesApi.list({ projectId: newTask.projectId, limit: 100 }),
    enabled: Boolean(newTask.projectId),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'tasks',
      { search, projectId: selectedProject, priority: selectedPriority, status: selectedStatus, overdue: isOverdueOnly },
    ],
    queryFn: () =>
      tasksApi.list({
        search: search || undefined,
        projectId: selectedProject || undefined,
        priority: selectedPriority || undefined,
        status: selectedStatus || undefined,
        overdue: isOverdueOnly ? true : undefined,
        limit: 100,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }) => tasksApi.update(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-org'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload) => tasksApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsCreateOpen(false);
      setNewTask({
        projectId: '',
        milestoneId: '',
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        dueDate: '',
        estimatedHours: '',
        assigneeIds: [],
      });
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTask.projectId || !newTask.title.trim()) return;

    createTaskMutation.mutate({
      projectId: newTask.projectId,
      milestoneId: newTask.milestoneId || undefined,
      title: newTask.title.trim(),
      description: newTask.description.trim() || undefined,
      priority: newTask.priority,
      status: newTask.status,
      dueDate: newTask.dueDate || undefined,
      estimatedHours: newTask.estimatedHours ? Number(newTask.estimatedHours) : undefined,
      assigneeIds: newTask.assigneeIds.length > 0 ? newTask.assigneeIds : undefined,
    });
  };

  const tasks = data?.data?.items || [];
  const projects = projectsData?.data?.items || [];
  const members = membersData?.data || [];
  const milestones = milestonesData?.data?.items || [];

  return (
    <div>
      <PageHeader
        title="Tasks & Operations"
        subtitle="Manage sprint tasks, track blocker dependencies, and execute field operations."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === 'kanban'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                List
              </button>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>

          <div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className={inputClass}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className={inputClass}
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={inputClass}
            >
              <option value="">All Statuses</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isOverdueOnly}
                onChange={(e) => setIsOverdueOnly(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="flex items-center gap-1 text-rose-500 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overdue Only
              </span>
            </label>
            {(search || selectedProject || selectedPriority || selectedStatus || isOverdueOnly) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedProject('');
                  setSelectedPriority('');
                  setSelectedStatus('');
                  setIsOverdueOnly(false);
                }}
                className="ml-auto text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Loading & Error States */}
      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorBanner message={error?.response?.data?.message} onRetry={refetch} />}

      {/* Main View */}
      {!isLoading && !isError && tasks.length === 0 && (
        <EmptyState
          title="No tasks match your filters"
          description="Adjust your search criteria or create a new task to track field activities."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create First Task
            </Button>
          }
        />
      )}

      {!isLoading && !isError && tasks.length > 0 && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-4 md:grid-cols-3 xl:grid-cols-6">
          {STATUS_COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800/80 dark:bg-slate-900/40"
              >
                <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {col.label}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                      Empty
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <Card
                        key={task.id}
                        className="group relative p-3.5 transition hover:border-blue-500/50 hover:shadow-md"
                      >
                        <div className="mb-2 flex items-center justify-between gap-1 text-[11px]">
                          <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                            {task.project_code}
                          </span>
                          <StatusBadge value={task.priority} />
                        </div>

                        <Link
                          to={`/tasks/${task.id}`}
                          className="font-medium text-sm text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                        >
                          {task.title}
                        </Link>

                        {task.milestone_title && (
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            🏁 {task.milestone_title}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span className={task.is_overdue ? 'font-semibold text-rose-500' : ''}>
                              {task.due_date ? formatDate(task.due_date) : 'No due date'}
                            </span>
                          </div>

                          {task.assignees?.length > 0 && (
                            <div className="flex -space-x-1.5">
                              {task.assignees.slice(0, 3).map((a) => (
                                <span
                                  key={a.id}
                                  title={a.fullName}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-1 ring-white dark:ring-slate-900"
                                >
                                  {a.fullName.charAt(0)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Quick Status Dropdown */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                          <label className="text-[10px] text-slate-400">Move:</label>
                          <select
                            value={task.status}
                            onChange={(e) =>
                              updateStatusMutation.mutate({ taskId: task.id, status: e.target.value })
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <option value="backlog">Backlog</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="blocked">Blocked</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && tasks.length > 0 && viewMode === 'list' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Task Title</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Assignees</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      <Link
                        to={`/tasks/${task.id}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {task.title}
                      </Link>
                      {task.milestone_title && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          🏁 {task.milestone_title}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                        [{task.project_code}]
                      </span>{' '}
                      <span className="text-xs">{task.project_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={task.status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={task.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs ${
                          task.is_overdue ? 'font-semibold text-rose-500' : 'text-slate-500'
                        }`}
                      >
                        {task.due_date ? formatDate(task.due_date) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {task.assignees?.length > 0 ? (
                        <div className="flex -space-x-1.5">
                          {task.assignees.map((a) => (
                            <span
                              key={a.id}
                              title={a.fullName}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900"
                            >
                              {a.fullName.charAt(0)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/tasks/${task.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Task Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Operational Task"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Project *</label>
            <select
              required
              value={newTask.projectId}
              onChange={(e) =>
                setNewTask((prev) => ({ ...prev, projectId: e.target.value, milestoneId: '' }))
              }
              className={inputClass}
            >
              <option value="">Select Target Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Inspect foundation pilings and reinforce rebar"
              value={newTask.title}
              onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              rows={3}
              placeholder="Operational instructions, acceptance criteria, or field notes..."
              value={newTask.description}
              onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Milestone (Optional)</label>
              <select
                disabled={!newTask.projectId}
                value={newTask.milestoneId}
                onChange={(e) => setNewTask((prev) => ({ ...prev, milestoneId: e.target.value }))}
                className={inputClass}
              >
                <option value="">No Milestone Linked</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Priority</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value }))}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Due Date</label>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Estimated Hours</label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 16"
                value={newTask.estimatedHours}
                onChange={(e) => setNewTask((prev) => ({ ...prev, estimatedHours: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Assignees</label>
            <select
              multiple
              value={newTask.assigneeIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                setNewTask((prev) => ({ ...prev, assigneeIds: selected }));
              }}
              className={`${inputClass} h-24`}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Hold Ctrl (or Cmd) to select multiple assignees.</p>
          </div>

          {createTaskMutation.isError && (
            <p className="text-xs text-rose-500">
              {createTaskMutation.error?.response?.data?.message || 'Failed to create task.'}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
