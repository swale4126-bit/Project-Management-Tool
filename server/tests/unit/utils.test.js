import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { addMoney, subtractMoney, calculateUtilizationPct, toCents } from '../../src/utils/money.js';
import { wouldCreateCycle } from '../../src/utils/dagValidator.js';
import { registerSchema, changePasswordSchema } from '../../src/modules/auth/auth.schema.js';

describe('Monetary Exact Arithmetic Utilities', () => {
  it('avoids floating-point drift on 0.10 + 0.20', () => {
    expect(addMoney('0.10', '0.20')).toBe('0.30');
    expect(addMoney(42650.5, 4850.25)).toBe('47500.75');
  });

  it('subtracts amounts accurately and computes utilization percentage', () => {
    expect(subtractMoney('185000.00', '42650.50')).toBe('142349.50');
    expect(calculateUtilizationPct('46250.00', '185000.00')).toBe(25);
    expect(calculateUtilizationPct('100.00', '0.00')).toBe(0);
  });

  it('rejects malformed monetary strings', () => {
    expect(() => toCents('12.345')).toThrow();
    expect(() => toCents('abc')).toThrow();
  });
});

describe('Task Dependency DAG Cycle Detection', () => {
  it('blocks self-dependencies', () => {
    expect(wouldCreateCycle([], 'task-a', 'task-a')).toBe(true);
  });

  it('blocks indirect cycles (A -> B -> C and adding C -> A)', () => {
    const edges = [
      { task_id: 'A', depends_on_task_id: 'B' },
      { task_id: 'B', depends_on_task_id: 'C' },
    ];
    expect(wouldCreateCycle(edges, 'C', 'A')).toBe(true);
    expect(wouldCreateCycle(edges, 'B', 'A')).toBe(true);
  });

  it('allows valid diamond DAG structures', () => {
    const edges = [
      { task_id: 'D', depends_on_task_id: 'B' },
      { task_id: 'D', depends_on_task_id: 'C' },
      { task_id: 'B', depends_on_task_id: 'A' },
    ];
    // Adding C -> A forms a valid diamond (no cycle)
    expect(wouldCreateCycle(edges, 'C', 'A')).toBe(false);
  });
});

describe('Auth Validation & Middleware Guards', () => {
  it('normalizes email to lowercase and enforces password policy', () => {
    const valid = registerSchema.body.parse({
      fullName: '  Alex Morgan ',
      email: 'Alex.Morgan@Example.ORG',
      password: 'Password123',
    });
    expect(valid.email).toBe('alex.morgan@example.org');
    expect(valid.fullName).toBe('Alex Morgan');

    const weak = registerSchema.body.safeParse({
      fullName: 'Alex Morgan',
      email: 'alex@example.org',
      password: 'weak',
    });
    expect(weak.success).toBe(false);
  });

  it('rejects changing password to the same password', () => {
    const same = changePasswordSchema.body.safeParse({
      currentPassword: 'Password123',
      newPassword: 'Password123',
    });
    expect(same.success).toBe(false);
  });

  it('returns 400 VALIDATION_ERROR on invalid POST /api/v1/auth/register payload', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'A',
      email: 'not-an-email',
      password: '123',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('returns 401 UNAUTHORIZED on GET /api/v1/auth/me without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 INVALID_TOKEN on GET /api/v1/auth/me with tampered JWT', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});
