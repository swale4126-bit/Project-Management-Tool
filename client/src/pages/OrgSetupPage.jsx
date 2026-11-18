import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, KeyRound, Layers } from 'lucide-react';
import { orgsApi } from '../api/endpoints.js';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorBanner, inputClass, labelClass } from '../components/ui/Primitives.jsx';

export default function OrgSetupPage() {
  const { refreshSession, switchOrganization } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('create');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [orgForm, setOrgForm] = useState({
    name: '',
    industry: 'Infrastructure & Field Services',
    currencyCode: 'USD',
    timezone: 'UTC',
    description: '',
  });
  const [inviteToken, setInviteToken] = useState('');

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await orgsApi.create(orgForm);
      await refreshSession();
      switchOrganization(res.data.organization.id);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptInvite = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await orgsApi.acceptInvitation(inviteToken.trim());
      await refreshSession();
      switchOrganization(res.data.organization.id);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1120] p-6 text-slate-100">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#111827] p-8 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Organization Setup</h1>
            <p className="text-xs text-slate-400">
              Create a new isolated workspace or join your team with an invitation token.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              mode === 'create' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Create Organization
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('join');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              mode === 'join' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Join via Invite Token
          </button>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleCreateOrg} className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>Organization Name</label>
              <input
                required
                placeholder="Civitas Field Infrastructure"
                className={inputClass}
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Industry / Sector</label>
                <input
                  className={inputClass}
                  value={orgForm.industry}
                  onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Default Currency (ISO)</label>
                <input
                  maxLength={3}
                  className={inputClass}
                  value={orgForm.currencyCode}
                  onChange={(e) =>
                    setOrgForm({ ...orgForm, currencyCode: e.target.value.toUpperCase() })
                  }
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Description (Optional)</label>
              <textarea
                rows={3}
                className={inputClass}
                value={orgForm.description}
                onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Creating workspace...' : 'Launch Organization Workspace'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleAcceptInvite} className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>Invitation Token</label>
              <input
                required
                placeholder="Paste the invitation token shared by your Organization Owner"
                className={inputClass}
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Joining organization...' : 'Accept Invitation & Join'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
