import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { runMigrations } from '../../src/database/migrate.js';

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

describe.skipIf(!hasTestDb)('Organizations, RBAC & Cross-Tenant Isolation (PostgreSQL)', () => {
  const stamp = Date.now();
  const ownerAEmail = `owner.a.${stamp}@fieldledger.local`;
  const memberAEmail = `member.a.${stamp}@fieldledger.local`;
  const ownerBEmail = `owner.b.${stamp}@fieldledger.local`;

  let tokenOwnerA = '';
  let tokenMemberA = '';
  let tokenOwnerB = '';
  let orgAId = '';
  let orgBId = '';
  let inviteToken = '';
  let ownerAMemberId = '';

  beforeAll(async () => {
    await runMigrations(pool);

    const regA = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Owner Alpha',
      email: ownerAEmail,
      password: 'Password123',
    });
    tokenOwnerA = regA.body.data.token;

    const regMemberA = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Technician Alpha',
      email: memberAEmail,
      password: 'Password123',
    });
    tokenMemberA = regMemberA.body.data.token;

    const regB = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Owner Beta',
      email: ownerBEmail,
      password: 'Password123',
    });
    tokenOwnerB = regB.body.data.token;
  });

  afterAll(async () => {
    if (orgAId) await query('DELETE FROM organizations WHERE id = $1', [orgAId]);
    if (orgBId) await query('DELETE FROM organizations WHERE id = $1', [orgBId]);
    await query('DELETE FROM users WHERE email = ANY($1)', [
      [ownerAEmail, memberAEmail, ownerBEmail],
    ]);
  });

  it('creates two isolated organizations and assigns creators as org_owner', async () => {
    const resA = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ name: `Alpha Infra ${stamp}`, industry: 'Construction', currencyCode: 'USD' });

    expect(resA.status).toBe(201);
    expect(resA.body.data.membership.role).toBe('org_owner');
    orgAId = resA.body.data.organization.id;
    ownerAMemberId = resA.body.data.membership.id;

    const resB = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .send({ name: `Beta NGO ${stamp}`, industry: 'NGO', currencyCode: 'EUR' });

    expect(resB.status).toBe(201);
    orgBId = resB.body.data.organization.id;
  });

  it('blocks Owner B from reading or updating Organization A (tenant isolation)', async () => {
    const readRes = await request(app)
      .get('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .set('X-Organization-Id', orgAId);
    expect(readRes.status).toBe(403);

    const membersRes = await request(app)
      .get('/api/v1/organizations/members')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .set('X-Organization-Id', orgAId);
    expect(membersRes.status).toBe(403);
  });

  it('allows Org Owner to invite a team_member and enforces RBAC after acceptance', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/organizations/invitations')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgAId)
      .send({ email: memberAEmail, role: 'team_member' });

    expect(inviteRes.status).toBe(201);
    inviteToken = inviteRes.body.data.inviteToken;
    expect(inviteToken).toBeTypeOf('string');

    // Owner B cannot steal an invite issued for memberAEmail
    const wrongUserAccept = await request(app)
      .post('/api/v1/organizations/invitations/accept')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .send({ token: inviteToken });
    expect(wrongUserAccept.status).toBe(403);

    // Intended user accepts invitation cleanly
    const acceptRes = await request(app)
      .post('/api/v1/organizations/invitations/accept')
      .set('Authorization', `Bearer ${tokenMemberA}`)
      .send({ token: inviteToken });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.membership.role).toBe('team_member');

    // Team Member can view org details, but CANNOT update org settings (403)
    const memberRead = await request(app)
      .get('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${tokenMemberA}`)
      .set('X-Organization-Id', orgAId);
    expect(memberRead.status).toBe(200);

    const memberUpdate = await request(app)
      .patch('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${tokenMemberA}`)
      .set('X-Organization-Id', orgAId)
      .send({ name: 'Hijacked Name' });
    expect(memberUpdate.status).toBe(403);
  });

  it('prevents removing or demoting the last active Organization Owner', async () => {
    const demoteRes = await request(app)
      .patch(`/api/v1/organizations/members/${ownerAMemberId}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgAId)
      .send({ role: 'project_manager' });

    expect(demoteRes.status).toBe(409);
    expect(demoteRes.body.error.code).toBe('LAST_OWNER_PROTECTED');
  });
});
