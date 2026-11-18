import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { runMigrations } from '../../src/database/migrate.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

describe.skipIf(!hasTestDb)('Projects & Cross-Org Isolation Integration Tests', () => {
  const stamp = Date.now();
  const ownerAEmail = `proj.owner.a.${stamp}@fieldledger.local`;
  const viewerAEmail = `proj.viewer.a.${stamp}@fieldledger.local`;
  const ownerBEmail = `proj.owner.b.${stamp}@fieldledger.local`;

  let tokenOwnerA = '';
  let tokenViewerA = '';
  let tokenOwnerB = '';
  let orgAId = '';
  let orgBId = '';
  let projectAId = '';
  let viewerAUserId = '';

  beforeAll(async () => {
    await runMigrations(pool);

    const regA = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Project Owner A',
      email: ownerAEmail,
      password: 'Password123',
    });
    tokenOwnerA = regA.body.data.token;

    const regViewer = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Stakeholder A',
      email: viewerAEmail,
      password: 'Password123',
    });
    tokenViewerA = regViewer.body.data.token;
    viewerAUserId = regViewer.body.data.user.id;

    const regB = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Project Owner B',
      email: ownerBEmail,
      password: 'Password123',
    });
    tokenOwnerB = regB.body.data.token;

    const orgARes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ name: `Proj Org A ${stamp}` });
    orgAId = orgARes.body.data.organization.id;

    const orgBRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .send({ name: `Proj Org B ${stamp}` });
    orgBId = orgBRes.body.data.organization.id;

    // Invite stakeholder into Org A
    const inv = await request(app)
      .post('/api/v1/organizations/invitations')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgAId)
      .send({ email: viewerAEmail, role: 'stakeholder' });

    await request(app)
      .post('/api/v1/organizations/invitations/accept')
      .set('Authorization', `Bearer ${tokenViewerA}`)
      .send({ token: inv.body.data.inviteToken });
  });

  afterAll(async () => {
    if (orgAId) await query('DELETE FROM organizations WHERE id = $1', [orgAId]);
    if (orgBId) await query('DELETE FROM organizations WHERE id = $1', [orgBId]);
    await query('DELETE FROM users WHERE email = ANY($1)', [
      [ownerAEmail, viewerAEmail, ownerBEmail],
    ]);
  });

  it('allows Org Owner to create a project with an initial budget and blocks stakeholders from creating', async () => {
    const blocked = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokenViewerA}`)
      .set('X-Organization-Id', orgAId)
      .send({
        projectCode: 'DENY-1',
        name: 'Unauthorized Project',
        startDate: '2026-01-01',
        expectedEndDate: '2026-02-01',
      });
    expect(blocked.status).toBe(403);

    const created = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgAId)
      .send({
        projectCode: 'PRJ-100',
        name: 'Solar Borehole Pump Installation',
        status: 'active',
        priority: 'high',
        locationName: 'Sector 4 Wellhead',
        startDate: '2026-01-01',
        expectedEndDate: '2026-06-30',
        initialBudget: 50000,
      });

    expect(created.status).toBe(201);
    projectAId = created.body.data.id;
  });

  it('prevents Organization B from accessing Organization A project', async () => {
    const crossOrg = await request(app)
      .get(`/api/v1/projects/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .set('X-Organization-Id', orgBId);
    expect(crossOrg.status).toBe(404);
  });

  it('allows assigning stakeholder to project for read-only visibility while blocking edits', async () => {
    const assign = await request(app)
      .post(`/api/v1/projects/${projectAId}/members`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgAId)
      .send({ userId: viewerAUserId, projectRole: 'stakeholder', weeklyCapacityHours: 0 });
    expect(assign.status).toBe(201);

    const readOk = await request(app)
      .get(`/api/v1/projects/${projectAId}`)
      .set('Authorization', `Bearer ${tokenViewerA}`)
      .set('X-Organization-Id', orgAId);
    expect(readOk.status).toBe(200);
    expect(readOk.body.data.metrics.plannedBudget).toBe('50000.00');

    const editBlocked = await request(app)
      .patch(`/api/v1/projects/${projectAId}`)
      .set('Authorization', `Bearer ${tokenViewerA}`)
      .set('X-Organization-Id', orgAId)
      .send({ name: 'Should Not Succeed' });
    expect(editBlocked.status).toBe(403);
  });
});
