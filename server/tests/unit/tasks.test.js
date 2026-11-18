import { describe, it, expect } from 'vitest';
import { createTaskSchema, updateTaskSchema } from '../../src/modules/tasks/tasks.schema.js';
import { createMilestoneSchema } from '../../src/modules/milestones/milestones.schema.js';

const validUuid = '11111111-1111-4111-8111-111111111111';

describe('Tasks & Milestones Zod Schemas', () => {
  it('accepts a valid task payload with assignees and labels', () => {
    const parsed = createTaskSchema.body.parse({
      projectId: validUuid,
      title: 'Inspect Pump Valve Seals',
      priority: 'high',
      status: 'in_progress',
      startDate: '2026-02-01',
      dueDate: '2026-02-10',
      estimatedHours: 12,
      labels: ['field-ops', 'mechanical'],
      assigneeIds: [validUuid],
    });

    expect(parsed.title).toBe('Inspect Pump Valve Seals');
    expect(parsed.labels).toEqual(['field-ops', 'mechanical']);
  });

  it('rejects a task whose dueDate precedes startDate', () => {
    const result = createTaskSchema.body.safeParse({
      projectId: validUuid,
      title: 'Bad Dates Task',
      startDate: '2026-03-10',
      dueDate: '2026-03-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty task update payloads', () => {
    const result = updateTaskSchema.body.safeParse({});
    expect(result.success).toBe(false);
  });

  it('validates milestone creation payload', () => {
    const parsed = createMilestoneSchema.body.parse({
      projectId: validUuid,
      title: 'Commissioning Sign-Off',
      targetDate: '2026-04-30',
    });
    expect(parsed.status).toBe('pending');
  });
});
