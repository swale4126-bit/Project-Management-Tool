# FieldLedger — REST API Contract Specification (Phase 1)

## 1. API Conventions

- **Base URL:** `/api/v1`
- **Authentication Header:** `Authorization: Bearer <access_token>`
- **Tenant Header (all org-scoped endpoints):** `X-Organization-Id: <organization_uuid>`
- **Content Types:** `application/json` (or `multipart/form-data` for file uploads)

### Standard Response Envelopes

**Success (Single Resource or Collection):**
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "totalPages": 5
  }
}
```

**Error (Consistent, Never Exposes SQL/Stack Traces):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters.",
    "details": [
      { "field": "expected_end_date", "message": "Must be on or after start_date" }
    ]
  }
}
```

### Standard HTTP Status Codes
- `200 OK` — Successful read/update/action
- `201 Created` — Resource created
- `400 Bad Request` — Validation failure / malformed request
- `401 Unauthorized` — Missing, expired, or invalid JWT
- `403 Forbidden` — Authenticated, but lacks org membership or required role
- `404 Not Found` — Resource does not exist in caller's organization
- `409 Conflict` — Duplicate email/project code, invalid workflow transition, or dependency cycle
- `429 Too Many Requests` — Rate limit exceeded
- `500 Internal Server Error` — Unexpected server error (logged internally, generic message to client)

### Standard Pagination, Filtering & Sorting
List endpoints accept:
`?page=1&limit=20&sortBy=created_at&sortOrder=desc&search=<term>&status=<val>&priority=<val>`

---

## 2. Endpoint Map by Module

### Module A — Auth & Organizations
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register new user account |
| `POST` | `/auth/login` | Public | Authenticate & issue JWT + user org memberships |
| `POST` | `/auth/logout` | Authenticated | End session (client token clear / optional revocation) |
| `GET` | `/auth/me` | Authenticated | Current user profile + organizations list |
| `PATCH` | `/auth/profile` | Authenticated | Update name, title, phone, avatar |
| `PATCH` | `/auth/change-password` | Authenticated | Verify current password & set new bcrypt hash |
| `POST` | `/organizations` | Authenticated | Create organization & assign creator as `org_owner` |
| `GET` | `/organizations/current` | Org Member | Get current org profile & settings |
| `PATCH` | `/organizations/current` | Org Owner | Update org details, currency, timezone, settings |
| `GET` | `/organizations/members` | Org Member | List org members and roles |
| `PATCH` | `/organizations/members/:memberId` | Org Owner | Update member role or suspend/activate |
| `DELETE` | `/organizations/members/:memberId` | Org Owner | Remove member (cannot remove last `org_owner`) |
| `POST` | `/organizations/invitations` | Org Owner | Create invite token for email + role |
| `GET` | `/organizations/invitations` | Org Owner | List pending/accepted/revoked invitations |
| `POST` | `/organizations/invitations/accept` | Authenticated | Accept invitation via token |

### Module B — Projects, Team & Documents
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/projects` | Org Member | List projects (filters: status, priority, manager, archived, search) |
| `POST` | `/projects` | Owner / PM | Create project + initial budget (optional) + add creator |
| `GET` | `/projects/:projectId` | Project Access | Full project details + computed completion & KPI summary |
| `PATCH` | `/projects/:projectId` | Owner / PM | Update project properties or status |
| `PATCH` | `/projects/:projectId/archive` | Owner / PM | Archive or restore project |
| `GET` | `/projects/:projectId/members` | Project Access | List project team & capacity hours |
| `POST` | `/projects/:projectId/members` | Owner / PM | Add org member to project |
| `DELETE` | `/projects/:projectId/members/:userId` | Owner / PM | Remove member from project |
| `GET` | `/projects/:projectId/documents` | Project Access | List project documents |
| `POST` | `/projects/:projectId/documents` | Owner / PM / Member | Upload validated project document (`multipart/form-data`) |
| `GET` | `/documents/:documentId/download` | Project Access | Authenticated safe file download |

### Module C — Tasks & Dependencies
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/tasks` | Org Member | Cross-project task list (filters: projectId, assigneeId, status, priority, overdue) |
| `GET` | `/projects/:projectId/tasks` | Project Access | Project tasks for Kanban / List / Calendar |
| `POST` | `/projects/:projectId/tasks` | Owner / PM | Create task or subtask |
| `GET` | `/tasks/:taskId` | Project Access | Full task details (subtasks, assignees, dependencies, comments, attachments) |
| `PATCH` | `/tasks/:taskId` | Owner / PM / Assignee | Update task (members limited to progress/status/effort on assigned tasks) |
| `DELETE` | `/tasks/:taskId` | Owner / PM | Delete task |
| `POST` | `/tasks/:taskId/dependencies` | Owner / PM | Add prerequisite task (runs DAG cycle validation) |
| `DELETE` | `/tasks/:taskId/dependencies/:depId` | Owner / PM | Remove task dependency |
| `POST` | `/tasks/:taskId/comments` | Project Access | Add task comment |
| `POST` | `/tasks/:taskId/attachments` | Owner / PM / Member | Upload task evidence file |

