-- 003_field_reports_budgets_resources.sql
-- Field Reports, Review History, Budgets, Expenses, Approvals, Resources & Allocations

-- 13. field_reports
CREATE TABLE IF NOT EXISTS field_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  activity_date DATE NOT NULL,
  location_name VARCHAR(180) NOT NULL,
  work_completed TEXT NOT NULL,
  challenges_blockers TEXT,
  resources_used_summary TEXT,
  progress_contribution_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  evidence_file_name VARCHAR(255),
  evidence_stored_path VARCHAR(255),
  evidence_mime_type VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_field_reports_status CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  CONSTRAINT chk_field_reports_progress CHECK (progress_contribution_pct BETWEEN 0 AND 100)
);

DROP TRIGGER IF EXISTS trg_field_reports_updated_at ON field_reports;
CREATE TRIGGER trg_field_reports_updated_at
  BEFORE UPDATE ON field_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_field_reports_org_proj_status
  ON field_reports (organization_id, project_id, status, activity_date DESC);

-- 14. field_report_reviews (immutable review audit history)
CREATE TABLE IF NOT EXISTS field_report_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_report_id UUID NOT NULL REFERENCES field_reports(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fr_reviews_new_status CHECK (new_status IN ('submitted', 'under_review', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_fr_reviews_report_time
  ON field_report_reviews (field_report_id, reviewed_at DESC);

-- 15. budgets (exact NUMERIC(14,2) financial storage)
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  planned_amount NUMERIC(14, 2) NOT NULL,
  contingency_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_budgets_planned_nonneg CHECK (planned_amount >= 0),
  CONSTRAINT chk_budgets_contingency_nonneg CHECK (contingency_amount >= 0)
);

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 16. expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(60) NOT NULL,
  expense_date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  vendor_name VARCHAR(150),
  description TEXT,
  receipt_original_name VARCHAR(255),
  receipt_stored_path VARCHAR(255),
  receipt_mime_type VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_expenses_amount_pos CHECK (amount > 0),
  CONSTRAINT chk_expenses_category CHECK (category IN ('materials', 'labor', 'equipment', 'transport', 'permits', 'subcontractor', 'other')),
  CONSTRAINT chk_expenses_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_expenses_org_proj_status
  ON expenses (organization_id, project_id, status, expense_date DESC);

-- 17. expense_approvals (immutable financial approval audit trail)
CREATE TABLE IF NOT EXISTS expense_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision VARCHAR(20) NOT NULL,
  comments TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_expense_approvals_decision CHECK (decision IN ('approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_expense_approvals_expense
  ON expense_approvals (expense_id, decided_at DESC);

-- 18. resources
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  resource_type VARCHAR(40) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  total_quantity NUMERIC(12, 2) NOT NULL,
  available_quantity NUMERIC(12, 2) NOT NULL,
  min_threshold NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_resources_type CHECK (resource_type IN ('equipment', 'material', 'vehicle', 'tool', 'software', 'other')),
  CONSTRAINT chk_resources_qty CHECK (total_quantity >= 0 AND available_quantity >= 0 AND available_quantity <= total_quantity),
  CONSTRAINT chk_resources_threshold CHECK (min_threshold >= 0),
  CONSTRAINT chk_resources_cost CHECK (unit_cost >= 0),
  CONSTRAINT chk_resources_status CHECK (status IN ('available', 'low_stock', 'depleted', 'maintenance'))
);

DROP TRIGGER IF EXISTS trg_resources_updated_at ON resources;
CREATE TRIGGER trg_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_resources_org_type
  ON resources (organization_id, resource_type);

-- 19. resource_assignments
CREATE TABLE IF NOT EXISTS resource_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity_allocated NUMERIC(12, 2) NOT NULL,
  quantity_used NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_res_assign_alloc_pos CHECK (quantity_allocated > 0),
  CONSTRAINT chk_res_assign_used_valid CHECK (quantity_used >= 0 AND quantity_used <= quantity_allocated),
  CONSTRAINT chk_res_assign_status CHECK (status IN ('active', 'returned', 'consumed'))
);

DROP TRIGGER IF EXISTS trg_resource_assignments_updated_at ON resource_assignments;
CREATE TRIGGER trg_resource_assignments_updated_at
  BEFORE UPDATE ON resource_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_res_assign_org_proj
  ON resource_assignments (organization_id, project_id, status);
