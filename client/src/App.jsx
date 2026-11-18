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
import ProjectTimelinePage from './pages/ProjectTimelinePage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import TaskDetailPage from './pages/TaskDetailPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import FieldReportsPage from './pages/FieldReportsPage.jsx';
import BudgetsPage from './pages/BudgetsPage.jsx';
import ResourcesPage from './pages/ResourcesPage.jsx';
import RisksPage from './pages/RisksPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import OrgSettingsPage from './pages/OrgSettingsPage.jsx';
import TeamPage from './pages/TeamPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

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
          <Route path="/projects/:projectId/timeline" element={<ProjectTimelinePage />} />
          <Route path="/timeline" element={<ProjectTimelinePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/field-reports" element={<FieldReportsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/risks" element={<RisksPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings/organization" element={<OrgSettingsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
