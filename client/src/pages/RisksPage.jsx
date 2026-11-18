import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  Flame,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import { risksApi, issuesApi, projectsApi, orgsApi } from '../api/endpoints.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  inputClass,
  labelClass,
} from '../components/ui/Primitives.jsx';

export default function RisksPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('risks'); // 'risks' | 'issues'
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCell, setSelectedCell] = useState(null); // { p, i } | null
  const [isAddRiskOpen, setIsAddRiskOpen] = useState(false);
  const [isAddIssueOpen, setIsAddIssueOpen] = useState(false);
  const [resolveIssueModal, setResolveIssueModal] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Form states
  const [newRisk, setNewRisk] = useState({
    projectId: '',
    title: '',
    description: '',
    probability: 3,
    impact: 3,
    mitigationPlan: '',
    ownerId: '',
    status: 'identified',
  });

  const [newIssue, setNewIssue] = useState({
    projectId: '',
    title: '',
    description: '',
    severity: 'medium',
    assignedTo: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-simple'],
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const { data: membersData } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => orgsApi.listMembers(),
  });

  const { data: risksData, isLoading: risksLoading, isError: risksError, refetch: refetchRisks } =
    useQuery({
      queryKey: ['risks', { projectId: selectedProject }],
      queryFn: () => risksApi.list({ projectId: selectedProject || undefined, limit: 100 }),
    });

  const { data: issuesData, isLoading: issuesLoading, isError: issuesError, refetch: refetchIssues } =
    useQuery({
      queryKey: ['issues', { projectId: selectedProject }],
      queryFn: () => issuesApi.list({ projectId: selectedProject || undefined, limit: 100 }),
      enabled: activeTab === 'issues',
    });

  const createRiskMutation = useMutation({
    mutationFn: (payload) => risksApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      setIsAddRiskOpen(false);
      setNewRisk({
        projectId: '',
        title: '',
        description: '',
        probability: 3,
        impact: 3,
        mitigationPlan: '',
        ownerId: '',
        status: 'identified',
      });
    },
  });

  const updateRiskMutation = useMutation({
    mutationFn: ({ riskId, status }) => risksApi.update(riskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
    },
  });

  const deleteRiskMutation = useMutation({
    mutationFn: (riskId) => risksApi.remove(riskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
    },
  });

  const createIssueMutation = useMutation({
    mutationFn: (payload) => issuesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setIsAddIssueOpen(false);
      setNewIssue({
        projectId: '',
        title: '',
        description: '',
        severity: 'medium',
        assignedTo: '',
      });
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: ({ issueId, payload }) => issuesApi.update(issueId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setResolveIssueModal(null);
      setResolutionNotes('');
    },
  });

  const handleCreateRisk = (e) => {
    e.preventDefault();
    if (!newRisk.projectId || !newRisk.title || !newRisk.description) return;
    createRiskMutation.mutate({
      projectId: newRisk.projectId,
      title: newRisk.title.trim(),
      description: newRisk.description.trim(),
      probability: Number(newRisk.probability),
      impact: Number(newRisk.impact),
      mitigationPlan: newRisk.mitigationPlan.trim() || undefined,
      ownerId: newRisk.ownerId || undefined,
      status: newRisk.status,
    });
  };

  const handleCreateIssue = (e) => {
    e.preventDefault();
    if (!newIssue.projectId || !newIssue.title || !newIssue.description) return;
    createIssueMutation.mutate({
      projectId: newIssue.projectId,
      title: newIssue.title.trim(),
      description: newIssue.description.trim(),
      severity: newIssue.severity,
      assignedTo: newIssue.assignedTo || undefined,
    });
  };

  const risks = useMemo(() => risksData?.data?.items || [], [risksData?.data?.items]);
  const issues = issuesData?.data?.items || [];
  const projects = projectsData?.data?.items || [];
  const members = membersData?.data || [];

  // 5x5 Matrix Cell Counts
  const matrixCounts = useMemo(() => {
    const counts = {};
    for (let p = 1; p <= 5; p++) {
      for (let i = 1; i <= 5; i++) {
        counts[`${p}-${i}`] = 0;
      }
    }
    for (const r of risks) {
      if (r.status !== 'closed') {
        const key = `${r.probability}-${r.impact}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [risks]);

  const filteredRisks = useMemo(() => {
    if (!selectedCell) return risks;
    return risks.filter(
      (r) => r.probability === selectedCell.p && r.impact === selectedCell.i
    );
  }, [risks, selectedCell]);

  const criticalRisksCount = risks.filter((r) => r.probability * r.impact >= 15 && r.status !== 'closed').length;
  const openIssuesCount = issues.filter((i) => i.status === 'open' || i.status === 'investigating').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Governance & Issues Log"
        subtitle="5x5 severity matrix, mitigation playbooks, and critical operational blockers."
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => (activeTab === 'risks' ? setIsAddRiskOpen(true) : setIsAddIssueOpen(true))}
            >
              <Plus className="h-4 w-4" />
              {activeTab === 'risks' ? 'Register Risk' : 'Log Issue'}
            </Button>
          </div>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tracked Risks"
          value={risks.length}
          sublabel={`${risks.filter((r) => r.status === 'closed').length} closed / mitigated`}
          icon={Shield}
          accent="blue"
        />
        <StatCard
          label="Critical / High Risks"
          value={criticalRisksCount}
          sublabel="Score ≥ 15 (Requires Mitigation)"
          icon={Flame}
          accent={criticalRisksCount > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          label="Active Site Blockers"
          value={openIssuesCount}
          sublabel="Unresolved site incidents"
          icon={AlertOctagon}
          accent={openIssuesCount > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Tab Switcher & Project Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('risks')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'risks'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            5×5 Risk Matrix & Register
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'issues'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Issues & Site Blockers
          </button>
        </div>

        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className={`${inputClass} w-auto`}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              [{p.project_code}] {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Risks Tab: 5x5 Matrix + Risk Register */}
      {activeTab === 'risks' && (
        <div className="space-y-6">
          {/* 5x5 Heatmap Matrix Card */}
          <Card className="p-6">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  5×5 Risk Severity Heatmap (Probability × Impact)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any cell to filter the risk register. Green = Low (1-4), Yellow = Moderate (5-9), Orange = High (10-14), Red = Critical (15-25).
                </p>
              </div>
              {selectedCell && (
                <Button size="sm" variant="secondary" onClick={() => setSelectedCell(null)}>
                  Clear Cell Filter (P:{selectedCell.p}, I:{selectedCell.i})
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="inline-block min-w-120">
                <div className="grid grid-cols-6 gap-1.5 text-center text-xs">
                  {/* Top-left empty header */}
                  <div className="flex items-center justify-center font-bold text-slate-400">
                    Prob \ Imp
                  </div>
                  <div className="font-semibold text-slate-600 dark:text-slate-300">1: Negligible</div>
                  <div className="font-semibold text-slate-600 dark:text-slate-300">2: Minor</div>
                  <div className="font-semibold text-slate-600 dark:text-slate-300">3: Moderate</div>
                  <div className="font-semibold text-slate-600 dark:text-slate-300">4: Major</div>
                  <div className="font-semibold text-slate-600 dark:text-slate-300">5: Catastrophic</div>

                  {/* Rows from Probability 5 down to 1 */}
                  {[5, 4, 3, 2, 1].map((p) => {
                    const probLabels = {
                      5: '5: Almost Certain',
                      4: '4: Likely',
                      3: '3: Possible',
                      2: '2: Unlikely',
                      1: '1: Rare',
                    };

                    return (
                      <div key={`row-${p}`} className="contents">
                        <div className="flex items-center justify-start text-left font-semibold text-slate-600 dark:text-slate-300">
                          {probLabels[p]}
                        </div>

                        {[1, 2, 3, 4, 5].map((i) => {
                          const score = p * i;
                          const count = matrixCounts[`${p}-${i}`] || 0;
                          const isSelected = selectedCell?.p === p && selectedCell?.i === i;

                          let bgClass = 'bg-emerald-500/20 text-emerald-600 border-emerald-500/40 dark:text-emerald-300';
                          if (score >= 15) {
                            bgClass = 'bg-rose-500/25 text-rose-600 border-rose-500/40 dark:text-rose-300';
                          } else if (score >= 10) {
                            bgClass = 'bg-amber-500/25 text-amber-600 border-amber-500/40 dark:text-amber-300';
                          } else if (score >= 5) {
                            bgClass = 'bg-blue-500/20 text-blue-600 border-blue-500/40 dark:text-blue-300';
                          }

                          return (
                            <button
                              key={`cell-${p}-${i}`}
                              type="button"
                              onClick={() =>
                                setSelectedCell(isSelected ? null : { p, i })
                              }
                              className={`flex h-12 flex-col items-center justify-center rounded-lg border font-mono transition hover:scale-105 ${bgClass} ${
                                isSelected ? 'ring-2 ring-white shadow-lg' : ''
                              }`}
                            >
                              <span className="text-[10px] text-slate-400">Score: {score}</span>
                              <span className="text-sm font-bold">{count > 0 ? `${count} risk` : '—'}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Risk Register Table */}
          {risksLoading && <LoadingSkeleton rows={4} />}
          {risksError && <ErrorBanner onRetry={refetchRisks} />}

          {!risksLoading && !risksError && filteredRisks.length === 0 && (
            <EmptyState
              title="No risks recorded"
              description="Identify site safety, supply chain, environmental, or geotechnical risks."
              action={
                <Button onClick={() => setIsAddRiskOpen(true)}>
                  <Plus className="h-4 w-4" /> Register First Risk
                </Button>
              }
            />
          )}

          {!risksLoading && !risksError && filteredRisks.length > 0 && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Risk Title</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Score (P×I)</th>
                      <th className="px-4 py-3">Mitigation Playbook</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRisks.map((risk) => {
                      const score = risk.probability * risk.impact;
                      return (
                        <tr key={risk.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {risk.title}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-1 dark:text-slate-400">
                              {risk.description}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-500">
                            [{risk.project_code}]
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-bold ${
                                score >= 15
                                  ? 'bg-rose-500/20 text-rose-500'
                                  : score >= 10
                                  ? 'bg-amber-500/20 text-amber-500'
                                  : 'bg-emerald-500/20 text-emerald-500'
                              }`}
                            >
                              {score} ({risk.probability}×{risk.impact})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {risk.mitigation_plan || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge value={risk.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <select
                                value={risk.status}
                                onChange={(e) =>
                                  updateRiskMutation.mutate({
                                    riskId: risk.id,
                                    status: e.target.value,
                                  })
                                }
                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                              >
                                <option value="identified">Identified</option>
                                <option value="monitoring">Monitoring</option>
                                <option value="mitigated">Mitigated</option>
                                <option value="occurred">Occurred</option>
                                <option value="closed">Closed</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => deleteRiskMutation.mutate(risk.id)}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Issues & Blockers Tab */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          {issuesLoading && <LoadingSkeleton rows={4} />}
          {issuesError && <ErrorBanner onRetry={refetchIssues} />}

          {!issuesLoading && !issuesError && issues.length === 0 && (
            <EmptyState
              title="No site issues or blockers logged"
              description="Keep engineering, safety, and equipment blockers tracked until fully resolved."
              action={
                <Button onClick={() => setIsAddIssueOpen(true)}>
                  <Plus className="h-4 w-4" /> Log Site Issue
                </Button>
              }
            />
          )}

          {!issuesLoading && !issuesError && issues.length > 0 && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Issue Title</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assignee</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {issues.map((iss) => (
                      <tr key={iss.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {iss.title}
                          </p>
                          <p className="text-xs text-slate-400 line-clamp-1">{iss.description}</p>
                          {iss.resolution_notes && (
                            <p className="text-[11px] text-emerald-500 mt-1">
                              <strong>Resolution:</strong> {iss.resolution_notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-500">
                          [{iss.project_code}]
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={iss.severity} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={iss.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {iss.assignee_name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {iss.status !== 'resolved' && iss.status !== 'closed' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setResolveIssueModal(iss);
                                setResolutionNotes('');
                              }}
                            >
                              Resolve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Add Risk Modal */}
      <Modal open={isAddRiskOpen} onClose={() => setIsAddRiskOpen(false)} title="Register Project Risk">
        <form onSubmit={handleCreateRisk} className="space-y-4">
          <div>
            <label className={labelClass}>Target Project *</label>
            <select
              required
              value={newRisk.projectId}
              onChange={(e) => setNewRisk((p) => ({ ...p, projectId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Risk Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Geotechnical soil instability under north tower"
              value={newRisk.title}
              onChange={(e) => setNewRisk((p) => ({ ...p, title: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Detailed Risk Narrative *</label>
            <textarea
              rows={3}
              required
              placeholder="Root cause, potential impact on schedule, safety or structural integrity..."
              value={newRisk.description}
              onChange={(e) => setNewRisk((p) => ({ ...p, description: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Probability (1-5) *</label>
              <select
                value={newRisk.probability}
                onChange={(e) => setNewRisk((p) => ({ ...p, probability: Number(e.target.value) }))}
                className={inputClass}
              >
                <option value="1">1 - Rare</option>
                <option value="2">2 - Unlikely</option>
                <option value="3">3 - Possible</option>
                <option value="4">4 - Likely</option>
                <option value="5">5 - Almost Certain</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Impact (1-5) *</label>
              <select
                value={newRisk.impact}
                onChange={(e) => setNewRisk((p) => ({ ...p, impact: Number(e.target.value) }))}
                className={inputClass}
              >
                <option value="1">1 - Negligible</option>
                <option value="2">2 - Minor</option>
                <option value="3">3 - Moderate</option>
                <option value="4">4 - Major</option>
                <option value="5">5 - Catastrophic</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Mitigation & Contingency Plan</label>
            <textarea
              rows={2}
              placeholder="Preventative actions, structural shoring, insurance provisions..."
              value={newRisk.mitigationPlan}
              onChange={(e) => setNewRisk((p) => ({ ...p, mitigationPlan: e.target.value }))}
              className={inputClass}
            />
          </div>

          {createRiskMutation.isError && (
            <p className="text-xs text-rose-500">
              {createRiskMutation.error?.response?.data?.message || 'Failed to register risk.'}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddRiskOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRiskMutation.isPending}>
              {createRiskMutation.isPending ? 'Registering...' : 'Register Risk'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Issue Modal */}
      <Modal open={isAddIssueOpen} onClose={() => setIsAddIssueOpen(false)} title="Log Operational Issue / Blocker">
        <form onSubmit={handleCreateIssue} className="space-y-4">
          <div>
            <label className={labelClass}>Target Project *</label>
            <select
              required
              value={newIssue.projectId}
              onChange={(e) => setNewIssue((p) => ({ ...p, projectId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Issue Summary *</label>
            <input
              type="text"
              required
              placeholder="e.g. Submersible pump seized due to silt accumulation"
              value={newIssue.title}
              onChange={(e) => setNewIssue((p) => ({ ...p, title: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Description & Immediate Impact *</label>
            <textarea
              rows={3}
              required
              placeholder="Specific fault details, affected site location, and downtime impact..."
              value={newIssue.description}
              onChange={(e) => setNewIssue((p) => ({ ...p, description: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Severity</label>
              <select
                value={newIssue.severity}
                onChange={(e) => setNewIssue((p) => ({ ...p, severity: e.target.value }))}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Assignee</label>
              <select
                value={newIssue.assignedTo}
                onChange={(e) => setNewIssue((p) => ({ ...p, assignedTo: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select Member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {createIssueMutation.isError && (
            <p className="text-xs text-rose-500">
              {createIssueMutation.error?.response?.data?.message || 'Failed to log issue.'}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddIssueOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createIssueMutation.isPending}>
              {createIssueMutation.isPending ? 'Logging...' : 'Log Issue'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resolve Issue Modal */}
      <Modal
        open={Boolean(resolveIssueModal)}
        onClose={() => setResolveIssueModal(null)}
        title={`Resolve Issue: ${resolveIssueModal?.title}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (resolveIssueModal) {
              updateIssueMutation.mutate({
                issueId: resolveIssueModal.id,
                payload: {
                  status: 'resolved',
                  resolutionNotes: resolutionNotes || 'Resolved on site.',
                },
              });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Resolution Notes *</label>
            <textarea
              rows={3}
              required
              placeholder="Describe corrective actions taken and root cause mitigation..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResolveIssueModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={updateIssueMutation.isPending}>
              {updateIssueMutation.isPending ? 'Saving...' : 'Mark Resolved'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
