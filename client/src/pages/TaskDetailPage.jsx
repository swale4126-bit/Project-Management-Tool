import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileText,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { tasksApi } from '../api/endpoints.js';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  StatusBadge,
  inputClass,
  labelClass,
} from '../components/ui/Primitives.jsx';
import { formatDate, formatDateTime, formatBytes } from '../utils/format.js';

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [isAddDepOpen, setIsAddDepOpen] = useState(false);
  const [selectedDepId, setSelectedDepId] = useState('');
  const [depError, setDepError] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getById(taskId),
  });

  const { data: allTasksData } = useQuery({
    queryKey: ['tasks', 'simple-picker'],
    queryFn: () => tasksApi.list({ limit: 100 }),
    enabled: isAddDepOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => tasksApi.update(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (body) => tasksApi.addComment(taskId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setCommentText('');
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: (title) =>
      tasksApi.create({
        projectId: data?.data?.project_id,
        parentTaskId: taskId,
        title,
        status: 'todo',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setSubtaskTitle('');
    },
  });

  const addDepMutation = useMutation({
    mutationFn: (dependsOnTaskId) => tasksApi.addDependency(taskId, dependsOnTaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setIsAddDepOpen(false);
      setSelectedDepId('');
      setDepError('');
    },
    onError: (err) => {
      setDepError(err?.response?.data?.message || 'Cycle detected or invalid dependency.');
    },
  });

  const removeDepMutation = useMutation({
    mutationFn: (dependencyId) => tasksApi.removeDependency(taskId, dependencyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (formData) => tasksApi.uploadAttachment(taskId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setFileToUpload(null);
    },
  });

  const handleFileUpload = (e) => {
    e.preventDefault();
    if (!fileToUpload) return;
    const formData = new FormData();
    formData.append('file', fileToUpload);
    uploadAttachmentMutation.mutate(formData);
  };

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (isError) return <ErrorBanner message={error?.response?.data?.message} onRetry={refetch} />;

  const task = data?.data;
  if (!task) return null;

  const candidatePrereqs = (allTasksData?.data?.items || []).filter(
    (t) => t.id !== taskId && !(task.prerequisites || []).some((p) => p.task_id === t.id)
  );

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tasks
        </Link>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</label>
          <select
            value={task.status}
            onChange={(e) => updateMutation.mutate({ status: e.target.value })}
            className={`${inputClass} w-auto font-medium`}
          >
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Main Header Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                [{task.project_code}]
              </span>
              <span className="text-xs text-slate-400">•</span>
              <Link
                to={`/projects/${task.project_id}`}
                className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
              >
                {task.project_name}
              </Link>
              <StatusBadge value={task.priority} />
              {task.is_overdue && <StatusBadge value="missed" />}
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {task.title}
            </h1>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {task.description || 'No description provided.'}
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:min-w-64">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Due Date:</span>
              <span className={`font-semibold ${task.is_overdue ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                {task.due_date ? formatDate(task.due_date) : 'Unscheduled'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Milestone:</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {task.milestone_title || 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Est. Hours:</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {task.estimated_hours ? `${task.estimated_hours}h` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Created by:</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {task.creator_name}
              </span>
            </div>
          </div>
        </div>

        {/* Assignees List */}
        <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Assigned Team
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(task.assignees || []).length === 0 ? (
              <span className="text-xs text-slate-400">No assignees assigned.</span>
            ) : (
              task.assignees.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {a.full_name.charAt(0)}
                  </span>
                  <div className="text-left">
                    <p className="text-xs font-medium text-slate-900 dark:text-white">{a.full_name}</p>
                    <p className="text-[10px] text-slate-400">{a.job_title || a.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Grid: Dependencies & Subtasks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* DAG Dependencies */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                DAG Dependencies & Prerequisites
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enforced by cycle prevention algorithms.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setIsAddDepOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Prereq
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Blocked By (Prerequisites)
              </p>
              {(task.prerequisites || []).length === 0 ? (
                <p className="text-xs text-slate-400">No prerequisites. Can start immediately.</p>
              ) : (
                <div className="space-y-2">
                  {task.prerequisites.map((p) => (
                    <div
                      key={p.dependency_id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge value={p.status} />
                        <Link
                          to={`/tasks/${p.task_id}`}
                          className="font-medium text-slate-900 hover:underline dark:text-white"
                        >
                          {p.title}
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDepMutation.mutate(p.dependency_id)}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Blocks (Waiting Dependents)
              </p>
              {(task.dependents || []).length === 0 ? (
                <p className="text-xs text-slate-400">No other tasks waiting on this task.</p>
              ) : (
                <div className="space-y-2">
                  {task.dependents.map((d) => (
                    <div
                      key={d.dependency_id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge value={d.status} />
                        <Link
                          to={`/tasks/${d.task_id}`}
                          className="font-medium text-slate-900 hover:underline dark:text-white"
                        >
                          {d.title}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Subtasks / Checklist */}
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Subtasks & Field Checklist
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Break down operational work into discrete steps.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (subtaskTitle.trim()) createSubtaskMutation.mutate(subtaskTitle.trim());
            }}
            className="mb-4 flex gap-2"
          >
            <input
              type="text"
              placeholder="Add actionable subtask..."
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              className={inputClass}
            />
            <Button type="submit" size="sm" disabled={createSubtaskMutation.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          {(task.subtasks || []).length === 0 ? (
            <p className="text-xs text-slate-400">No subtasks defined yet.</p>
          ) : (
            <div className="space-y-2">
              {task.subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={st.status === 'completed'}
                      onChange={(e) =>
                        tasksApi
                          .update(st.id, {
                            status: e.target.checked ? 'completed' : 'todo',
                          })
                          .then(() => queryClient.invalidateQueries({ queryKey: ['task', taskId] }))
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className={
                        st.status === 'completed'
                          ? 'line-through text-slate-400'
                          : 'font-medium text-slate-900 dark:text-white'
                      }
                    >
                      {st.title}
                    </span>
                  </label>
                  <StatusBadge value={st.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Grid: Attachments & Comments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attachments Section */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Attachments & Blueprints
            </h2>
          </div>

          <form onSubmit={handleFileUpload} className="mb-4 flex items-center gap-2">
            <input
              type="file"
              onChange={(e) => setFileToUpload(e.target.files[0])}
              className="text-xs text-slate-500 dark:text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!fileToUpload || uploadAttachmentMutation.isPending}
            >
              Upload
            </Button>
          </form>

          {(task.attachments || []).length === 0 ? (
            <p className="text-xs text-slate-400">No files uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {task.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{att.original_name}</p>
                      <p className="text-[10px] text-slate-400">
                        {formatBytes(att.file_size_bytes)} • by {att.uploaded_by_name}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => tasksApi.downloadAttachment(att.id, att.original_name)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Comments Feed */}
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Discussion & Field Notes
            </h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (commentText.trim()) addCommentMutation.mutate(commentText.trim());
            }}
            className="mb-4 flex gap-2"
          >
            <input
              type="text"
              placeholder="Leave an operational update..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className={inputClass}
            />
            <Button type="submit" size="sm" disabled={addCommentMutation.isPending}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {(task.comments || []).length === 0 ? (
              <p className="text-xs text-slate-400">No comments yet. Start the discussion.</p>
            ) : (
              task.comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {c.author_name}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatDateTime(c.created_at)}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{c.body}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Add Dependency Modal */}
      <Modal
        open={isAddDepOpen}
        onClose={() => {
          setIsAddDepOpen(false);
          setDepError('');
        }}
        title="Add Prerequisite Task (DAG Link)"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedDepId) addDepMutation.mutate(selectedDepId);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Select Prerequisite Task *</label>
            <select
              required
              value={selectedDepId}
              onChange={(e) => setSelectedDepId(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose task that must complete before this one</option>
              {candidatePrereqs.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.project_code}] {t.title} ({t.status})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              FieldLedger prevents circular deadlocks automatically using BFS cycle checking.
            </p>
          </div>

          {depError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
              <AlertCircle className="inline mr-1 h-3.5 w-3.5" />
              {depError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddDepOpen(false);
                setDepError('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedDepId || addDepMutation.isPending}>
              {addDepMutation.isPending ? 'Validating...' : 'Link Dependency'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
