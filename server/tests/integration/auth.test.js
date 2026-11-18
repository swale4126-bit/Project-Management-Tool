import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { runMigrations } from '../../src/database/migrate.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

describe.skipIf(!hasTestDb)('Auth Integration Workflows (PostgreSQL)', () => {
  const testEmail = `auth.test.${Date.now()}@fieldledger.local`;
  let accessToken = '';

  beforeAll(async () => {
    await runMigrations(pool);
  });

  afterAll(async () => {
    await query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  it('registers a new user and issues a JWT', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Integration Test Engineer',
      email: testEmail,
      password: 'Password123',
      jobTitle: 'Field Engineer',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTypeOf('string');
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.password_hash).toBeUndefined();
    accessToken = res.body.data.token;
  });

  it('prevents duplicate email registration with 409 EMAIL_ALREADY_EXISTS', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Duplicate User',
      email: testEmail,
      password: 'Password123',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects wrong password on login and succeeds with valid password', async () => {
    const bad = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: 'WrongPassword99',
    });
    expect(bad.status).toBe(401);

    const good = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: 'Password123',
    });
    expect(good.status).toBe(200);
    expect(good.body.data.token).toBeTypeOf('string');
    accessToken = good.body.data.token;
  });

  it('loads current user profile and updates profile + password', async () => {
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(testEmail);

    const patchRes = await request(app)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobTitle: 'Senior Field Engineer' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.user.jobTitle).toBe('Senior Field Engineer');

    const pwRes = await request(app)
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' });
    expect(pwRes.status).toBe(200);

    const relogin = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: 'NewPassword456',
    });
    expect(relogin.status).toBe(200);
  });
});