### Module D — Milestones & Timeline
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/projects/:projectId/milestones` | Project Access | List milestones with linked task completion counts & overdue flags |
| `POST` | `/projects/:projectId/milestones` | Owner / PM | Create milestone |
| `PATCH` | `/milestones/:milestoneId` | Owner / PM | Update target date, owner, or completion status |
| `DELETE` | `/milestones/:milestoneId` | Owner / PM | Delete milestone (unlinks tasks via `SET NULL`) |
| `GET` | `/projects/:projectId/timeline` | Project Access | Database-backed Gantt payload (milestones, tasks, dependencies, date bounds) |

### Module E — Field Activity Reports
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/field-reports` | Org Member | List field reports (filters: projectId, status, submittedBy, date range) |
| `POST` | `/field-reports` | Owner / PM / Member | Create draft or directly submit field report with optional evidence upload |
| `GET` | `/field-reports/:reportId` | Project Access | Report details + `field_report_reviews` history |
| `PATCH` | `/field-reports/:reportId` | Author (draft/rejected) | Edit draft or rejected report |
| `POST` | `/field-reports/:reportId/submit` | Author | Transition `draft`/`rejected` → `submitted` + notify PM |
| `POST` | `/field-reports/:reportId/review` | Owner / PM | Transition to `under_review`, `approved`, or `rejected` + audit row + notify author |

### Module F — Budgets, Expenses & Resources
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/projects/:projectId/budget` | Project Access | Planned budget, approved spend, pending spend, remaining balance, utilization % |
| `PUT` | `/projects/:projectId/budget` | Owner / PM | Create or update project planned budget |
| `GET` | `/expenses` | Org Member | List expenses (filters: projectId, category, status, date range) |
| `POST` | `/projects/:projectId/expenses` | Owner / PM / Member | Submit expense + receipt upload |
| `POST` | `/expenses/:expenseId/decision` | Owner / PM | Approve or reject expense + `expense_approvals` audit + notify submitter |
| `GET` | `/resources` | Org Member | List org resources with availability & shortage flag (`available <= min_threshold`) |
| `POST` | `/resources` | Owner / PM | Register new resource |
| `PATCH` | `/resources/:resourceId` | Owner / PM | Update resource stock or threshold |
| `POST` | `/resources/:resourceId/assignments` | Owner / PM | Allocate resource quantity to project (transactional availability check) |
| `PATCH` | `/resource-assignments/:assignmentId` | Owner / PM / Member | Record usage or return allocated resource |

### Module G — Risks & Issues
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/projects/:projectId/risks` | Project Access | List risks ordered by severity (`probability * impact`) |
| `POST` | `/projects/:projectId/risks` | Owner / PM | Create risk + notify owner (and high-risk alert if severity >= 15) |
| `PATCH` | `/risks/:riskId` | Owner / PM | Update risk assessment, mitigation, or status |
| `GET` | `/projects/:projectId/issues` | Project Access | List issues / blockers |
| `POST` | `/projects/:projectId/issues` | Owner / PM / Member | Report issue/blocker |
| `PATCH` | `/issues/:issueId` | Owner / PM / Assignee | Update status or resolution notes |

### Module H — Notifications & Activity Logs
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | Org Member | Paginated notifications for current user + `unreadCount` |
| `PATCH` | `/notifications/:id/read` | Recipient | Mark single notification read |
| `PATCH` | `/notifications/read-all` | Org Member | Mark all notifications in current org read |
| `GET` | `/activity-logs` | Org Member | Filterable audit log (`projectId`, `entityType`, `actorId`, `from`, `to`) |

### Module I — Analytics & CSV Exports
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/analytics/organization` | Org Member | Org KPIs, project statuses, at-risk watchlist, site coordinates, budget summary |
| `GET` | `/analytics/projects/:projectId` | Project Access | Completion %, task distribution, milestone progress, budget vs actual, workload, open risks |
| `GET` | `/analytics/my-dashboard` | Org Member | Assigned tasks, overdue, upcoming, completed, blocked, weekly hours |
| `GET` | `/analytics/export/:reportType` | Org Member | Stream safe CSV (`projects`, `tasks`, `expenses`, `field-reports`, `risks`) |
