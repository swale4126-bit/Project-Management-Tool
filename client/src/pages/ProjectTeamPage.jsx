import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, UserPlus, Users } from 'lucide-react';
import { orgsApi, projectsApi } from '../api/endpoints.js';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { canManageProject, formatLabel } from '../utils/format.js';
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

export default function ProjectTeamPage() {
  const { projectId } = useParams();
  const { activeOrg, activeRole } = useAuth();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [projectRole, setProjectRole] = useState('member');
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState('40');
  const [formError, setFormError] = useState('');

  const { data: teamRes, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectsApi.listMembers(projectId),
  });

  const { data: orgMembersRes } = useQuery({
    queryKey: ['organizations', 'members', activeOrg?.id],
    queryFn: () => orgsApi.listMembers(),
    enabled: canManageProject(activeRole),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      projectsApi.addMember(projectId, {
        userId,
        projectRole,
        weeklyCapacityHours: Number(weeklyCapacityHours),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
      setAddOpen(false);
      setUserId('');
      setFormError('');
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (targetUserId) => projectsApi.removeMember(projectId, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
    },
  });

  const team = teamRes?.data || [];
  const orgMembers = orgMembersRes?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Team & Capacity"
        subtitle="Manage assigned personnel, project roles, and weekly capacity allocation."
        actions={
          <>
            <Link to={`/projects/${projectId}`}>
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" />
                Back to Project
              </Button>
            </Link>
            {canManageProject(activeRole) && (
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Assign Member
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorBanner message={getApiErrorMessage(error)} onRetry={refetch} />
      ) : team.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members assigned yet"
          description="Assign organization members to collaborate on tasks and field reports."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-4 py-3">Project Role</th>
                  <th className="px-4 py-3">Weekly Capacity</th>
                  <th className="px-4 py-3">Active / Total Tasks</th>
                  {canManageProject(activeRole) && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {team.map((m) => (
                  <tr key={m.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-white">{m.full_name}</p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge value={m.project_role === 'manager' ? 'active' : 'planning'} />{' '}
                      <span className="ml-1 text-xs text-slate-400">{formatLabel(m.project_role)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm">{m.weekly_capacity_hours} hrs/wk</td>
                    <td className="px-4 py-3.5 text-sm">
                      {m.active_tasks} active / {m.assigned_tasks} total
                    </td>
                    {canManageProject(activeRole) && (
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeMutation.mutate(m.user_id)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Assign Member to Project">
        {formError && (
          <div className="mb-4">
            <ErrorBanner message={formError} />
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Organization Member</label>
            <select
              required
              className={inputClass}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Select a team member...</option>
              {orgMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName} ({m.email}) — {formatLabel(m.role)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Project Role</label>
              <select
                className={inputClass}
                value={projectRole}
                onChange={(e) => setProjectRole(e.target.value)}
              >
                <option value="manager">Manager</option>
                <option value="member">Team Member</option>
                <option value="stakeholder">Stakeholder (Viewer)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Weekly Capacity (Hours)</label>
              <input
                type="number"
                min="0"
                max="168"
                className={inputClass}
                value={weeklyCapacityHours}
                onChange={(e) => setWeeklyCapacityHours(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Assigning...' : 'Assign Member'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
