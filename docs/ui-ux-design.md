# FieldLedger — UI/UX & Design System Specification (Phase 1)

## 1. Visual Identity & Design Inspiration

Synthesizing your two reference dashboards into a cohesive **Field Operations Command Center** design system:

- **Primary Theme (Dark Command Center — Default):** Deep navy-slate canvas (`#0B1120`), elevated surface cards (`#111827` / `#162033`), crisp hairline borders (`#1F2937` / `#263248`), high-contrast slate typography (`#F8FAFC` / `#94A3B8`) — inspired by your first sample dashboard and the top of your second sample.
- **Secondary Theme (Clean Daylight Mode — Toggleable):** Crisp off-white canvas (`#F8FAFC`), pure white cards (`#FFFFFF`), subtle borders (`#E2E8F0`) — ideal for dense tables, Gantt timelines, and field-site tablet use in bright outdoor sunlight (inspired by the bottom resource planner in your second sample).
- **Semantic Accent Palette (WCAG AA Accessible):**
  - Primary Brand Action: **Electric Blue** (`#3B82F6` / `#2563EB`)
  - Field Progress / Approved / Healthy: **Emerald** (`#10B981`)
  - Pending / In Progress / Caution: **Amber** (`#F59E0B`)
  - At Risk / Overdue / Critical / Rejected: **Rose Red** (`#EF4444`)
  - Capacity / Milestones / Analytics Secondary: **Indigo / Violet** (`#6366F1`)

---

## 2. Application Shell Layout

```text
+-----------------------------------------------------------------------------+
|  [FieldLedger Logo]  [Org Switcher v]   [Global Search]   [Theme] [Bell] [U]|
+------------------+----------------------------------------------------------+
| SIDEBAR          | MAIN CONTENT AREA (Scrollable, Max-Width Container)      |
|                  |                                                          |
| - Dashboard      |  Page Header (Title, Breadcrumbs, Primary Action Button) |
| - Projects       |  ------------------------------------------------------  |
| - Tasks & Board  |  KPI Summary Strip (4–5 Metric Cards)                    |
| - Calendar       |  ------------------------------------------------------  |
| - Field Reports  |  Primary Workspace Grid (Charts / Tables / Kanban /      |
| - Budgets        |  Gantt Timeline / Map / Review Queue)                    |
| - Resources      |                                                          |
| - Risks & Issues |                                                          |
| - Analytics      |                                                          |
| - Notifications  |                                                          |
| ---------------- |                                                          |
| - Team & Profile |                                                          |
| - Org Settings   |                                                          |
+------------------+----------------------------------------------------------+
```

- **Responsive Behavior:**
  - **Desktop (`>= 1024px`):** Persistent collapsible left sidebar (`248px` expanded / `72px` collapsed) + top bar.
  - **Tablet (`768px–1023px`):** Collapsible slide-over sidebar drawer + responsive 2-column KPI grids.
  - **Mobile (`< 768px`):** Drawer menu + stacked cards + horizontally scrollable tables/Kanban columns (optimized for field technicians submitting field reports on phones/tablets).

---

## 3. Purpose-Built Page Designs (20 Pages)

Every page is tailored to its operational workflow rather than repeating identical CRUD templates:

1. **Login (`/login`):** Split layout — FieldLedger operational value summary on left, clean validated form on right.
2. **Registration (`/register`):** Account creation with live password-strength checklist.
3. **Organization Setup (`/setup-organization`):** Dual-path onboarding card: *"Create New Organization"* or *"Join via Invitation Code"*.
4. **Organization Dashboard (`/dashboard`):** *(Inspired by Sample 1)*
   - Top 5 KPI strip: Active Projects, Team Members, Overdue Tasks, Budget Utilization %, Critical / At-Risk Projects.
   - Left column: Active Projects Progress Table (Planned vs Field-Reported progress bars, Est. End Date, Quick Actions: *Report* / *Open*) + Cumulative Progress Trend Line.
   - Right column: **Operating Sites Map / Location Summary**, **Projects to Monitor (At-Risk Watchlist)** in red-accented alert cards, and **Budget vs Spend Bar Chart**.
