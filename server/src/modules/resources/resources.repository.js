import { query } from '../../config/db.js';

export function computeResourceStatus(availableQty, minThreshold) {
  const avail = Number(availableQty);
  const threshold = Number(minThreshold);
  if (avail <= 0) return 'depleted';
  if (avail <= threshold) return 'low_stock';
  return 'available';
}

export async function listResources(orgId, { resourceType, shortagesOnly } = {}) {
  const conditions = ['r.organization_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (resourceType) {
    conditions.push(`r.resource_type = $${idx++}`);
    params.push(resourceType);
  }
  if (shortagesOnly === true) {
    conditions.push(`r.available_quantity <= r.min_threshold`);
  }

  const { rows } = await query(
    `SELECT r.*,
            (r.available_quantity <= r.min_threshold) AS is_shortage,
            COALESCE(a_stats.active_assignments, 0)::int AS active_assignments,
            COALESCE(a_stats.total_allocated, 0.00)::numeric(12,2) AS total_allocated
     FROM resources r
     LEFT JOIN (
       SELECT resource_id,
              COUNT(*) FILTER (WHERE status = 'active') AS active_assignments,
              COALESCE(SUM(quantity_allocated) FILTER (WHERE status = 'active'), 0) AS total_allocated
       FROM resource_assignments
       WHERE organization_id = $1
       GROUP BY resource_id
     ) a_stats ON a_stats.resource_id = r.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY (r.available_quantity <= r.min_threshold) DESC, r.name ASC`,
    params
  );

  return rows;
}

export async function listAssignments(orgId, projectId = null) {
  const params = [orgId];
  let filter = '';
  if (projectId) {
    filter = 'AND ra.project_id = $2';
    params.push(projectId);
  }

  const { rows } = await query(
    `SELECT ra.*,
            r.name AS resource_name,
            r.resource_type,
            r.unit,
            p.project_code,
            p.name AS project_name,
            u.full_name AS assigned_by_name
     FROM resource_assignments ra
     INNER JOIN resources r ON r.id = ra.resource_id
     INNER JOIN projects p ON p.id = ra.project_id
     INNER JOIN users u ON u.id = ra.assigned_by
     WHERE ra.organization_id = $1 ${filter}
     ORDER BY ra.created_at DESC`,
    params
  );
  return rows;
}

export async function findResourceForUpdate(orgId, resourceId, dbClient) {
  const { rows } = await dbClient.query(
    `SELECT * FROM resources WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
    [orgId, resourceId]
  );
  return rows[0] || null;
}

export async function createResource(orgId, payload, dbClient) {
  const avail = payload.availableQuantity ?? payload.totalQuantity;
  const status = computeResourceStatus(avail, payload.minThreshold ?? 0);

  const { rows } = await dbClient.query(
    `INSERT INTO resources (
       organization_id, name, resource_type, unit, total_quantity, available_quantity,
       min_threshold, unit_cost, status, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      orgId,
      payload.name,
      payload.resourceType,
      payload.unit,
      payload.totalQuantity,
      avail,
      payload.minThreshold ?? 0,
      payload.unitCost ?? 0,
      status,
      payload.notes || null,
    ]
  );
  return rows[0];
}

export async function updateResource(orgId, resourceId, payload, computedStatus, dbClient) {
  const mapping = {
    name: 'name',
    resourceType: 'resource_type',
    unit: 'unit',
    totalQuantity: 'total_quantity',
    availableQuantity: 'available_quantity',
    minThreshold: 'min_threshold',
    unitCost: 'unit_cost',
    notes: 'notes',
  };

  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, col] of Object.entries(mapping)) {
    if (payload[key] !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(payload[key]);
    }
  }
  if (computedStatus) {
    fields.push(`status = $${idx++}`);
    values.push(computedStatus);
  }

  values.push(orgId, resourceId);
  const { rows } = await dbClient.query(
    `UPDATE resources
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function createAssignment(
  { organizationId, resourceId, projectId, assignedBy, quantityAllocated, startDate, endDate, notes },
  dbClient
) {
  const { rows } = await dbClient.query(
    `INSERT INTO resource_assignments (
       organization_id, resource_id, project_id, assigned_by, quantity_allocated, start_date, end_date, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      organizationId,
      resourceId,
      projectId,
      assignedBy,
      quantityAllocated,
      startDate || null,
      endDate || null,
      notes || null,
    ]
  );
  return rows[0];
}

export async function findAssignmentById(orgId, assignmentId, dbClient) {
  const { rows } = await dbClient.query(
    `SELECT * FROM resource_assignments WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
    [orgId, assignmentId]
  );
  return rows[0] || null;
}

export async function updateAssignment(orgId, assignmentId, { quantityUsed, status, notes }, dbClient) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (quantityUsed !== undefined) {
    fields.push(`quantity_used = $${idx++}`);
    values.push(quantityUsed);
  }
  if (status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(status);
  }
  if (notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(notes);
  }

  values.push(orgId, assignmentId);
  const { rows } = await dbClient.query(
    `UPDATE resource_assignments
     SET ${fields.join(', ')}
     WHERE organization_id = $${idx++} AND id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}
