import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  Plus,
  RotateCcw,
  Search,
  Truck,
} from 'lucide-react';
import { resourcesApi, projectsApi } from '../api/endpoints.js';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingSkeleton,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  inputClass,
  labelClass,
} from '../components/ui/Primitives.jsx';
import { formatDate } from '../utils/format.js';

const RESOURCE_TYPES = ['equipment', 'material', 'vehicle', 'tool', 'software', 'other'];

export default function ResourcesPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'allocations'
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [allocateResource, setAllocateResource] = useState(null);

  // New resource form state
  const [newResource, setNewResource] = useState({
    name: '',
    resourceType: 'equipment',
    unit: 'units',
    totalQuantity: '',
    minThreshold: '5',
    unitCost: '0',
    notes: '',
  });

  // Allocation form state
  const [newAllocation, setNewAllocation] = useState({
    projectId: '',
    quantityAllocated: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-simple'],
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const { data: resourcesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['resources', { search, type: selectedType }],
    queryFn: () =>
      resourcesApi.list({
        search: search || undefined,
        resourceType: selectedType || undefined,
      }),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['resource-assignments'],
    queryFn: () => resourcesApi.listAssignments({ limit: 100 }),
    enabled: activeTab === 'allocations',
  });

  const createResourceMutation = useMutation({
    mutationFn: (payload) => resourcesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      setIsAddResourceOpen(false);
      setNewResource({
        name: '',
        resourceType: 'equipment',
        unit: 'units',
        totalQuantity: '',
        minThreshold: '5',
        unitCost: '0',
        notes: '',
      });
    },
  });

  const allocateMutation = useMutation({
    mutationFn: ({ resourceId, payload }) => resourcesApi.assign(resourceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-assignments'] });
      setAllocateResource(null);
      setNewAllocation({
        projectId: '',
        quantityAllocated: '',
        startDate: '',
        endDate: '',
        notes: '',
      });
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: ({ assignmentId, status }) =>
      resourcesApi.updateAssignment(assignmentId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-assignments'] });
    },
  });

  const handleCreateResourceSubmit = (e) => {
    e.preventDefault();
    if (!newResource.name || !newResource.totalQuantity) return;
    createResourceMutation.mutate({
      name: newResource.name.trim(),
      resourceType: newResource.resourceType,
      unit: newResource.unit.trim(),
      totalQuantity: Number(newResource.totalQuantity),
      minThreshold: Number(newResource.minThreshold || 0),
      unitCost: Number(newResource.unitCost || 0),
      notes: newResource.notes.trim() || undefined,
    });
  };

  const handleAllocateSubmit = (e) => {
    e.preventDefault();
    if (!allocateResource || !newAllocation.projectId || !newAllocation.quantityAllocated) return;
    allocateMutation.mutate({
      resourceId: allocateResource.id,
      payload: {
        projectId: newAllocation.projectId,
        quantityAllocated: Number(newAllocation.quantityAllocated),
        startDate: newAllocation.startDate || undefined,
        endDate: newAllocation.endDate || undefined,
        notes: newAllocation.notes.trim() || undefined,
      },
    });
  };

  const resources = resourcesData?.data || [];
  const assignments = assignmentsData?.data?.items || [];
  const projects = projectsData?.data?.items || [];

  const shortageCount = resources.filter(
    (r) => Number(r.available_quantity) <= Number(r.min_threshold)
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resource Inventory & Allocations"
        subtitle="Manage heavy machinery, tools, construction materials, and field assets."
        actions={
          <Button onClick={() => setIsAddResourceOpen(true)}>
            <Plus className="h-4 w-4" /> Add Asset / Material
          </Button>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tracked Resources"
          value={resources.length}
          icon={Boxes}
          accent="blue"
        />
        <StatCard
          label="Shortage / Low-Stock Alerts"
          value={shortageCount}
          sublabel={shortageCount > 0 ? 'Requires replenishment' : 'Stock levels healthy'}
          icon={AlertTriangle}
          accent={shortageCount > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          label="Active Site Allocations"
          value={assignments.filter((a) => a.status === 'active').length}
          icon={Truck}
          accent="indigo"
        />
      </div>

      {/* Shortage Warning Banner */}
      {shortageCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Inventory Alert:</strong> {shortageCount} item(s) have reached or fallen below
            their safety reserve threshold. Reorder supplies to avoid operational delays.
          </span>
        </div>
      )}

      {/* View Switcher & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Inventory Stock
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('allocations')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'allocations'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Project Allocations
          </button>
        </div>

        {activeTab === 'inventory' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search catalog..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} pl-8 text-xs`}
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={`${inputClass} w-auto text-xs`}
            >
              <option value="">All Types</option>
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorBanner message={error?.response?.data?.message} onRetry={refetch} />}

      {/* Inventory Stock Tab */}
      {!isLoading && !isError && activeTab === 'inventory' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Total Stock</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Safety Reserve</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {resources.map((res) => {
                  const isShortage = Number(res.available_quantity) <= Number(res.min_threshold);
                  return (
                    <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{res.name}</p>
                        {res.notes && (
                          <p className="text-xs text-slate-400 line-clamp-1">{res.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-xs">{res.resource_type}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {res.total_quantity} {res.unit}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {res.available_quantity} {res.unit}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {res.min_threshold} {res.unit}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={isShortage ? 'low_stock' : 'available'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          disabled={Number(res.available_quantity) <= 0}
                          onClick={() => setAllocateResource(res)}
                        >
                          Allocate
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Allocations Tab */}
      {activeTab === 'allocations' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Allocated Qty</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {assignments.map((asg) => (
                  <tr key={asg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {asg.resource_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-500">
                      [{asg.project_code}] {asg.project_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {asg.quantity_allocated} {asg.unit}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {asg.start_date ? formatDate(asg.start_date) : 'Immediate'} &rarr;{' '}
                      {asg.end_date ? formatDate(asg.end_date) : 'Ongoing'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={asg.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {asg.status === 'active' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              updateAssignmentMutation.mutate({
                                assignmentId: asg.id,
                                status: 'returned',
                              })
                            }
                          >
                            <RotateCcw className="h-3 w-3" /> Return Stock
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Resource Modal */}
      <Modal
        open={isAddResourceOpen}
        onClose={() => setIsAddResourceOpen(false)}
        title="Add Asset or Material to Catalog"
      >
        <form onSubmit={handleCreateResourceSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Resource Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Caterpillar 320 Hydraulic Excavator"
              value={newResource.name}
              onChange={(e) => setNewResource((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Resource Type *</label>
              <select
                value={newResource.resourceType}
                onChange={(e) => setNewResource((p) => ({ ...p, resourceType: e.target.value }))}
                className={inputClass}
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Unit of Measurement *</label>
              <input
                type="text"
                required
                placeholder="e.g. units, meters, tons, hours"
                value={newResource.unit}
                onChange={(e) => setNewResource((p) => ({ ...p, unit: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Total Initial Stock *</label>
              <input
                type="number"
                min="0"
                required
                placeholder="e.g. 10"
                value={newResource.totalQuantity}
                onChange={(e) => setNewResource((p) => ({ ...p, totalQuantity: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Safety Reserve Threshold</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 2"
                value={newResource.minThreshold}
                onChange={(e) => setNewResource((p) => ({ ...p, minThreshold: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes / Specification Details</label>
            <textarea
              rows={2}
              placeholder="Maintenance cycle, storage requirements, or vendor SKU..."
              value={newResource.notes}
              onChange={(e) => setNewResource((p) => ({ ...p, notes: e.target.value }))}
              className={inputClass}
            />
          </div>

          {createResourceMutation.isError && (
            <p className="text-xs text-rose-500">
              {createResourceMutation.error?.response?.data?.message || 'Failed to add resource.'}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddResourceOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createResourceMutation.isPending}>
              {createResourceMutation.isPending ? 'Saving...' : 'Add Resource'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Allocate Resource Modal */}
      <Modal
        open={Boolean(allocateResource)}
        onClose={() => setAllocateResource(null)}
        title={`Allocate Asset: ${allocateResource?.name}`}
      >
        <form onSubmit={handleAllocateSubmit} className="space-y-4">
          <div className="rounded-lg bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-300">
            Available to allocate: <strong>{allocateResource?.available_quantity} {allocateResource?.unit}</strong>
          </div>

          <div>
            <label className={labelClass}>Target Project *</label>
            <select
              required
              value={newAllocation.projectId}
              onChange={(e) => setNewAllocation((p) => ({ ...p, projectId: e.target.value }))}
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
            <label className={labelClass}>Quantity to Allocate ({allocateResource?.unit}) *</label>
            <input
              type="number"
              min="1"
              max={allocateResource?.available_quantity || 1}
              required
              value={newAllocation.quantityAllocated}
              onChange={(e) =>
                setNewAllocation((p) => ({ ...p, quantityAllocated: e.target.value }))
              }
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Deployment Start Date</label>
              <input
                type="date"
                value={newAllocation.startDate}
                onChange={(e) => setNewAllocation((p) => ({ ...p, startDate: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Expected Release Date</label>
              <input
                type="date"
                value={newAllocation.endDate}
                onChange={(e) => setNewAllocation((p) => ({ ...p, endDate: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          {allocateMutation.isError && (
            <p className="text-xs text-rose-500">
              {allocateMutation.error?.response?.data?.message || 'Failed to allocate resource.'}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAllocateResource(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={allocateMutation.isPending}>
              {allocateMutation.isPending ? 'Allocating...' : 'Confirm Allocation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
