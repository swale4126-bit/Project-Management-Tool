import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../config/db.js';
import { runMigrations } from './migrate.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Seeds realistic, non-personal development data across 2 isolated organizations
 * covering all 5 RBAC roles and every core FieldLedger workflow.
 * Idempotent: skips seeding if the sample organizations already exist.
 */
export async function seedDatabase(targetPool = pool) {
  if (!targetPool) {
    throw new Error('DATABASE_URL is not configured. Create server/.env before seeding.');
  }

  await runMigrations(targetPool);

  const existing = await targetPool.query(
    `SELECT id FROM organizations WHERE slug = 'civitas-field-ops' LIMIT 1`
  );
  if (existing.rowCount > 0) {
    return { skipped: true, reason: 'Sample organizations already exist.' };
  }

  const devPasswordHash = await bcrypt.hash('Password123!', 10);

  await withTransaction(async (client) => {
    // 1. Users (fictional personas, never real personal data)
    const usersData = [
      ['System Admin', 'admin@fieldledger.local', 'Platform Administrator', true],
      ['Nadia Vance', 'owner@civitas.local', 'Director of Operations', false],
      ['Marcus Cole', 'pm@civitas.local', 'Senior Project Manager', false],
      ['Elena Park', 'tech1@civitas.local', 'Lead Field Engineer', false],
      ['Devon Brooks', 'tech2@civitas.local', 'Field Operations Technician', false],
      ['Clara Jensen', 'stakeholder@civitas.local', 'Municipal Oversight Auditor', false],
      ['Tariq Haddad', 'owner@greengrid.local', 'Executive Director', false],
    ];

    const userIds = {};
    for (const [fullName, email, jobTitle, isSuperAdmin] of usersData) {
      const res = await client.query(
        `INSERT INTO users (full_name, email, password_hash, job_title, is_super_admin)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id, email`,
        [fullName, email, devPasswordHash, jobTitle, isSuperAdmin]
      );
      userIds[email] = res.rows[0].id;
    }

    // 2. Two Separate Organizations (demonstrates tenant isolation)
    const org1Res = await client.query(
      `INSERT INTO organizations (name, slug, industry, description, currency_code, timezone, created_by)
       VALUES ($1, $2, $3, $4, 'USD', 'UTC', $5)
       RETURNING id`,
      [
        'Civitas Field Infrastructure',
        'civitas-field-ops',
        'Infrastructure & Field Services',
        'Regional civil infrastructure, microgrid installation, and water utility operations.',
        userIds['owner@civitas.local'],
      ]
    );
    const org1Id = org1Res.rows[0].id;

    const org2Res = await client.query(
      `INSERT INTO organizations (name, slug, industry, description, currency_code, timezone, created_by)
       VALUES ($1, $2, $3, $4, 'USD', 'UTC', $5)
       RETURNING id`,
      [
        'GreenGrid Community NGO',
        'greengrid-ngo',
        'Non-Profit & Community Development',
        'Independent rural solar and clean-water deployment organization.',
        userIds['owner@greengrid.local'],
      ]
    );
    const org2Id = org2Res.rows[0].id;

    // 3. Organization Memberships
    const memberships = [
      [org1Id, userIds['owner@civitas.local'], 'org_owner'],
      [org1Id, userIds['pm@civitas.local'], 'project_manager'],
      [org1Id, userIds['tech1@civitas.local'], 'team_member'],
      [org1Id, userIds['tech2@civitas.local'], 'team_member'],
      [org1Id, userIds['stakeholder@civitas.local'], 'stakeholder'],
      [org2Id, userIds['owner@greengrid.local'], 'org_owner'],
    ];
    for (const [orgId, userId, role] of memberships) {
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [orgId, userId, role]
      );
    }

    // 4. Projects (Org 1: 3 projects; Org 2: 1 private project for isolation tests)
    const p1Res = await client.query(
      `INSERT INTO projects (
         organization_id, project_code, name, description, status, priority, manager_id,
         location_name, latitude, longitude, start_date, expected_end_date,
         objectives, success_indicators, created_by
       ) VALUES ($1, 'CIV-101', 'North Corridor Fiber & Conduit Rollout',
         'Underground fiber trenching, conduit laying, and junction box commissioning across 14 km.',
         'active', 'high', $2, 'North Industrial Corridor', 40.712800, -74.006000,
         CURRENT_DATE - INTERVAL '35 days', CURRENT_DATE + INTERVAL '55 days',
         'Deliver redundant high-capacity conduit across 6 sector hubs.',
         '100% pressure-tested conduit segments and zero safety incidents.', $3)
       RETURNING id`,
      [org1Id, userIds['pm@civitas.local'], userIds['owner@civitas.local']]
    );
    const p1Id = p1Res.rows[0].id;

    const p2Res = await client.query(
      `INSERT INTO projects (
         organization_id, project_code, name, description, status, priority, manager_id,
         location_name, latitude, longitude, start_date, expected_end_date,
         objectives, success_indicators, created_by
       ) VALUES ($1, 'CIV-102', 'Riverbend Pump Station Retrofit',
         'Replacement of primary intake turbines, SCADA telemetry sensors, and backup switchgear.',
         'at_risk', 'critical', $2, 'Riverbend Basin Site B', 34.052200, -118.243700,
         CURRENT_DATE - INTERVAL '50 days', CURRENT_DATE + INTERVAL '15 days',
         'Restore full 12,000 L/min pumping capacity before peak season.',
         'Continuous 72-hour automated telemetry burn-in with <0.5% fault rate.', $3)
       RETURNING id`,
      [org1Id, userIds['pm@civitas.local'], userIds['owner@civitas.local']]
    );
    const p2Id = p2Res.rows[0].id;

    const p3Res = await client.query(
      `INSERT INTO projects (
         organization_id, project_code, name, description, status, priority, manager_id,
         location_name, latitude, longitude, start_date, expected_end_date, actual_completion_date,
         objectives, success_indicators, created_by
       ) VALUES ($1, 'CIV-103', 'East Depot Solar Canopy',
         'Installed 120 kW rooftop solar array and battery inverter bank at East Operations Depot.',
         'completed', 'medium', $2, 'East Operations Depot', 41.878100, -87.629800,
         CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '12 days',
         'Offset 65% of depot daytime power draw.',
         'Utility grid-tie inspection passed.', $3)
       RETURNING id`,
      [org1Id, userIds['pm@civitas.local'], userIds['owner@civitas.local']]
    );
    const p3Id = p3Res.rows[0].id;

    await client.query(
      `INSERT INTO projects (
         organization_id, project_code, name, description, status, priority, manager_id,
         location_name, start_date, expected_end_date, created_by
       ) VALUES ($1, 'GRN-201', 'Valley Clinic Solar Microgrid',
         'Private project belonging strictly to GreenGrid Community NGO.',
         'active', 'high', $2, 'Green Valley Clinic',
         CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '40 days', $2)`,
      [org2Id, userIds['owner@greengrid.local']]
    );

    // 5. Project Team Assignments
    const projMembers = [
      [org1Id, p1Id, userIds['pm@civitas.local'], 'manager', 20],
      [org1Id, p1Id, userIds['tech1@civitas.local'], 'member', 32],
      [org1Id, p1Id, userIds['tech2@civitas.local'], 'member', 36],
      [org1Id, p1Id, userIds['stakeholder@civitas.local'], 'stakeholder', 0],
      [org1Id, p2Id, userIds['pm@civitas.local'], 'manager', 20],
      [org1Id, p2Id, userIds['tech1@civitas.local'], 'member', 24],
      [org1Id, p2Id, userIds['stakeholder@civitas.local'], 'stakeholder', 0],
      [org1Id, p3Id, userIds['pm@civitas.local'], 'manager', 10],
    ];
    for (const [orgId, projId, uId, pRole, cap] of projMembers) {
      await client.query(
        `INSERT INTO project_members (organization_id, project_id, user_id, project_role, weekly_capacity_hours)
         VALUES ($1, $2, $3, $4, $5)`,
        [orgId, projId, uId, pRole, cap]
      );
    }

    // 6. Milestones
    const m1Res = await client.query(
      `INSERT INTO project_milestones (organization_id, project_id, owner_id, title, target_date, status, completed_at)
       VALUES ($1, $2, $3, 'Sector 1–3 Trenching & Inspection Sign-Off', CURRENT_DATE - INTERVAL '5 days', 'completed', NOW() - INTERVAL '6 days')
       RETURNING id`,
      [org1Id, p1Id, userIds['tech1@civitas.local']]
    );
    const m2Res = await client.query(
      `INSERT INTO project_milestones (organization_id, project_id, owner_id, title, target_date, status)
       VALUES ($1, $2, $3, 'Junction Box Splicing & OTDR Verification', CURRENT_DATE + INTERVAL '14 days', 'in_progress')
       RETURNING id`,
      [org1Id, p1Id, userIds['pm@civitas.local']]
    );
    const m3Res = await client.query(
      `INSERT INTO project_milestones (organization_id, project_id, owner_id, title, target_date, status)
       VALUES ($1, $2, $3, 'Primary Turbine Factory Acceptance & Delivery', CURRENT_DATE - INTERVAL '3 days', 'in_progress')
       RETURNING id`,
      [org1Id, p2Id, userIds['pm@civitas.local']]
    );

    // 7. Tasks + Dependencies + Assignees + Comments
    const t1Res = await client.query(
      `INSERT INTO tasks (
         organization_id, project_id, milestone_id, creator_id, title, description,
         priority, status, start_date, due_date, completed_at, estimated_hours, actual_hours, progress_percent, labels
       ) VALUES ($1, $2, $3, $4, 'Complete Sector 1–3 underground conduit excavation',
         'Excavate 4.5 km trench, place warning tape, and complete compaction tests.',
         'high', 'completed', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '6 days', NOW() - INTERVAL '7 days',
         48, 50, 100, ARRAY['field-ops', 'civil'])
       RETURNING id`,
      [org1Id, p1Id, m1Res.rows[0].id, userIds['pm@civitas.local']]
    );

    const t2Res = await client.query(
      `INSERT INTO tasks (
         organization_id, project_id, milestone_id, creator_id, title, description,
         priority, status, start_date, due_date, estimated_hours, actual_hours, progress_percent, labels
       ) VALUES ($1, $2, $3, $4, 'Pull 96-strand armored fiber through Sectors 1–3',
         'Deploy winch team and verify cable bend radius at all manholes.',
         'high', 'in_progress', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '7 days',
         36, 22, 65, ARRAY['fiber', 'field-ops'])
       RETURNING id`,
      [org1Id, p1Id, m2Res.rows[0].id, userIds['pm@civitas.local']]
    );

    const t3Res = await client.query(
      `INSERT INTO tasks (
         organization_id, project_id, milestone_id, creator_id, title, description,
         priority, status, start_date, due_date, estimated_hours, actual_hours, progress_percent, labels
       ) VALUES ($1, $2, $3, $4, 'Run OTDR optical loss certification tests',
         'Measure attenuation across all 96 strands and upload certified PDF logs.',
         'medium', 'todo', CURRENT_DATE + INTERVAL '8 days', CURRENT_DATE + INTERVAL '14 days',
         16, 0, 0, ARRAY['qa', 'testing'])
       RETURNING id`,
      [org1Id, p1Id, m2Res.rows[0].id, userIds['pm@civitas.local']]
    );

    const t4Res = await client.query(
      `INSERT INTO tasks (
         organization_id, project_id, milestone_id, creator_id, title, description,
         priority, status, start_date, due_date, estimated_hours, actual_hours, progress_percent, labels
       ) VALUES ($1, $2, $3, $4, 'Calibrate SCADA pressure & flow telemetry nodes',
         'Blocked awaiting replacement Modbus gateway module from supplier.',
         'critical', 'blocked', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '2 days',
         24, 14, 40, ARRAY['scada', 'blocker'])
       RETURNING id`,
      [org1Id, p2Id, m3Res.rows[0].id, userIds['pm@civitas.local']]
    );

    // Task Dependencies: t2 depends on t1; t3 depends on t2 (valid DAG)
    await client.query(
      `INSERT INTO task_dependencies (organization_id, project_id, task_id, depends_on_task_id)
       VALUES ($1, $2, $3, $4), ($1, $2, $5, $3)`,
      [org1Id, p1Id, t2Res.rows[0].id, t1Res.rows[0].id, t3Res.rows[0].id]
    );

    await client.query(
      `INSERT INTO task_assignees (task_id, user_id, assigned_by)
       VALUES ($1, $5, $6), ($2, $5, $6), ($2, $7, $6), ($3, $7, $6), ($4, $5, $6)`,
      [
        t1Res.rows[0].id,
        t2Res.rows[0].id,
        t3Res.rows[0].id,
        t4Res.rows[0].id,
        userIds['tech1@civitas.local'],
        userIds['pm@civitas.local'],
        userIds['tech2@civitas.local'],
      ]
    );

    await client.query(
      `INSERT INTO task_comments (organization_id, task_id, author_id, body)
       VALUES ($1, $2, $3, 'Manholes 1 through 8 pulled cleanly. Remaining 4 segments scheduled for tomorrow morning.')`,
      [org1Id, t2Res.rows[0].id, userIds['tech1@civitas.local']]
    );

    // 8. Field Reports + Review Audit History
    const fr1Res = await client.query(
      `INSERT INTO field_reports (
         organization_id, project_id, task_id, submitted_by, title, activity_date, location_name,
         work_completed, challenges_blockers, resources_used_summary, progress_contribution_pct,
         status, submitted_at, reviewed_by, reviewed_at
       ) VALUES ($1, $2, $3, $4, 'Sector 2 Fiber Pull Daily Log', CURRENT_DATE - INTERVAL '2 days',
         'North Corridor — Manholes 4–8',
         'Pulled 1,420m of 96-strand armored fiber and sealed splice enclosures.',
         'Minor standing water in Manhole 6 required 30-minute dewatering pump run.',
         '1x Cable Winch Trailer, 1,450m Fiber Spool, 1x Dewatering Pump', 18.50,
         'approved', NOW() - INTERVAL '2 days', $5, NOW() - INTERVAL '1 day')
       RETURNING id`,
      [org1Id, p1Id, t2Res.rows[0].id, userIds['tech1@civitas.local'], userIds['pm@civitas.local']]
    );

    await client.query(
      `INSERT INTO field_report_reviews (organization_id, field_report_id, reviewer_id, previous_status, new_status, review_notes)
       VALUES ($1, $2, $3, 'submitted', 'approved', 'Meterage matches drum tally and manhole seal logs verified.')`,
      [org1Id, fr1Res.rows[0].id, userIds['pm@civitas.local']]
    );

    const fr2Res = await client.query(
      `INSERT INTO field_reports (
         organization_id, project_id, task_id, submitted_by, title, activity_date, location_name,
         work_completed, challenges_blockers, resources_used_summary, progress_contribution_pct,
         status, submitted_at
       ) VALUES ($1, $2, $3, $4, 'Riverbend Switchgear Pre-Commissioning Inspection', CURRENT_DATE - INTERVAL '1 day',
         'Riverbend Basin Site B — Control Room',
         'Verified 480V busbar torque specs and breaker trip curves.',
         'Modbus telemetry gateway failed bench self-test; replacement unit requested.',
         'Fluke Thermal Camera, Torque Wrench Kit', 12.00,
         'submitted', NOW() - INTERVAL '18 hours')
       RETURNING id`,
      [org1Id, p2Id, t4Res.rows[0].id, userIds['tech1@civitas.local']]
    );

    // 9. Budgets, Expenses & Expense Approvals
    const b1Res = await client.query(
      `INSERT INTO budgets (organization_id, project_id, planned_amount, contingency_amount, currency_code, notes, created_by)
       VALUES ($1, $2, 185000.00, 15000.00, 'USD', 'Q4 corridor expansion capital budget', $3)
       RETURNING id`,
      [org1Id, p1Id, userIds['owner@civitas.local']]
    );
    const b2Res = await client.query(
      `INSERT INTO budgets (organization_id, project_id, planned_amount, contingency_amount, currency_code, notes, created_by)
       VALUES ($1, $2, 120000.00, 10000.00, 'USD', 'Riverbend retrofit capital budget', $3)
       RETURNING id`,
      [org1Id, p2Id, userIds['owner@civitas.local']]
    );

    const exp1Res = await client.query(
      `INSERT INTO expenses (
         organization_id, project_id, budget_id, submitted_by, title, category,
         expense_date, amount, vendor_name, description, status
       ) VALUES ($1, $2, $3, $4, 'HDPE Conduit & Warning Tape Bulk Order', 'materials',
         CURRENT_DATE - INTERVAL '20 days', 42650.50, 'Apex Civil Supply', '6,000m HDPE schedule-40 conduit', 'approved')
       RETURNING id`,
      [org1Id, p1Id, b1Res.rows[0].id, userIds['pm@civitas.local']]
    );
    await client.query(
      `INSERT INTO expense_approvals (organization_id, expense_id, approver_id, decision, comments)
       VALUES ($1, $2, $3, 'approved', 'Matches signed vendor PO #4082.')`,
      [org1Id, exp1Res.rows[0].id, userIds['owner@civitas.local']]
    );

    await client.query(
      `INSERT INTO expenses (
         organization_id, project_id, budget_id, submitted_by, title, category,
         expense_date, amount, vendor_name, description, status
       ) VALUES ($1, $2, $3, $4, 'Expedited Replacement Modbus SCADA Gateway', 'equipment',
         CURRENT_DATE - INTERVAL '1 day', 4850.00, 'InduTech Controls', 'Overnight air freight replacement unit', 'pending')`,
      [org1Id, p2Id, b2Res.rows[0].id, userIds['tech1@civitas.local']]
    );

    // 10. Resources & Allocations (including one low-stock shortage item)
    const r1Res = await client.query(
      `INSERT INTO resources (organization_id, name, resource_type, unit, total_quantity, available_quantity, min_threshold, unit_cost, status)
       VALUES ($1, '96-Strand Armored Fiber Spool', 'material', 'meters', 10000.00, 1200.00, 2000.00, 4.75, 'low_stock')
       RETURNING id`,
      [org1Id]
    );
    const r2Res = await client.query(
      `INSERT INTO resources (organization_id, name, resource_type, unit, total_quantity, available_quantity, min_threshold, unit_cost, status)
       VALUES ($1, 'Hydraulic Cable Winch Trailer', 'equipment', 'units', 4.00, 2.00, 1.00, 350.00, 'available')
       RETURNING id`,
      [org1Id]
    );

    await client.query(
      `INSERT INTO resource_assignments (organization_id, resource_id, project_id, assigned_by, quantity_allocated, quantity_used, start_date, status)
       VALUES ($1, $2, $3, $4, 5000.00, 3800.00, CURRENT_DATE - INTERVAL '15 days', 'active'),
              ($1, $5, $3, $4, 2.00, 1.00, CURRENT_DATE - INTERVAL '15 days', 'active')`,
      [org1Id, r1Res.rows[0].id, p1Id, userIds['pm@civitas.local'], r2Res.rows[0].id]
    );

    // 11. Risks & Issues
    await client.query(
      `INSERT INTO risks (organization_id, project_id, owner_id, created_by, title, description, probability, impact, mitigation_plan, review_date, status)
       VALUES ($1, $2, $3, $3, 'SCADA Gateway Supply Chain Delay',
         'Backup supplier lead times may exceed 10 business days and slip commissioning.',
         4, 5, 'Authorized expedited air freight from secondary distributor and prepared temporary manual override.',
         CURRENT_DATE + INTERVAL '3 days', 'monitoring')`,
      [org1Id, p2Id, userIds['pm@civitas.local']]
    );

    await client.query(
      `INSERT INTO issues (organization_id, project_id, task_id, reported_by, assigned_to, title, description, severity, status)
       VALUES ($1, $2, $3, $4, $5, 'Modbus Gateway Failed Bench Diagnostics',
         'Unit fails to respond on RS-485 bus under thermal load.', 'critical', 'investigating')`,
      [org1Id, p2Id, t4Res.rows[0].id, userIds['tech1@civitas.local'], userIds['pm@civitas.local']]
    );

    // 12. Notifications & Activity Logs
    await client.query(
      `INSERT INTO notifications (organization_id, recipient_id, type, title, message, entity_type, entity_id)
       VALUES ($1, $2, 'report_submitted', 'New Field Report Awaiting Review',
         'Elena Park submitted "Riverbend Switchgear Pre-Commissioning Inspection" for review.', 'field_report', $3)`,
      [org1Id, userIds['pm@civitas.local'], fr2Res.rows[0].id]
    );

    await client.query(
      `INSERT INTO activity_logs (organization_id, project_id, actor_id, action, entity_type, entity_id, summary, metadata)
       VALUES ($1, $2, $3, 'field_report.approved', 'field_report', $4,
         'Approved field report "Sector 2 Fiber Pull Daily Log" (+18.5% progress)',
         '{"previous_status":"submitted","new_status":"approved"}'::jsonb)`,
      [org1Id, p1Id, userIds['pm@civitas.local'], fr1Res.rows[0].id]
    );
  });

  return { skipped: false };
}

// Execute when run directly via `npm run db:seed`
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  seedDatabase()
    .then((result) => {
      if (result.skipped) {
        console.log(`Seed skipped: ${result.reason}`);
      } else {
        console.log('Development seed data inserted cleanly across 2 organizations.');
      }
    })
    .catch((err) => {
      console.error('Seed error:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool) await pool.end();
    });
}
