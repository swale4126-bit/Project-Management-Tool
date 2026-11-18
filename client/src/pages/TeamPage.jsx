import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { orgsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
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
import { formatDate } from '../utils/format.js';

const ORG_ROLES = [
  { value: 'org_owner', label: 'Organization Owner' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'team_member', label: 'Team Member' },
  { value: 'stakeholder', label: 'Stakeholder / Auditor' },
];

export default function TeamPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwner = user?.orgRole === 'org_owner' || user?.isSuperAdmin;

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('team_member');
  const [lastInviteToken, setLastInviteToken] = useState(null);

  const [memberToRemove, setMemberToRemove] = useState(null);
  const [roleChangeMember, setRoleChangeMember] = useState(null);
  const [newRoleValue, setNewRoleValue] = useState('team_member');

  const { data: membersData, isLoading: membersLoading, isError: membersError, refetch: refetchMembers } =
    useQuery({
      queryKey: ['org-members'],
      queryFn: () => orgsApi.listMembers(),
    });

  const { data: invitesData } = useQuery({
    queryKey: ['org-invitations'],
    queryFn: () => orgsApi.listInvitations(),
    enabled: isOwner,
  });

  const inviteMutation = useMutation({
    mutationFn: (payload) => orgsApi.createInvitation(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['org-invitations'] });
      setLastInviteToken(res.data?.token);
      setInviteEmail('');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (invId) => orgsApi.revokeInvitation(invId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-invitations'] });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, role }) => orgsApi.updateMember(memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setRoleChangeMember(null);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) => orgsApi.removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setMemberToRemove(null);
    },
  });

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  };

  const members = membersData?.data || [];
  const invitations = invitesData?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Team & RBAC Roster"
        subtitle="Manage access roles, invite engineers, and control organization administrative privileges."
        actions={
          isOwner && (
            <Button onClick={() => setIsInviteOpen(true)}>
              <Plus className="h-4 w-4" /> Invite Member
            </Button>
          )
        }
      />

      {membersLoading && <LoadingSkeleton rows={5} />}
      {membersError && <ErrorBanner message={membersError?.message} onRetry={refetchMembers} />}

      {/* Team Members Roster */}
      {!membersLoading && !membersError && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">
              Active Organization Members ({members.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Joined Date</th>
                  {isOwner && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((mem) => {
                  const isSelf = mem.user_id === user?.id;

                  return (
                    <tr key={mem.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            {mem.full_name?.charAt(0) || 'U'}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {mem.full_name} {isSelf && <span className="text-xs text-blue-500">(You)</span>}
                            </p>
                            <p className="text-xs text-slate-400">{mem.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-xs text-slate-800 dark:text-slate-200">
                          {ORG_ROLES.find((r) => r.value === mem.role)?.label || mem.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge value={mem.status || 'active'} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {mem.created_at ? formatDate(mem.created_at) : '—'}
                      </td>
                      {isOwner && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRoleChangeMember(mem);
                                setNewRoleValue(mem.role);
                              }}
                            >
                              Edit Role
                            </Button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => setMemberToRemove(mem)}
                                className="text-slate-400 hover:text-rose-500 p-1"
                                title="Remove Member"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pending Invitations Table */}
      {isOwner && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">
              Pending Invitations ({invitations.length})
            </h3>
          </div>

          {invitations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No pending invitations. Click &quot;Invite Member&quot; to send a secure token.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Invitee Email</th>
                    <th className="px-6 py-3">Assigned Role</th>
                    <th className="px-6 py-3">Sent Date</th>
                    <th className="px-6 py-3">Expires</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                        {inv.email}
                      </td>
                      <td className="px-6 py-3 text-xs capitalize">{inv.role}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {formatDate(inv.expires_at)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revokeMutation.mutate(inv.id)}
                          className="text-rose-500 hover:text-rose-600"
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Invite Member Modal */}
      <Modal open={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite Team Member">
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Invitee Email Address *</label>
            <input
              type="email"
              required
              placeholder="engineer@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Role & Access Level *</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className={inputClass}
            >
              {ORG_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {lastInviteToken && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500">
              <p className="font-semibold mb-1">Invitation generated successfully!</p>
              <p className="break-all font-mono text-[11px] bg-slate-900 p-2 rounded text-white">
                Token: {lastInviteToken}
              </p>
            </div>
          )}

          {inviteMutation.isError && (
            <p className="text-xs text-rose-500">
              {inviteMutation.error?.response?.data?.message || 'Failed to send invite.'}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsInviteOpen(false);
                setLastInviteToken(null);
              }}
            >
              Close
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        open={Boolean(roleChangeMember)}
        onClose={() => setRoleChangeMember(null)}
        title={`Change Role: ${roleChangeMember?.full_name}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (roleChangeMember) {
              updateMemberMutation.mutate({
                memberId: roleChangeMember.id,
                role: newRoleValue,
              });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Select Role *</label>
            <select
              value={newRoleValue}
              onChange={(e) => setNewRoleValue(e.target.value)}
              className={inputClass}
            >
              {ORG_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              FieldLedger prevents demoting the last active Organization Owner to avoid locked workspaces.
            </p>
          </div>

          {updateMemberMutation.isError && (
            <p className="text-xs text-rose-500">
              {updateMemberMutation.error?.response?.data?.message || 'Failed to update role.'}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRoleChangeMember(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMemberMutation.isPending}>
              {updateMemberMutation.isPending ? 'Updating...' : 'Save Role'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Remove Member Dialog */}
      <ConfirmDialog
        open={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => removeMemberMutation.mutate(memberToRemove.id)}
        isPending={removeMemberMutation.isPending}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${memberToRemove?.full_name} from this organization? Their project assignments will be unlinked.`}
        confirmLabel="Remove Member"
      />
    </div>
  );
}
