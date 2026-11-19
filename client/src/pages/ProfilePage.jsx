import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { authApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Button,
  Card,
  LoadingSkeleton,
  PageHeader,
  inputClass,
  labelClass,
} from '../components/ui/Primitives.jsx';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [profileForm, setProfileForm] = useState({
    fullName: '',
    jobTitle: '',
    phone: '',
    avatarUrl: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authApi.me(),
  });

  useEffect(() => {
    if (data?.data) {
      setProfileForm({
        fullName: data.data.full_name || '',
        jobTitle: data.data.job_title || '',
        phone: data.data.phone || '',
        avatarUrl: data.data.avatar_url || '',
      });
    }
  }, [data]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload) => authApi.updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      setProfileSuccess('Profile updated successfully.');
      setTimeout(() => setProfileSuccess(''), 4000);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setPasswordSuccess('Password changed successfully.');
      setPasswordError('');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(''), 4000);
    },
    onError: (err) => {
      setPasswordError(err?.response?.data?.message || 'Failed to change password.');
    },
  });

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    if (!profileForm.fullName.trim()) return;
    updateProfileMutation.mutate({
      fullName: profileForm.fullName.trim(),
      jobTitle: profileForm.jobTitle.trim() || undefined,
      phone: profileForm.phone.trim() || undefined,
      avatarUrl: profileForm.avatarUrl.trim() || undefined,
    });
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordError('');
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Personal Profile & Security"
        subtitle="Manage your credentials, notification contact information, and account password."
      />

      {isLoading && <LoadingSkeleton rows={5} />}

      {!isLoading && (
        <div className="space-y-6">
          {/* Profile Form */}
          <Card className="p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Profile Details
            </h3>

            {profileSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                {profileSuccess}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Email Address (Read-Only)</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className={`${inputClass} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed`}
                />
              </div>

              <div>
                <label className={labelClass}>Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Job Title / Operational Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Structural Engineer"
                    value={profileForm.jobTitle}
                    onChange={(e) => setProfileForm((p) => ({ ...p, jobTitle: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 234-5678"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              {updateProfileMutation.isError && (
                <p className="text-xs text-rose-500">
                  {updateProfileMutation.error?.response?.data?.message || 'Failed to update profile.'}
                </p>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Change Password Form */}
          <Card className="p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Change Security Password
            </h3>

            {passwordSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500">
                {passwordError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Current Password *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 chars, 1 uppercase, 1 digit"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? 'Updating...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
