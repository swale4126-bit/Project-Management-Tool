import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('FieldLedger API Bootstrap Health Check', () => {
  it('returns 200 OK from GET /api/v1/health with standard envelope', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('FieldLedger API');
    expect(response.body.data.status).toBe('ok');
  });

  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
