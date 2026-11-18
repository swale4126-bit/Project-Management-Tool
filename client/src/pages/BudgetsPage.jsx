import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  DollarSign,
  Download,
  PieChart,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { budgetsApi, projectsApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
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
import { formatCurrency, formatDate } from '../utils/format.js';

const CATEGORIES = [
  'materials',
  'labor',
  'equipment',
  'transport',
  'permits',
  'subcontractor',
  'other',
];

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isManagerOrOwner =
    user?.orgRole === 'org_owner' || user?.orgRole === 'project_manager' || user?.isSuperAdmin;

  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [decisionExpense, setDecisionExpense] = useState(null);
  const [decisionType, setDecisionType] = useState('approved');
  const [decisionComments, setDecisionComments] = useState('');

  // Edit budget modal state
  const [editBudgetProject, setEditBudgetProject] = useState(null);
  const [plannedAmountInput, setPlannedAmountInput] = useState('');
  const [contingencyAmountInput, setContingencyAmountInput] = useState('');

  // Add expense form state
  const [newExpense, setNewExpense] = useState({
    projectId: '',
    title: '',
    category: 'materials',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    vendorName: '',
    description: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-simple'],
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const { data: budgetsData, isLoading: budgetsLoading, isError: budgetsError, refetch: refetchBudgets } =
    useQuery({
      queryKey: ['budgets'],
      queryFn: () => budgetsApi.list(),
    });

  const { data: expensesData, isLoading: expLoading, isError: expError, refetch: refetchExpenses } =
    useQuery({
      queryKey: ['expenses', { projectId: selectedProject, category: selectedCategory, status: selectedStatus }],
      queryFn: () =>
        budgetsApi.list({
          projectId: selectedProject || undefined,
          category: selectedCategory || undefined,
          status: selectedStatus || undefined,
          limit: 100,
        }),
    });

  const createExpenseMutation = useMutation({
    mutationFn: (formData) => budgetsApi.createExpense(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-org'] });
      setIsAddExpenseOpen(false);
      setNewExpense({
        projectId: '',
        title: '',
        category: 'materials',
        amount: '',
        expenseDate: new Date().toISOString().slice(0, 10),
        vendorName: '',
        description: '',
      });
      setReceiptFile(null);
    },
  });

  const decideExpenseMutation = useMutation({
    mutationFn: ({ expenseId, decision, comments }) =>
      budgetsApi.decideExpense(expenseId, { decision, comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-org'] });
      setDecisionExpense(null);
      setDecisionComments('');
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ projectId, plannedAmount, contingencyAmount }) =>
      budgetsApi.upsertProjectBudget(projectId, { plannedAmount, contingencyAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setEditBudgetProject(null);
    },
  });

  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    if (!newExpense.projectId || !newExpense.title || !newExpense.amount) return;

    const formData = new FormData();
    formData.append('projectId', newExpense.projectId);
    formData.append('title', newExpense.title);
    formData.append('category', newExpense.category);
    formData.append('amount', String(newExpense.amount));
    formData.append('expenseDate', newExpense.expenseDate);
    if (newExpense.vendorName) formData.append('vendorName', newExpense.vendorName);
    if (newExpense.description) formData.append('description', newExpense.description);
    if (receiptFile) formData.append('receipt', receiptFile);

    createExpenseMutation.mutate(formData);
  };

  const handleDecisionSubmit = (e) => {
    e.preventDefault();
    if (!decisionExpense) return;
    decideExpenseMutation.mutate({
      expenseId: decisionExpense.id,
      decision: decisionType,
      comments: decisionComments || undefined,
    });
  };

  const handleEditBudgetSubmit = (e) => {
    e.preventDefault();
    if (!editBudgetProject) return;
    updateBudgetMutation.mutate({
      projectId: editBudgetProject.id,
      plannedAmount: plannedAmountInput,
      contingencyAmount: contingencyAmountInput || '0.00',
    });
  };

  const summary = budgetsData?.data?.organizationSummary || {};
  const projectBudgets = budgetsData?.data?.projects || [];
  const expenses = expensesData?.data?.items || [];
  const projects = projectsData?.data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets & Expenditure Control"
        subtitle="Track planned capital vs approved expenditures and vendor receipts."
        actions={
          <Button onClick={() => setIsAddExpenseOpen(true)}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Planned Capital"
          value={formatCurrency(summary.totalPlannedBudgetCents || 0)}
          icon={CreditCard}
          accent="blue"
        />
        <StatCard
          label="Approved Spend"
          value={formatCurrency(summary.totalSpentCents || 0)}
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          label="Remaining Balance"
          value={formatCurrency(summary.remainingCents || 0)}
          icon={DollarSign}
          accent="indigo"
        />
        <StatCard
          label="Overall Utilization"
          value={`${summary.utilizationPct || 0}%`}
          sublabel="Target: under 100%"
          icon={PieChart}
          accent={summary.utilizationPct > 90 ? 'rose' : 'amber'}
        />
      </div>

      {/* Project Budgets Allocation Cards */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
          Project Capital Allocations
        </h2>
        {budgetsLoading && <LoadingSkeleton rows={3} />}
        {budgetsError && <ErrorBanner onRetry={refetchBudgets} />}

        {!budgetsLoading && !budgetsError && projectBudgets.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projectBudgets.map((pb) => {
              const util = pb.utilization_pct || 0;
              const barColor =
                util > 100 ? 'bg-rose-500' : util > 80 ? 'bg-amber-500' : 'bg-emerald-500';

              return (
                <Card key={pb.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-semibold text-blue-500">
                        [{pb.project_code}]
                      </span>
                      <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">
                        {pb.name}
                      </h3>
                    </div>
                    {isManagerOrOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditBudgetProject(pb);
                          setPlannedAmountInput(String((pb.planned_amount_cents || 0) / 100));
                          setContingencyAmountInput(
                            String((pb.contingency_amount_cents || 0) / 100)
                          );
                        }}
                      >
                        Adjust
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Planned Budget:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(pb.planned_amount_cents || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Approved Spend:</span>
                      <span className="font-medium text-emerald-500">
                        {formatCurrency(pb.spent_amount_cents || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Remaining:</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {formatCurrency(pb.remaining_amount_cents || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Utilization</span>
                      <span className="font-bold text-slate-900 dark:text-white">{util}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full ${barColor} transition-all`}
                        style={{ width: `${Math.min(util, 100)}%` }}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Expenses List & Filter */}
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Expenditure & Receipts Register
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className={inputClass}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={inputClass}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={inputClass}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {expLoading && <LoadingSkeleton rows={4} />}
        {expError && <ErrorBanner onRetry={refetchExpenses} />}

        {!expLoading && !expError && expenses.length === 0 && (
          <EmptyState
            title="No expenses logged"
            description="Record procurement invoices, field supplies, equipment rentals, or subcontractor payouts."
            action={
              <Button onClick={() => setIsAddExpenseOpen(true)}>
                <Plus className="h-4 w-4" /> Add Expense
              </Button>
            }
          />
        )}

        {!expLoading && !expError && expenses.length > 0 && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Expense</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{exp.title}</p>
                        {exp.vendor_name && (
                          <p className="text-xs text-slate-400">Vendor: {exp.vendor_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-500">
                        [{exp.project_code}]
                      </td>
                      <td className="px-4 py-3 capitalize text-xs">{exp.category}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(exp.amount_cents)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(exp.expense_date)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={exp.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {exp.receipt_storage_path && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                budgetsApi.downloadReceipt(
                                  exp.id,
                                  exp.receipt_original_name || 'receipt.pdf'
                                )
                              }
                              title="Download Receipt"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isManagerOrOwner && exp.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setDecisionExpense(exp);
                                setDecisionType('approved');
                                setDecisionComments('');
                              }}
                            >
                              Decide
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal
        open={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        title="Record New Expense"
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Target Project *</label>
            <select
              required
              value={newExpense.projectId}
              onChange={(e) => setNewExpense((p) => ({ ...p, projectId: e.target.value }))}
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
            <label className={labelClass}>Expense Title / Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. 500 Bags Hydraulic Cement"
              value={newExpense.title}
              onChange={(e) => setNewExpense((p) => ({ ...p, title: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Category *</label>
              <select
                value={newExpense.category}
                onChange={(e) => setNewExpense((p) => ({ ...p, category: e.target.value }))}
                className={inputClass}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Amount (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 4250.00"
                value={newExpense.amount}
                onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Expense Date *</label>
              <input
                type="date"
                required
                value={newExpense.expenseDate}
                onChange={(e) => setNewExpense((p) => ({ ...p, expenseDate: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Vendor Name</label>
              <input
                type="text"
                placeholder="e.g. Pacific Concrete Supplies"
                value={newExpense.vendorName}
                onChange={(e) => setNewExpense((p) => ({ ...p, vendorName: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Attach Invoice / Receipt</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setReceiptFile(e.target.files[0])}
              className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium dark:file:bg-slate-800 dark:file:text-slate-200"
            />
          </div>

          {createExpenseMutation.isError && (
            <p className="text-xs text-rose-500">
              {createExpenseMutation.error?.response?.data?.message || 'Failed to record expense.'}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddExpenseOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createExpenseMutation.isPending}>
              {createExpenseMutation.isPending ? 'Saving...' : 'Record Expense'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Decision Modal */}
      <Modal
        open={Boolean(decisionExpense)}
        onClose={() => setDecisionExpense(null)}
        title={`Audit Expense: ${decisionExpense?.title}`}
      >
        <form onSubmit={handleDecisionSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Decision *</label>
            <select
              value={decisionType}
              onChange={(e) => setDecisionType(e.target.value)}
              className={inputClass}
            >
              <option value="approved">Approve Expense</option>
              <option value="rejected">Reject Expense (Requires Reason)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Audit Notes {decisionType === 'rejected' ? '*' : '(Optional)'}
            </label>
            <textarea
              rows={3}
              required={decisionType === 'rejected'}
              placeholder="Approval confirmation or rejection justification..."
              value={decisionComments}
              onChange={(e) => setDecisionComments(e.target.value)}
              className={inputClass}
            />
          </div>

          {decideExpenseMutation.isError && (
            <p className="text-xs text-rose-500">
              {decideExpenseMutation.error?.response?.data?.message || 'Failed to submit decision.'}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDecisionExpense(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={decisionType === 'rejected' ? 'danger' : 'primary'}
              disabled={decideExpenseMutation.isPending}
            >
              {decideExpenseMutation.isPending ? 'Confirming...' : 'Submit Decision'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal
        open={Boolean(editBudgetProject)}
        onClose={() => setEditBudgetProject(null)}
        title={`Adjust Capital Budget: ${editBudgetProject?.name}`}
      >
        <form onSubmit={handleEditBudgetSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Planned Budget (USD) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={plannedAmountInput}
              onChange={(e) => setPlannedAmountInput(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Contingency Buffer (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={contingencyAmountInput}
              onChange={(e) => setContingencyAmountInput(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditBudgetProject(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateBudgetMutation.isPending}>
              {updateBudgetMutation.isPending ? 'Saving...' : 'Update Budget'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
