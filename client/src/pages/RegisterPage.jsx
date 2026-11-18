import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage } from '../api/client.js';
import { Button, ErrorBanner, inputClass, labelClass } from '../components/ui/Primitives.jsx';

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().email('Enter a valid email address.'),
  jobTitle: z.string().trim().max(100).optional(),
  password: z
    .string()
    .min(8, 'Minimum 8 characters.')
    .regex(/[A-Z]/, 'Include at least one uppercase letter.')
    .regex(/[a-z]/, 'Include at least one lowercase letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
});

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await registerUser(values);
      navigate('/setup-organization');
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Registration failed.'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1120] p-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#111827] p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Create your account</h1>
            <p className="text-xs text-slate-400">Join or launch an organization in FieldLedger</p>
          </div>
        </div>

        {serverError && (
          <div className="mb-4">
            <ErrorBanner message={serverError} />
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={labelClass}>Full Name</label>
            <input placeholder="Nadia Vance" className={inputClass} {...register('fullName')} />
            {errors.fullName && (
              <p className="mt-1 text-xs text-rose-400">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Email Address</label>
            <input
              type="email"
              placeholder="nadia@organization.org"
              className={inputClass}
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Job Title (Optional)</label>
            <input
              placeholder="Operations Director / Project Manager"
              className={inputClass}
              {...register('jobTitle')}
            />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              placeholder="Min 8 chars, upper, lower, number"
              className={inputClass}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
