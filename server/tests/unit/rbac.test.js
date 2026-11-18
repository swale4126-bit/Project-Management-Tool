import { describe, it, expect, vi } from 'vitest';
import { requireOrgRoles, requireSuperAdmin } from '../../src/middleware/authorize.js';
import { createOrganizationSchema, createInvitationSchema } from '../../src/modules/organizations/organizations.schema.js';

describe('RBAC Authorization Middleware Unit Tests', () => {
  it('blocks non-super-admins on requireSuperAdmin', () => {
    const next = vi.fn();
    requireSuperAdmin({ user: { isSuperAdmin: false } }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows super-admins on requireSuperAdmin', () => {
    const next = vi.fn();
    requireSuperAdmin({ user: { isSuperAdmin: true } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('blocks team_member and stakeholder when org_owner is required', () => {
    const guard = requireOrgRoles('org_owner');

    const nextMember = vi.fn();
    guard({ user: { isSuperAdmin: false }, org: { role: 'team_member' } }, {}, nextMember);
    expect(nextMember.mock.calls[0][0].statusCode).toBe(403);

    const nextStakeholder = vi.fn();
    guard({ user: { isSuperAdmin: false }, org: { role: 'stakeholder' } }, {}, nextStakeholder);
    expect(nextStakeholder.mock.calls[0][0].statusCode).toBe(403);
  });

  it('allows org_owner and super_admin when org_owner is required', () => {
    const guard = requireOrgRoles('org_owner');

    const nextOwner = vi.fn();
    guard({ user: { isSuperAdmin: false }, org: { role: 'org_owner' } }, {}, nextOwner);
    expect(nextOwner).toHaveBeenCalledWith();

    const nextSuper = vi.fn();
    guard({ user: { isSuperAdmin: true }, org: { role: 'super_admin' } }, {}, nextSuper);
    expect(nextSuper).toHaveBeenCalledWith();
  });
});

describe('Organization & Invitation Zod Schemas', () => {
  it('normalizes currency code to uppercase 3-letter ISO', () => {
    const parsed = createOrganizationSchema.body.parse({
      name: 'Delta Field Services',
      currencyCode: 'eur',
    });
    expect(parsed.currencyCode).toBe('EUR');
  });

  it('rejects invalid invitation role values', () => {
    const invalid = createInvitationSchema.body.safeParse({
      email: 'someone@org.local',
      role: 'super_admin',
    });
    expect(invalid.success).toBe(false);
  });
});
