-- 002_projects_milestones_tasks.sql
-- Projects, Project Members, Milestones, Tasks, Assignees, Dependencies, Comments, Attachments

-- 5. projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_code VARCHAR(32) NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'planning',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  location_name VARCHAR(180),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  start_date DATE NOT NULL,
  expected_end_date DATE NOT NULL,
  actual_completion_date DATE,
  objectives TEXT,
  success_indicators TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_projects_org_code UNIQUE (organization_id, project_code),
  CONSTRAINT chk_projects_status CHECK (status IN ('planning', 'active', 'on_hold', 'at_risk', 'completed', 'cancelled')),
  CONSTRAINT chk_projects_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_projects_dates CHECK (expected_end_date >= start_date)
);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_projects_org_status
  ON projects (organization_id, status)
  WHERE is_archived = FALSE;

-- 6. project_members
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role VARCHAR(30) NOT NULL DEFAULT 'member',
  weekly_capacity_hours NUMERIC(5, 2) NOT NULL DEFAULT 40.00,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_members_proj_user UNIQUE (project_id, user_id),
  CONSTRAINT chk_project_members_role CHECK (project_role IN ('manager', 'member', 'stakeholder')),
  CONSTRAINT chk_project_members_capacity CHECK (weekly_capacity_hours >= 0)
);

CREATE INDEX IF NOT EXISTS idx_project_members_org_user
  ON project_members (organization_id, user_id);

-- 7. project_milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_milestones_status CHECK (status IN ('pending', 'in_progress', 'completed', 'missed'))
);

DROP TRIGGER IF EXISTS trg_project_milestones_updated_at ON project_milestones;
CREATE TRIGGER trg_project_milestones_updated_at
  BEFORE UPDATE ON project_milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_milestones_org_project_date
  ON project_milestones (organization_id, project_id, target_date);

-- 8. tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'todo',
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  estimated_hours NUMERIC(6, 2),
  actual_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  progress_percent SMALLINT NOT NULL DEFAULT 0,
  labels TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_tasks_status CHECK (status IN ('backlog', 'todo', 'in_progress', 'blocked', 'in_review', 'completed')),
  CONSTRAINT chk_tasks_estimated_hours CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  CONSTRAINT chk_tasks_actual_hours CHECK (actual_hours >= 0),
  CONSTRAINT chk_tasks_progress CHECK (progress_percent BETWEEN 0 AND 100),
  CONSTRAINT chk_tasks_dates CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
);

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_org_project_status
  ON tasks (organization_id, project_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_overdue_lookup
  ON tasks (organization_id, due_date)
  WHERE status <> 'completed' AND due_date IS NOT NULL;

-- 9. task_assignees
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user
  ON task_assignees (user_id);

-- 10. task_dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_task_dependencies_pair UNIQUE (task_id, depends_on_task_id),
  CONSTRAINT chk_task_dependencies_no_self CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_project
  ON task_dependencies (project_id, task_id);

-- 11. task_comments
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_task_comments_updated_at ON task_comments;
CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_task_comments_task_time
  ON task_comments (task_id, created_at ASC);

-- 12. task_attachments
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  original_name VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_task_attachments_size CHECK (file_size_bytes > 0)
);
