-- 001_core_identity_and_orgs.sql
-- Shared updated_at trigger function + Users, Organizations, Memberships, Invitations

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  job_title VARCHAR(100),
  phone VARCHAR(30),
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_users_email_lowercase CHECK (email = LOWER(email))
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  industry VARCHAR(80),
  description TEXT,
  currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  timezone VARCHAR(60) NOT NULL DEFAULT 'UTC',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. organization_members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_members_org_user UNIQUE (organization_id, user_id),
  CONSTRAINT chk_org_members_role CHECK (role IN ('org_owner', 'project_manager', 'team_member', 'stakeholder')),
  CONSTRAINT chk_org_members_status CHECK (status IN ('active', 'suspended'))
);

DROP TRIGGER IF EXISTS trg_organization_members_updated_at ON organization_members;
CREATE TRIGGER trg_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_org_members_user_org
  ON organization_members (user_id, organization_id);

-- 4. invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_invitations_email_lowercase CHECK (email = LOWER(email)),
  CONSTRAINT chk_invitations_role CHECK (role IN ('org_owner', 'project_manager', 'team_member', 'stakeholder')),
  CONSTRAINT chk_invitations_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_invitations_org_status
  ON invitations (organization_id, status);
