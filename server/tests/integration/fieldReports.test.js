import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { runMigrations } from '../../src/database/migrate.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

describe.skipIf(!hasTestDb)('Field Report Approval Workflow Integration Tests', () => {
  const stamp = Date.now();
  const pmEmail = `fr.pm.${stamp}@fieldledger.local`;
  const techEmail = `fr.tech.${stamp}@fieldledger.local`;

  let pmToken = '';
  let techToken = '';
  let orgId = '';
  let projectId = '';
  let reportId = '';

  beforeAll(async () => {
    await runMigrations(pool);
    const regPm = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Field Report Manager',
      email: pmEmail,
      password: 'Password123',
    });
    pmToken = regPm.body.data.token;

    const regTech = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Field Technician',
      email: techEmail,
      password: 'Password123',
    });
    techToken = regTech.body.data.token;

    const orgRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: `FR Org ${stamp}` });
    orgId = orgRes.body.data.organization.id;

    const inv = await request(app)
      .post('/api/v1/organizations/invitations')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Organization-Id', orgId)
      .send({ email: techEmail, role: 'team_member' });

    await request(app)
      .post('/api/v1/organizations/invitations/accept')
      .set('Authorization', `Bearer ${techToken}`)
      .send({ token: inv.body.data.inviteToken });

    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Organization-Id', orgId)
      .send({
        projectCode: 'FR-1',
        name: 'Substation Trenching',
        startDate: '2026-01-01',
        expectedEndDate: '2026-09-01',
      });
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    if (orgId) await query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await query('DELETE FROM users WHERE email = ANY($1)', [[pmEmail, techEmail]]);
  });

  it('completes Draft -> Submitted -> Rejected -> Revised -> Approved workflow with full audit history', async () => {
    // 1. Tech creates draft
    const draft = await request(app)
      .post('/api/v1/field-reports')
      .set('Authorization', `Bearer ${techToken}`)
      .set('X-Organization-Id', orgId)
      .send({
        projectId,
        title: 'North Sector Daily Progress',
        activityDate: '2026-02-15',
        locationName: 'North Sector Pit 2',
        workCompleted: 'Completed 120m conduit trenching and sand bedding.',
        progressContributionPct: 10,
      });
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe('draft');
    reportId = draft.body.data.id;

    // 2. Manager cannot approve a draft before submission
    const premature = await request(app)
      .post(`/api/v1/field-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Organization-Id', orgId)
      .send({ decision: 'approved' });
    expect(premature.status).toBe(409);

    // 3. Tech submits report
    const submitted = await request(app)
      .post(`/api/v1/field-reports/${reportId}/submit`)
      .set('Authorization', `Bearer ${techToken}`)
      .set('X-Organization-Id', orgId);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('submitted');

    // 4. Tech cannot approve their own report (403 RBAC)
    const selfApprove = await request(app)
      .post(`/api/v1/field-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${techToken}`)
      .set('X-Organization-Id', orgId)
      .send({ decision: 'approved' });
    expect(selfApprove.status).toBe(403);

    // 5. Manager rejects with feedback, tech revises & resubmits, manager approves
    const rejected = await request(app)
      .post(`/api/v1/field-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Organization-Id', orgId)
      .send({ decision: 'rejected', reviewNotes: 'Please include depth verification readings.' });
    expect(rejected.status).toBe(200);

    await request(app)
      .patch(`/api/v1/field-reports/${reportId}`)
      .set('Authorization', `Bearer ${techToken}`)
      .set('X-Organization-Id', orgId)
      .send({ workCompleted: 'Completed 120m trenching verified at 1.2m depth.' });

    await request(app)
      .post(`/api/v1/field-reports/${reportId}/submit`)
      .set('Authorization', `Bearer ${techToken}`)
      .set('X-Organization-Id', orgId);

    const approved = await request(app)
      .post(`/api/v1/field-reports/${reportId}/review`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Organization-Id', orgId)
      .send({ decision: 'approved', reviewNotes: 'Depth measurements confirmed.' });
    expect(approved.status).toBe(200);

    // 6. Verify immutable review history has all 4 workflow events
    const details = await request(app)
      .get(`/api/v1/field-reports/${reportId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Organization-Id', orgId);
    expect(details.status).toBe(200);
    expect(details.body.data.reviewHistory.length).toBe(4);
  });
});
