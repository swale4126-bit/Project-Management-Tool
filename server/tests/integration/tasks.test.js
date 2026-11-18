import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { runMigrations } from '../../src/database/migrate.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

describe.skipIf(!hasTestDb)('Tasks, DAG Dependencies & Milestones Integration Tests', () => {
  const stamp = Date.now();
  const ownerEmail = `tasks.owner.${stamp}@fieldledger.local`;
  let token = '';
  let orgId = '';
  let projectId = '';
  let milestoneId = '';
  let taskAId = '';
  let taskBId = '';
  let taskCId = '';

  beforeAll(async () => {
    await runMigrations(pool);
    const reg = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Task Flow Owner',
      email: ownerEmail,
      password: 'Password123',
    });
    token = reg.body.data.token;

    const orgRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Task Org ${stamp}` });
    orgId = orgRes.body.data.organization.id;

    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({
        projectCode: 'TSK-1',
        name: 'Dependency Test Project',
        startDate: '2026-01-01',
        expectedEndDate: '2026-12-31',
      });
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    if (orgId) await query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await query('DELETE FROM users WHERE email = $1', [ownerEmail]);
  });

  it('creates a milestone and links 3 tasks to it', async () => {
    const ms = await request(app)
      .post('/api/v1/milestones')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({
        projectId,
        title: 'Phase 1 Excavation Complete',
        targetDate: '2026-06-01',
      });
    expect(ms.status).toBe(201);
    milestoneId = ms.body.data.id;

    const createTask = (title) =>
      request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Organization-Id', orgId)
        .send({ projectId, milestoneId, title, startDate: '2026-02-01', dueDate: '2026-03-01' });

    const [a, b, c] = await Promise.all([
      createTask('Task A'),
      createTask('Task B'),
      createTask('Task C'),
    ]);
    expect(a.status).toBe(201);
    taskAId = a.body.data.id;
    taskBId = b.body.data.id;
    taskCId = c.body.data.id;
  });

  it('allows valid chain B -> A and C -> B, then rejects cycle A -> C with 409', async () => {
    const dep1 = await request(app)
      .post(`/api/v1/tasks/${taskBId}/dependencies`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ dependsOnTaskId: taskAId });
    expect(dep1.status).toBe(201);

    const dep2 = await request(app)
      .post(`/api/v1/tasks/${taskCId}/dependencies`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ dependsOnTaskId: taskBId });
    expect(dep2.status).toBe(201);

    const cycle = await request(app)
      .post(`/api/v1/tasks/${taskAId}/dependencies`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ dependsOnTaskId: taskCId });
    expect(cycle.status).toBe(409);
    expect(cycle.body.error.code).toBe('DEPENDENCY_CYCLE_DETECTED');
  });

  it('returns real database-backed Gantt timeline payload', async () => {
    const timeline = await request(app)
      .get(`/api/v1/milestones/project/${projectId}/timeline`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId);

    expect(timeline.status).toBe(200);
    expect(timeline.body.data.milestones.length).toBe(1);
    expect(timeline.body.data.tasks.length).toBe(3);
    expect(timeline.body.data.dependencies.length).toBe(2);
  });
});
