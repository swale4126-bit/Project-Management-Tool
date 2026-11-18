import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layers, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage } from '../api/client.js';
import { Button, ErrorBanner, inputClass, labelClass } from '../components/ui/Primitives.jsx';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const data = await login(values);
      if (data.organizations?.length > 0) {
        navigate('/dashboard');
      } else {
        navigate('/setup-organization');
      }
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Invalid email or password.'));
    }
  };

  return (
    <div className="grid min-h-screen bg-[#0B1120] text-slate-100 lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-slate-800 bg-gradient-to-br from-[#0F172A] via-[#0B1120] to-[#090E1A] p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">FieldLedger</p>
            <p className="text-xs text-slate-400">Project Management &amp; Field Operations</p>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-bold leading-tight text-white">
            Coordinate field teams, budgets, milestones, and approvals in one command center.
          </h1>
          <div className="space-y-3 text-sm text-slate-300">
            {[
              'Real-time overdue project & milestone risk detection',
              'Structured field activity reports with photo evidence & manager sign-off',
              'Penny-accurate budget vs. expense tracking with audit trails',
              'Strict organization isolation and 5-tier RBAC security',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <span>Multi-Tenant PostgreSQL Architecture • JWT + Role-Based Security</span>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#111827] p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-white">Sign in to FieldLedger</h2>
          <p className="mt-1 text-sm text-slate-400">
            Enter your organization credentials to continue.
          </p>

          {serverError && (
            <div className="mt-4">
              <ErrorBanner message={serverError} />
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>Work Email</label>
              <input
                type="email"
                placeholder="owner@civitas.local"
                className={inputClass}
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className={inputClass}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            New to FieldLedger?{' '}
            <Link to="/register" className="font-medium text-blue-400 hover:text-blue-300">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
