import { describe, it, expect } from 'vitest';
import { createExpenseSchema, decideExpenseSchema } from '../../src/modules/budgets/budgets.schema.js';
import { createResourceSchema } from '../../src/modules/resources/resources.schema.js';
import { computeResourceStatus } from '../../src/modules/resources/resources.repository.js';

const validUuid = '11111111-1111-4111-8111-111111111111';

describe('Budgets, Expenses & Resources Validation', () => {
  it('accepts exact 2-decimal monetary expenses and rejects 3-decimal or zero amounts', () => {
    const valid = createExpenseSchema.body.safeParse({
      projectId: validUuid,
      title: 'Diesel Generator Fuel',
      category: 'equipment',
      expenseDate: '2026-03-10',
      amount: '450.75',
    });
    expect(valid.success).toBe(true);

    const zero = createExpenseSchema.body.safeParse({
      projectId: validUuid,
      title: 'Zero Expense',
      category: 'other',
      expenseDate: '2026-03-10',
      amount: '0',
    });
    expect(zero.success).toBe(false);

    const threeDecimals = createExpenseSchema.body.safeParse({
      projectId: validUuid,
      title: 'Precision Violation',
      category: 'other',
      expenseDate: '2026-03-10',
      amount: '10.125',
    });
    expect(threeDecimals.success).toBe(false);
  });

  it('requires comments when rejecting an expense', () => {
    expect(decideExpenseSchema.body.safeParse({ decision: 'rejected', comments: '' }).success).toBe(
      false
    );
    expect(
      decideExpenseSchema.body.safeParse({
        decision: 'rejected',
        comments: 'Receipt missing VAT breakdown.',
      }).success
    ).toBe(true);
  });

  it('prevents availableQuantity > totalQuantity and computes shortage statuses accurately', () => {
    const badResource = createResourceSchema.body.safeParse({
      name: 'Excavator',
      resourceType: 'equipment',
      unit: 'units',
      totalQuantity: 2,
      availableQuantity: 5,
    });
    expect(badResource.success).toBe(false);

    expect(computeResourceStatus(0, 5)).toBe('depleted');
    expect(computeResourceStatus(4, 5)).toBe('low_stock');
    expect(computeResourceStatus(12, 5)).toBe('available');
  });
});
