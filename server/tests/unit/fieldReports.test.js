import { describe, it, expect } from 'vitest';
import { canTransitionFieldReport } from '../../src/modules/fieldReports/fieldReports.service.js';
import { reviewFieldReportSchema } from '../../src/modules/fieldReports/fieldReports.schema.js';

describe('Field Report Workflow State Machine', () => {
  it('allows valid Draft -> Submitted -> Under Review -> Approved/Rejected transitions', () => {
    expect(canTransitionFieldReport('draft', 'submitted')).toBe(true);
    expect(canTransitionFieldReport('submitted', 'under_review')).toBe(true);
    expect(canTransitionFieldReport('submitted', 'approved')).toBe(true);
    expect(canTransitionFieldReport('under_review', 'approved')).toBe(true);
    expect(canTransitionFieldReport('under_review', 'rejected')).toBe(true);
    expect(canTransitionFieldReport('rejected', 'submitted')).toBe(true);
  });

  it('blocks illegal workflow transitions', () => {
    expect(canTransitionFieldReport('draft', 'approved')).toBe(false);
    expect(canTransitionFieldReport('approved', 'rejected')).toBe(false);
    expect(canTransitionFieldReport('approved', 'submitted')).toBe(false);
    expect(canTransitionFieldReport('rejected', 'approved')).toBe(false);
  });

  it('requires reviewNotes when rejecting a report', () => {
    const missingNotes = reviewFieldReportSchema.body.safeParse({
      decision: 'rejected',
      reviewNotes: '',
    });
    expect(missingNotes.success).toBe(false);

    const withNotes = reviewFieldReportSchema.body.safeParse({
      decision: 'rejected',
      reviewNotes: 'Missing site photo of junction seal.',
    });
    expect(withNotes.success).toBe(true);
  });
});
