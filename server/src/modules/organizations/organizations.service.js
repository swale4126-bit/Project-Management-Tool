import crypto from 'node:crypto';
import { withTransaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';
import * as orgRepo from './organizations.repository.js';

function slugify(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'organization';
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function formatOrg(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    description: row.description,
    currencyCode: row.currency_code,
    timezone: row.timezone,
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createOrganization(userId, payload) {
  return withTransaction(async (client) => {
    let slug = slugify(payload.name);
    const existing = await orgRepo.findOrgBySlug(slug, client);
    if (existing) {
      slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const org = await orgRepo.createOrg(
      {
        name: payload.name,
        slug,
        industry: payload.industry,
        description: payload.description,
        currencyCode: payload.currencyCode || 'USD',
        timezone: payload.timezone || 'UTC',
        createdBy: userId,
      },
      client
    );

    const membership = await orgRepo.addMember(
      { organizationId: org.id, userId, role: 'org_owner' },
      client
    );

    await logActivity(
      {
        organizationId: org.id,
        actorId: userId,
        action: 'organization.created',
        entityType: 'organization',
        entityId: org.id,
        summary: `Created organization "${org.name}"`,
        metadata: { slug: org.slug },
      },
      client
    );

    return {
      organization: formatOrg(org),
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
      },
    };
  });
}

export async function getCurrentOrganization(orgId) {
  const org = await orgRepo.findOrgById(orgId);
  if (!org) {
    throw AppError.notFound('Organization not found.');
  }
  return formatOrg(org);
}

export async function updateCurrentOrganization(orgId, actorId, payload) {
  return withTransaction(async (client) => {
    const updated = await orgRepo.updateOrg(orgId, payload, client);
    if (!updated) {
      throw AppError.notFound('Organization not found.');
    }

    await logActivity(
      {
        organizationId: orgId,
        actorId,
        action: 'organization.updated',
        entityType: 'organization',
        entityId: orgId,
        summary: `Updated organization settings for "${updated.name}"`,
        metadata: { updatedFields: Object.keys(payload) },
      },
      client
    );

    return formatOrg(updated);
  });
}

export async function listMembers(orgId) {
  const rows = await orgRepo.listMembers(orgId);
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    jobTitle: row.job_title,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
  }));
}

export async function updateMember(orgId, memberId, actorId, { role, status }) {
  return withTransaction(async (client) => {
    const existing = await orgRepo.findMemberById(orgId, memberId, client);
    if (!existing) {
      throw AppError.notFound('Organization member not found.');
    }

    const isDemotingOwner =
      existing.role === 'org_owner' &&
      existing.status === 'active' &&
      ((role !== undefined && role !== 'org_owner') || status === 'suspended');

    if (isDemotingOwner) {
      const ownerCount = await orgRepo.countActiveOwners(orgId, client);
      if (ownerCount <= 1) {
        throw AppError.conflict(
          'Cannot demote or suspend the last active Organization Owner.',
          'LAST_OWNER_PROTECTED'
        );
      }
    }

    const updated = await orgRepo.updateMember(orgId, memberId, { role, status }, client);

    await logActivity(
      {
        organizationId: orgId,
        actorId,
        action: 'organization.member_updated',
        entityType: 'organization_member',
        entityId: memberId,
        summary: `Updated member ${existing.full_name} (${existing.role} → ${updated.role}, status: ${updated.status})`,
        metadata: {
          previousRole: existing.role,
          newRole: updated.role,
          previousStatus: existing.status,
          newStatus: updated.status,
        },
      },
      client
    );

    return updated;
  });
}

export async function removeMember(orgId, memberId, actorId) {
  return withTransaction(async (client) => {
    const existing = await orgRepo.findMemberById(orgId, memberId, client);
    if (!existing) {
      throw AppError.notFound('Organization member not found.');
    }

    if (existing.role === 'org_owner' && existing.status === 'active') {
      const ownerCount = await orgRepo.countActiveOwners(orgId, client);
      if (ownerCount <= 1) {
        throw AppError.conflict(
          'Cannot remove the last active Organization Owner.',
          'LAST_OWNER_PROTECTED'
        );
      }
    }

    await orgRepo.removeMember(orgId, memberId, client);

    await logActivity(
      {
        organizationId: orgId,
        actorId,
        action: 'organization.member_removed',
        entityType: 'organization_member',
        entityId: memberId,
        summary: `Removed ${existing.full_name} (${existing.email}) from organization`,
        metadata: { removedUserId: existing.user_id, previousRole: existing.role },
      },
      client
    );

    return { removedMemberId: memberId };
  });
}

export async function createInvitation(orgId, actorId, { email, role, expiresInDays }) {
  return withTransaction(async (client) => {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await orgRepo.createInvitation(
      {
        organizationId: orgId,
        email,
        role,
        tokenHash,
        invitedBy: actorId,
        expiresAt,
      },
      client
    );

    await logActivity(
      {
        organizationId: orgId,
        actorId,
        action: 'invitation.created',
        entityType: 'invitation',
        entityId: invitation.id,
        summary: `Invited ${email} as ${role}`,
        metadata: { email, role },
      },
      client
    );

    // Raw token is returned ONCE to the inviting owner (never stored in plaintext in DB)
    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      },
      inviteToken: rawToken,
    };
  });
}

export async function listInvitations(orgId) {
  const rows = await orgRepo.listInvitations(orgId);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    invitedByName: row.invited_by_name,
  }));
}

export async function revokeInvitation(orgId, invitationId, actorId) {
  return withTransaction(async (client) => {
    const revoked = await orgRepo.revokeInvitation(orgId, invitationId, client);
    if (!revoked) {
      throw AppError.notFound('Pending invitation not found.');
    }

    await logActivity(
      {
        organizationId: orgId,
        actorId,
        action: 'invitation.revoked',
        entityType: 'invitation',
        entityId: invitationId,
        summary: `Revoked invitation for ${revoked.email}`,
      },
      client
    );

    return revoked;
  });
}

export async function acceptInvitation(userId, userEmail, rawToken) {
  return withTransaction(async (client) => {
    const tokenHash = hashToken(rawToken);
    const invite = await orgRepo.findInvitationByTokenHash(tokenHash, client);

    if (!invite) {
      throw AppError.notFound('Invitation token is invalid.', 'INVALID_INVITATION');
    }
    if (invite.status !== 'pending') {
      throw AppError.conflict(`This invitation has already been ${invite.status}.`, 'INVITATION_UNAVAILABLE');
    }
    if (new Date(invite.expires_at) < new Date()) {
      throw AppError.conflict('This invitation has expired.', 'INVITATION_EXPIRED');
    }
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw AppError.forbidden(
        'This invitation was issued for a different email address.',
        'INVITATION_EMAIL_MISMATCH'
      );
    }

    const existingMember = await orgRepo.findMemberByUserId(invite.organization_id, userId, client);
    if (existingMember) {
      throw AppError.conflict('You are already a member of this organization.', 'ALREADY_MEMBER');
    }

    const membership = await orgRepo.addMember(
      { organizationId: invite.organization_id, userId, role: invite.role },
      client
    );

    await orgRepo.markInvitationAccepted(invite.id, client);

    await logActivity(
      {
        organizationId: invite.organization_id,
        actorId: userId,
        action: 'invitation.accepted',
        entityType: 'organization_member',
        entityId: membership.id,
        summary: `Joined "${invite.organization_name}" as ${invite.role}`,
      },
      client
    );

    return {
      organization: {
        id: invite.organization_id,
        name: invite.organization_name,
        slug: invite.organization_slug,
      },
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
      },
    };
  });
}
