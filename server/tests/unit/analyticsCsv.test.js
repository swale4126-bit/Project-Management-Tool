import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { escapeCsvCell, toCsv } from '../../src/utils/csvExport.js';

describe('Safe CSV Export & Formula Injection Defense', () => {
  it('escapes commas, double quotes, and newlines per RFC-4180', () => {
    expect(escapeCsvCell('North Corridor, Sector "A"')).toBe('"North Corridor, Sector ""A"""');
    expect(escapeCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
  });

  it('neutralizes CSV spreadsheet formula injection payloads', () => {
    expect(escapeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(escapeCsvCell('+SUM(A1:A5)')).toBe("'+SUM(A1:A5)");
    expect(escapeCsvCell('@HYPERLINK("http://evil")')).toBe('"\'@HYPERLINK(""http://evil"")"');
  });

  it('generates clean CSV output with headers and rows', () => {
    const csv = toCsv(
      [{ code: 'CIV-101', name: 'Fiber Rollout', budget: '185000.00' }],
      [
        { key: 'code', header: 'Project Code' },
        { key: 'name', header: 'Name' },
        { key: 'budget', header: 'Budget' },
      ]
    );
    expect(csv).toBe('Project Code,Name,Budget\r\nCIV-101,Fiber Rollout,185000.00');
  });

  it('requires authentication on analytics endpoints', async () => {
    const res = await request(app).get('/api/v1/analytics/organization');
    expect(res.status).toBe(401);
  });
});
