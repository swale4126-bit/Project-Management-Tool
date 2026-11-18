import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Layers, ShieldCheck, AlertTriangle } from 'lucide-react';
import { fetchApiHealth } from './api/client.js';

export default function App() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['api-health'],
    queryFn: fetchApiHealth,
  });

  const apiConnected = data?.success === true;
  const dbConnected = data?.data?.database?.connected === true;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#111827] p-8 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">FieldLedger</h1>
              <p className="text-sm text-slate-400">
                Project Management &amp; Field Operations Platform
              </p>
            </div>
          </div>
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            Phase 2 — Environment Ready
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              <Activity className="h-4 w-4 text-blue-400" />
              Backend API Status
            </div>
            <div className="mt-3 flex items-center gap-2">
              {isLoading ? (
                <span className="text-sm text-slate-400">Checking /api/v1/health...</span>
              ) : apiConnected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">
                    Connected ({data.data.environment})
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <span className="text-sm text-amber-300">
                    {isError ? 'Backend offline (start server with npm run dev)' : 'Unavailable'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              PostgreSQL Database
            </div>
            <div className="mt-3 flex items-center gap-2">
              {isLoading ? (
                <span className="text-sm text-slate-400">Inspecting connection...</span>
              ) : dbConnected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">Connected</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <span className="text-sm text-slate-300">
                    {apiConnected
                      ? `Pending Phase 3 setup (${data?.data?.database?.reason || 'not configured'})`
                      : 'Waiting for API server'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-5 text-xs text-slate-400">
          <span>React + Vite + Tailwind CSS + TanStack Query + Express + PostgreSQL</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-slate-200 transition hover:bg-slate-700"
          >
            Re-check Health
          </button>
        </div>
      </div>
    </div>
  );
}
