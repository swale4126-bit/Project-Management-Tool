import { describe, it, expect } from 'vitest';
import { createProjectSchema } from '../../src/modules/projects/projects.schema.js';
import { resolveSafeUploadPath } from '../../src/config/upload.js';

describe('Project Validation & Upload Path Security', () => {
  it('accepts valid project payload and normalizes projectCode to uppercase', () => {
    const parsed = createProjectSchema.body.parse({
      projectCode: 'civ-404',
      name: 'West Water Main Replacement',
      startDate: '2026-01-10',
      expectedEndDate: '2026-04-15',
      initialBudget: '95000.00',
    });

    expect(parsed.projectCode).toBe('CIV-404');
    expect(parsed.initialBudget).toBe(95000);
  });

  it('rejects project when expectedEndDate is earlier than startDate', () => {
    const result = createProjectSchema.body.safeParse({
      projectCode: 'CIV-405',
      name: 'Invalid Schedule Project',
      startDate: '2026-05-01',
      expectedEndDate: '2026-04-01',
    });

    expect(result.success).toBe(false);
  });

  it('blocks path traversal attempts in resolveSafeUploadPath', () => {
    expect(() => resolveSafeUploadPath('../.env')).toThrow();
    expect(() => resolveSafeUploadPath('..\\..\\Windows\\win.ini')).toThrow();
    expect(() => resolveSafeUploadPath('subdir/file.pdf')).toThrow();

    const safe = resolveSafeUploadPath('12345678-safe.pdf');
    expect(safe.endsWith('12345678-safe.pdf')).toBe(true);
  });
});
