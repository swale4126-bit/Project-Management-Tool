import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './layouts/AppShell.jsx';
import { ProtectedRoute } from './layouts/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import OrgSetupPage from './pages/OrgSetupPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import CreateProjectPage from './pages/CreateProjectPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import ProjectTeamPage from './pages/ProjectTeamPage.jsx';

function ComingInPhase13B({ title }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">Scheduled for Phase 13B frontend integration.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute requireOrg={false} />}>
        <Route path="/setup-organization" element={<OrgSetupPage />} />
      </Route>

      <Route element={<ProtectedRoute requireOrg={true} />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<CreateProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/team" element={<ProjectTeamPage />} />
          <Route
            path="/projects/:projectId/timeline"
            element={<ComingInPhase13B title="Milestones & Gantt Timeline" />}
          />
          <Route path="/tasks" element={<ComingInPhase13B title="Task Board & List" />} />
          <Route path="/tasks/:taskId" element={<ComingInPhase13B title="Task Details" />} />
          <Route path="/calendar" element={<ComingInPhase13B title="Calendar" />} />
          <Route path="/field-reports" element={<ComingInPhase13B title="Field Activity Reports" />} />
          <Route path="/budgets" element={<ComingInPhase13B title="Budget & Expenses" />} />
          <Route path="/resources" element={<ComingInPhase13B title="Resources" />} />
          <Route path="/risks" element={<ComingInPhase13B title="Risks & Issues" />} />
          <Route path="/notifications" element={<ComingInPhase13B title="Notifications" />} />
          <Route path="/analytics" element={<ComingInPhase13B title="Analytics & CSV Export" />} />
          <Route
            path="/settings/organization"
            element={<ComingInPhase13B title="Organization Settings" />}
          />
          <Route path="/team" element={<ComingInPhase13B title="Organization Team" />} />
          <Route path="/profile" element={<ComingInPhase13B title="User Profile" />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
