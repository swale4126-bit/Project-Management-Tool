import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { orgsApi, projectsApi } from '../api/endpoints.js';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Button,
  Card,
  ErrorBanner,
  PageHeader,
  inputClass,
  labelClass,
} from '../components/ui/Primitives.jsx';

const createProjectFormSchema = z
  .object({
    projectCode: z.string().trim().min(2, 'Project code required (e.g. CIV-104)').max(32),
    name: z.string().trim().min(2, 'Project name is required.').max(180),
    description: z.string().trim().optional(),
    status: z.enum(['planning', 'active', 'on_hold', 'at_risk', 'completed', 'cancelled']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    managerId: z.string().optional(),
    locationName: z.string().trim().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date required.'),
    expectedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected end date required.'),
    objectives: z.string().trim().optional(),
    successIndicators: z.string().trim().optional(),
    initialBudget: z.string().optional(),
  })
  .refine((d) => d.expectedEndDate >= d.startDate, {
    path: ['expectedEndDate'],
    message: 'Expected end date must be on or after start date.',
  });

const getTodayIso = () => new Date().toISOString().slice(0, 10);

export default function CreateProjectPage() {
  const { activeOrg } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState('');

  const { data: membersRes } = useQuery({
    queryKey: ['organizations', 'members', activeOrg?.id],
    queryFn: () => orgsApi.listMembers(),
    enabled: Boolean(activeOrg?.id),
  });
  const members = membersRes?.data || [];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      status: 'planning',
      priority: 'medium',
      startDate: getTodayIso(),
      expectedEndDate: getTodayIso(),
    },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const payload = {
        ...values,
        managerId: values.managerId || undefined,
        latitude: values.latitude ? Number(values.latitude) : undefined,
        longitude: values.longitude ? Number(values.longitude) : undefined,
        initialBudget: values.initialBudget ? Number(values.initialBudget) : undefined,
      };
      const res = await projectsApi.create(payload);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      navigate(`/projects/${res.data.id}`);
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Create New Project"
        subtitle="Define scope, operating site, timeline, manager ownership, and baseline budget."
        actions={
          <Link to="/projects">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
        }
      />

      {serverError && <ErrorBanner message={serverError} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            1. Core Identification &amp; Schedule
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Project Code *</label>
              <input placeholder="CIV-204" className={inputClass} {...register('projectCode')} />
              {errors.projectCode && (
                <p className="mt-1 text-xs text-rose-500">{errors.projectCode.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Project Name *</label>
              <input
                placeholder="West Basin Pipeline Expansion"
                className={inputClass}
                {...register('name')}
              />
              {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
            </div>
          </div>

          <div className="mt-4">
            <label className={labelClass}>Description</label>
            <textarea rows={3} className={inputClass} {...register('description')} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} {...register('status')}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="at_risk">At Risk</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select className={inputClass} {...register('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Start Date *</label>
              <input type="date" className={inputClass} {...register('startDate')} />
            </div>
            <div>
              <label className={labelClass}>Expected End Date *</label>
              <input type="date" className={inputClass} {...register('expectedEndDate')} />
              {errors.expectedEndDate && (
                <p className="mt-1 text-xs text-rose-500">{errors.expectedEndDate.message}</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            2. Ownership, Site Location &amp; Baseline Budget
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Project Manager</label>
              <select className={inputClass} {...register('managerId')}>
                <option value="">Assign to me</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName} ({m.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Initial Planned Budget ({activeOrg?.currencyCode || 'USD'})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="75000.00"
                className={inputClass}
                {...register('initialBudget')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Operating Area / Site Location</label>
              <input
                placeholder="North Industrial Corridor — Sector 4"
                className={inputClass}
                {...register('locationName')}
              />
            </div>
            <div>
              <label className={labelClass}>Latitude (Optional)</label>
              <input type="number" step="0.000001" placeholder="40.7128" className={inputClass} {...register('latitude')} />
            </div>
            <div>
              <label className={labelClass}>Longitude (Optional)</label>
              <input type="number" step="0.000001" placeholder="-74.0060" className={inputClass} {...register('longitude')} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            3. Objectives &amp; Success Indicators
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Project Objectives</label>
              <textarea rows={3} className={inputClass} {...register('objectives')} />
            </div>
            <div>
              <label className={labelClass}>Success Indicators / KPIs</label>
              <textarea rows={3} className={inputClass} {...register('successIndicators')} />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to="/projects">
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Project...' : 'Create Project'}
          </Button>
        </div>
      </form>
    </div>
  );
}
