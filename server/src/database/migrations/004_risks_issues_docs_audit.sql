-- 004_risks_issues_docs_audit.sql
-- Risks, Issues, Project Documents, Notifications, and Server-Side Activity Logs

-- 20. risks
CREATE TABLE IF NOT EXISTS risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  probability SMALLINT NOT NULL,
  impact SMALLINT NOT NULL,
  severity SMALLINT GENERATED ALWAYS AS (probability * impact) STORED,
  mitigation_plan TEXT,
  review_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'identified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_risks_probability CHECK (probability BETWEEN 1 AND 5),
  CONSTRAINT chk_risks_impact CHECK (impact BETWEEN 1 AND 5),
  CONSTRAINT chk_risks_status CHECK (status IN ('identified', 'monitoring', 'mitigated', 'occurred', 'closed'))
);

DROP TRIGGER IF EXISTS trg_risks_updated_at ON risks;
CREATE TRIGGER trg_risks_updated_at
  BEFORE UPDATE ON risks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_risks_org_proj_severity
  ON risks (organization_id, project_id, severity DESC);

-- 21. issues
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_issues_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_issues_status CHECK (status IN ('open', 'investigating', 'resolved', 'closed'))
);

DROP TRIGGER IF EXISTS trg_issues_updated_at ON issues;
CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_issues_org_proj_status
  ON issues (organization_id, project_id, status);

-- 22. documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  original_name VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_documents_size CHECK (file_size_bytes > 0),
  CONSTRAINT chk_documents_version CHECK (version >= 1)
);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_documents_org_proj
  ON documents (organization_id, project_id, created_at DESC);

-- 23. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_id, organization_id, is_read, created_at DESC);

-- 24. activity_logs (server-side immutable audit history)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org_proj_time
  ON activity_logs (organization_id, project_id, created_at DESC);
