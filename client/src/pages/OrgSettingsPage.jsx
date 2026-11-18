import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { orgsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingSkeleton,
  PageHeader,
  inputClass,
  labelClass,
} from '../components/ui/Primitives.jsx';

export default function OrgSettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwner = user?.orgRole === 'org_owner' || user?.isSuperAdmin;

  const [form, setForm] = useState({
    name: '',
    industry: '',
    description: '',
    currencyCode: 'USD',
    timezone: 'UTC',
  });
  const [successMsg, setSuccessMsg] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['org-current'],
    queryFn: () => orgsApi.getCurrent(),
  });

  useEffect(() => {
    if (data?.data) {
      setForm({
        name: data.data.name || '',
        industry: data.data.industry || '',
        description: data.data.description || '',
        currencyCode: data.data.currency_code || 'USD',
        timezone: data.data.timezone || 'UTC',
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload) => orgsApi.updateCurrent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-current'] });
      setSuccessMsg('Organization settings updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    updateMutation.mutate({
      name: form.name.trim(),
      industry: form.industry.trim() || undefined,
      description: form.description.trim() || undefined,
      currencyCode: form.currencyCode.toUpperCase(),
      timezone: form.timezone.trim(),
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Organization Settings"
        subtitle="Manage company profile, operational currency, and workspace configuration."
      />

      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorBanner message={error?.response?.data?.message} onRetry={refetch} />}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {!isLoading && !isError && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Organization Legal Name *</label>
              <input
                type="text"
                required
                disabled={!isOwner}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Industry / Sector</label>
                <input
                  type="text"
                  disabled={!isOwner}
                  placeholder="e.g. Civil Engineering & Utilities"
                  value={form.industry}
                  onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Operating Currency (ISO 4217)</label>
                <input
                  type="text"
                  maxLength={3}
                  disabled={!isOwner}
                  value={form.currencyCode}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, currencyCode: e.target.value.toUpperCase() }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Default Timezone</label>
              <input
                type="text"
                disabled={!isOwner}
                value={form.timezone}
                onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Organization Description</label>
              <textarea
                rows={3}
                disabled={!isOwner}
                placeholder="Mission statement, project scope, or operational notes..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className={inputClass}
              />
            </div>

            {!isOwner && (
              <p className="text-xs text-amber-500">
                Only Organization Owners have permission to modify these settings.
              </p>
            )}

            {updateMutation.isError && (
              <p className="text-xs text-rose-500">
                {updateMutation.error?.response?.data?.message || 'Failed to update organization.'}
              </p>
            )}

            {isOwner && (
              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}
