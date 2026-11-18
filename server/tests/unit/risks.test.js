import { describe, it, expect } from 'vitest';
import { classifyRiskSeverity } from '../../src/modules/risks/risks.repository.js';
import { createRiskSchema, createIssueSchema } from '../../src/modules/risks/risks.schema.js';

const validUuid = '11111111-1111-4111-8111-111111111111';

describe('Risks & Issues Validation and Severity Matrix', () => {
  it('classifies probability x impact severity bands accurately', () => {
    expect(classifyRiskSeverity(20)).toBe('critical');
    expect(classifyRiskSeverity(15)).toBe('critical');
    expect(classifyRiskSeverity(12)).toBe('high');
    expect(classifyRiskSeverity(6)).toBe('medium');
    expect(classifyRiskSeverity(3)).toBe('low');
  });

  it('rejects probability or impact outside 1..5', () => {
    expect(
      createRiskSchema.body.safeParse({
        projectId: validUuid,
        title: 'Flood Risk',
        description: 'Seasonal river flooding.',
        probability: 6,
        impact: 5,
      }).success
    ).toBe(false);

    expect(
      createRiskSchema.body.safeParse({
        projectId: validUuid,
        title: 'Flood Risk',
        description: 'Seasonal river flooding.',
        probability: 4,
        impact: 5,
      }).success
    ).toBe(true);
  });

  it('validates issue creation schema', () => {
    const parsed = createIssueSchema.body.parse({
      projectId: validUuid,
      title: 'Substation permit delayed',
      description: 'Municipal inspector requested revised grounding drawing.',
      severity: 'high',
    });
    expect(parsed.severity).toBe('high');
  });
});