5. **Project Listing (`/projects`):** Filter bar (status, priority, search, show archived) + toggle between rich Project Cards and sortable Data Table.
6. **Project Creation (`/projects/new`):** Structured 3-section form (Core Info & Dates, Location & Coordinates, Objectives & Initial Budget).
7. **Project Details (`/projects/:id`):** *(Inspired by Sample 2 Top)*
   - Project header with status badge, manager avatar, and horizontal sub-navigation tabs: **Overview | Tasks | Timeline | Team | Field Reports | Budget | Risks | Documents | Activity**.
   - Overview tab includes: Semi-circular **Overall Completion Gauge**, **Task Status Donut**, **Budget Burn Card**, **High-Priority Risks Panel**, and **Live Activity Feed**.
8. **Project Team (`/projects/:id/team`):** Member roster with project roles, weekly capacity hours, assigned task count, and add/remove controls (PM/Owner only).
9. **Task Board (`/projects/:id/tasks` & `/tasks`):** View toggle (**Kanban Board** across 6 status columns vs **Structured List View**), quick filters (assignee, priority, overdue only), and slide-over Quick Create modal.
10. **Task Details (`/tasks/:id`):** Two-column detail layout — left: description, subtasks checklist, prerequisite/dependent tasks graph list, attachments & comments thread; right: status, priority, assignees, milestone link, dates, estimated vs actual hours.
11. **Calendar (`/calendar`):** Interactive monthly/weekly calendar plotting task due dates and milestone targets color-coded by priority/status, with project filter.
12. **Milestones & Timeline (`/projects/:id/timeline`):** Milestone completion cards with overdue badges above a **database-driven Gantt timeline** displaying date scales, task bars, milestone diamonds, and dependency indicators.
13. **Field Reports (`/field-reports`):** Split experience — *"Submit Field Report"* drawer/form (project, task, date, location, completed work, blockers, resources used, photo upload) + tabbed Review Queue (`All | Pending Review | Approved | Rejected | My Drafts`) with full review history timeline.
14. **Budget & Expenses (`/budgets`):** Financial KPI cards (Total Planned, Approved Spend, Pending Approval, Remaining Balance), Category Breakdown chart, Expense Table with receipt preview modal, and Manager Approve/Reject action bar with mandatory comment on rejection.
15. **Resources (`/resources`):** *(Inspired by Sample 2 Bottom)* Resource inventory cards with **Low-Stock / Shortage Alert** badges, Allocation modal, and a **Team & Resource Capacity Timeline** showing weekly utilization bars.
16. **Risks & Issues (`/risks`):** 5×5 **Risk Heat Matrix** (Probability × Impact), sortable Risk Register with mitigation plans & review dates, plus a dedicated **Issues & Blockers** tab.
17. **Notifications (`/notifications`):** Unread count badge in topbar + dedicated filterable Notification Center with deep links to the exact task/report/expense/risk.
18. **Analytics & Reports (`/analytics`):** Role switcher (**Organization Overview | Project Deep-Dive | My Workload**), date-range & project filters, Recharts visualizations, and one-click **CSV Export** buttons.
19. **Organization Settings (`/settings/organization`):** Org profile editor, currency/timezone settings, member role management table, and Invitation generator/tracker.
20. **User Profile & Team (`/profile`, `/team`):** Profile form, secure password change form, and searchable Organization Directory.

---

## 4. Mandatory UX Quality States

Every screen and widget must implement four explicit UI states:
1. **Loading State:** Animated skeleton placeholders matching the exact card/table layout (no jarring layout shift).
2. **Empty State:** Contextual icon, plain-language explanation, and a primary CTA button (respecting user role permissions).
3. **Error State:** Clear inline error banner with a **"Retry"** button calling TanStack Query's `refetch()`.
4. **Confirmation & Feedback:** Confirmation dialogs (`ConfirmDialog`) for destructive/final actions (archive project, reject expense, remove member) + non-intrusive toast notifications for mutations.
