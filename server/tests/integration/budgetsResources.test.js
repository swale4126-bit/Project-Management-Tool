import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { runMigrations } from '../../src/database/migrate.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

describe.skipIf(!hasTestDb)('Budgets, Expenses & Resources Integration Tests', () => {
  const stamp = Date.now();
  const ownerEmail = `fin.owner.${stamp}@fieldledger.local`;
  let token = '';
  let orgId = '';
  let projectId = '';

  beforeAll(async () => {
    await runMigrations(pool);
    const reg = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Finance Owner',
      email: ownerEmail,
      password: 'Password123',
    });
    token = reg.body.data.token;

    const orgRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Finance Org ${stamp}` });
    orgId = orgRes.body.data.organization.id;

    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({
        projectCode: 'FIN-1',
        name: 'Microgrid Build',
        startDate: '2026-01-01',
        expectedEndDate: '2026-06-01',
      });
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    if (orgId) await query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await query('DELETE FROM users WHERE email = $1', [ownerEmail]);
  });

  it('tracks planned budget, exact approved spend, remaining balance, and blocks double approval', async () => {
    const budgetRes = await request(app)
      .put(`/api/v1/budgets/project/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ plannedAmount: '1000.00', contingencyAmount: '100.00' });
    expect(budgetRes.status).toBe(200);

    const expRes = await request(app)
      .post('/api/v1/budgets/expenses')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({
        projectId,
        title: 'Copper Busbars',
        category: 'materials',
        expenseDate: '2026-02-01',
        amount: '250.40',
      });
    expect(expRes.status).toBe(201);
    const expenseId = expRes.body.data.id;

    const approve = await request(app)
      .post(`/api/v1/budgets/expenses/${expenseId}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ decision: 'approved', comments: 'Verified invoice.' });
    expect(approve.status).toBe(200);

    // Double decision blocked with 409
    const doubleApprove = await request(app)
      .post(`/api/v1/budgets/expenses/${expenseId}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ decision: 'rejected', comments: 'Too late.' });
    expect(doubleApprove.status).toBe(409);

    const summary = await request(app)
      .get(`/api/v1/budgets/project/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId);
    expect(summary.status).toBe(200);
    expect(summary.body.data.approved_spend).toBe('250.40');
    expect(summary.body.data.remaining_budget).toBe('749.60');
  });

  it('enforces stock limits on resource allocation and restores unused stock on return', async () => {
    const resCreate = await request(app)
      .post('/api/v1/resources')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({
        name: 'Trench Compactor',
        resourceType: 'equipment',
        unit: 'units',
        totalQuantity: 3,
        minThreshold: 1,
      });
    expect(resCreate.status).toBe(201);
    const resourceId = resCreate.body.data.id;

    // Over-allocation blocked
    const over = await request(app)
      .post(`/api/v1/resources/${resourceId}/assignments`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ projectId, quantityAllocated: 5 });
    expect(over.status).toBe(409);

    // Valid allocation triggers low_stock (3 - 2 = 1 <= threshold 1)
    const alloc = await request(app)
      .post(`/api/v1/resources/${resourceId}/assignments`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ projectId, quantityAllocated: 2 });
    expect(alloc.status).toBe(201);
  });
});
