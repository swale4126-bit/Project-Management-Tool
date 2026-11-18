import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Notifications & Activity Logs Endpoint Guards', () => {
  it('requires authentication on GET /api/v1/notifications', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('requires authentication on GET /api/v1/activity-logs', async () => {
    const res = await request(app).get('/api/v1/activity-logs');
    expect(res.status).toBe(401);
  });
});
