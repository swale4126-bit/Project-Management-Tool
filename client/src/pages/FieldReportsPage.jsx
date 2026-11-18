import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Download,
  Eye,
  MapPin,
  Plus,
  Send,
  User,
} from 'lucide-react';
import { fieldReportsApi, projectsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
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
import { formatDate, formatDateTime } from '../utils/format.js';

const STATUS_TABS = [
  { key: '', label: 'All Reports' },
  { key: 'submitted', label: 'Pending Review' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'draft', label: 'Drafts' },
];

export default function FieldReportsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isManagerOrOwner =
    user?.orgRole === 'org_owner' || user?.orgRole === 'project_manager' || user?.isSuperAdmin;

  const [activeTab, setActiveTab] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reviewReport, setReviewReport] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [inspectReport, setInspectReport] = useState(null);

  // New report form state
  const [newReport, setNewReport] = useState({
    projectId: '',
    title: '',
    activityDate: new Date().toISOString().slice(0, 10),
    locationName: '',
    workCompleted: '',
    challengesBlockers: '',
    resourcesUsedSummary: '',
    progressContributionPct: 0,
    submitNow: true,
  });
  const [evidenceFile, setEvidenceFile] = useState(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-simple'],
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['field-reports', { status: activeTab, projectId: selectedProject }],
    queryFn: () =>
      fieldReportsApi.list({
        status: activeTab || undefined,
        projectId: selectedProject || undefined,
        limit: 100,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (formData) => fieldReportsApi.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-org'] });
      setIsCreateOpen(false);
      setNewReport({
        projectId: '',
        title: '',
        activityDate: new Date().toISOString().slice(0, 10),
        locationName: '',
        workCompleted: '',
        challengesBlockers: '',
        resourcesUsedSummary: '',
        progressContributionPct: 0,
        submitNow: true,
      });
      setEvidenceFile(null);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (reportId) => fieldReportsApi.submit(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-reports'] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ reportId, decision, reviewNotes }) =>
      fieldReportsApi.review(reportId, { decision, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-org'] });
      setReviewReport(null);
      setReviewNotes('');
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newReport.projectId || !newReport.title || !newReport.workCompleted) return;

    const formData = new FormData();
    formData.append('projectId', newReport.projectId);
    formData.append('title', newReport.title);
    formData.append('activityDate', newReport.activityDate);
    formData.append('locationName', newReport.locationName);
    formData.append('workCompleted', newReport.workCompleted);
    if (newReport.challengesBlockers) {
      formData.append('challengesBlockers', newReport.challengesBlockers);
    }
    if (newReport.resourcesUsedSummary) {
      formData.append('resourcesUsedSummary', newReport.resourcesUsedSummary);
    }
    formData.append('progressContributionPct', String(newReport.progressContributionPct));
    formData.append('submitNow', String(newReport.submitNow));

    if (evidenceFile) {
      formData.append('evidence', evidenceFile);
    }

    createMutation.mutate(formData);
  };

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    if (!reviewReport) return;
    reviewMutation.mutate({
      reportId: reviewReport.id,
      decision: reviewDecision,
      reviewNotes: reviewNotes || undefined,
    });
  };

  const reports = data?.data?.items || [];
  const projects = projectsData?.data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Activity Reports & Sign-Offs"
        subtitle="Daily site inspections, photographic evidence logs, and engineering approvals."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Log Field Activity
          </Button>
        }
      />

      {/* Tabs and Project Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
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

      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorBanner message={error?.response?.data?.message} onRetry={refetch} />}

      {!isLoading && !isError && reports.length === 0 && (
        <EmptyState
          title="No field reports found"
          description="Submit a new daily activity report with on-site GPS location, blockers, and photos."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Submit First Report
            </Button>
          }
        />
      )}

      {!isLoading && !isError && reports.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card key={report.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    [{report.project_code}]
                  </span>
                  <StatusBadge value={report.status} />
                </div>

                <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white line-clamp-1">
                  {report.title}
                </h3>

                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {report.location_name}
                </p>

                <p className="mt-3 text-xs text-slate-600 line-clamp-3 dark:text-slate-300">
                  {report.work_completed}
                </p>

                {report.challenges_blockers && (
                  <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-xs text-rose-500 line-clamp-2">
                    <span className="font-semibold">Blocker: </span>
                    {report.challenges_blockers}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {report.submitted_by_name}
                  </span>
                  <span>{formatDate(report.activity_date)}</span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setInspectReport(report)}
                      title="Inspect Report"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>

                    {report.evidence_storage_path && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          fieldReportsApi.downloadEvidence(report.id, report.evidence_original_name || 'evidence.jpg')
                        }
                        title="Download Photo Evidence"
                      >
                        <Camera className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                    )}
                  </div>

                  {report.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => submitMutation.mutate(report.id)}
                      disabled={submitMutation.isPending}
                    >
                      <Send className="h-3 w-3" /> Submit
                    </Button>
                  )}

                  {isManagerOrOwner &&
                    (report.status === 'submitted' || report.status === 'under_review') && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setReviewReport(report);
                          setReviewDecision('approved');
                          setReviewNotes('');
                        }}
                      >
                        Review
                      </Button>
                    )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Field Report Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Submit Field Activity Report"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Target Project *</label>
            <select
              required
              value={newReport.projectId}
              onChange={(e) => setNewReport((p) => ({ ...p, projectId: e.target.value }))}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Report Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Pump Station Intake Pipe Fitting"
                value={newReport.title}
                onChange={(e) => setNewReport((p) => ({ ...p, title: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Activity Date *</label>
              <input
                type="date"
                required
                value={newReport.activityDate}
                onChange={(e) => setNewReport((p) => ({ ...p, activityDate: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Site Location / Coordinates *</label>
            <input
              type="text"
              required
              placeholder="e.g. North Basin Pumping Vault (45.5152 N, 122.6784 W)"
              value={newReport.locationName}
              onChange={(e) => setNewReport((p) => ({ ...p, locationName: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Work Completed *</label>
            <textarea
              rows={3}
              required
              placeholder="Detailed description of field installations, tests, or repairs completed..."
              value={newReport.workCompleted}
              onChange={(e) => setNewReport((p) => ({ ...p, workCompleted: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Challenges / Blockers Encountered (Optional)</label>
            <textarea
              rows={2}
              placeholder="Weather delays, equipment breakdown, site access restrictions..."
              value={newReport.challengesBlockers}
              onChange={(e) => setNewReport((p) => ({ ...p, challengesBlockers: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Progress Contribution (% of project)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newReport.progressContributionPct}
                onChange={(e) =>
                  setNewReport((p) => ({ ...p, progressContributionPct: Number(e.target.value) }))
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Photo Evidence</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setEvidenceFile(e.target.files[0])}
                className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium dark:file:bg-slate-800 dark:file:text-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="submitNowCheck"
              checked={newReport.submitNow}
              onChange={(e) => setNewReport((p) => ({ ...p, submitNow: e.target.checked }))}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="submitNowCheck" className="text-xs text-slate-700 dark:text-slate-300">
              Submit immediately for review (uncheck to save as draft)
            </label>
          </div>

          {createMutation.isError && (
            <p className="text-xs text-rose-500">
              {createMutation.error?.response?.data?.message || 'Failed to submit field report.'}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Review Modal */}
      <Modal
        open={Boolean(reviewReport)}
        onClose={() => setReviewReport(null)}
        title={`Review Field Report: ${reviewReport?.title}`}
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Review Decision *</label>
            <select
              value={reviewDecision}
              onChange={(e) => setReviewDecision(e.target.value)}
              className={inputClass}
            >
              <option value="approved">Approve Report</option>
              <option value="under_review">Mark Under Review</option>
              <option value="rejected">Reject Report (Requires Notes)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Review Feedback / Notes {reviewDecision === 'rejected' ? '*' : '(Optional)'}
            </label>
            <textarea
              rows={3}
              required={reviewDecision === 'rejected'}
              placeholder="Provide comments, required revisions, or engineering sign-off confirmation..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className={inputClass}
            />
          </div>

          {reviewMutation.isError && (
            <p className="text-xs text-rose-500">
              {reviewMutation.error?.response?.data?.message || 'Failed to submit review.'}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReviewReport(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={reviewDecision === 'rejected' ? 'danger' : 'primary'}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? 'Submitting...' : 'Confirm Decision'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Report Inspection Modal */}
      <Modal
        open={Boolean(inspectReport)}
        onClose={() => setInspectReport(null)}
        title="Field Inspection Detail & Audit"
        maxWidth="max-w-2xl"
      >
        {inspectReport && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <span className="font-mono text-xs font-semibold text-blue-500">
                  [{inspectReport.project_code}]
                </span>{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {inspectReport.project_name}
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {inspectReport.title}
                </h3>
              </div>
              <StatusBadge value={inspectReport.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
              <div>
                <span className="text-slate-400">Activity Date:</span>{' '}
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatDate(inspectReport.activity_date)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Inspector:</span>{' '}
                <span className="font-medium text-slate-900 dark:text-white">
                  {inspectReport.submitted_by_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Location:</span>{' '}
                <span className="font-medium text-slate-900 dark:text-white">
                  {inspectReport.location_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Progress Contribution:</span>{' '}
                <span className="font-medium text-slate-900 dark:text-white">
                  {inspectReport.progress_contribution_pct}%
                </span>
              </div>
            </div>

            <div>
              <p className="font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Completed Work Description
              </p>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {inspectReport.work_completed}
              </div>
            </div>

            {inspectReport.challenges_blockers && (
              <div>
                <p className="font-semibold uppercase tracking-wider text-rose-500 mb-1">
                  Challenges & Blockers
                </p>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-rose-500">
                  {inspectReport.challenges_blockers}
                </div>
              </div>
            )}

            {inspectReport.evidence_storage_path && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-slate-900 dark:text-white">
                    {inspectReport.evidence_original_name || 'Inspection Photo Evidence'}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    fieldReportsApi.downloadEvidence(
                      inspectReport.id,
                      inspectReport.evidence_original_name || 'evidence.jpg'
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setInspectReport(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
