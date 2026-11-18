import { apiClient, downloadAuthenticatedFile } from './client.js';

const unwrap = (promise) => promise.then((res) => res.data);

export const authApi = {
  register: (payload) => unwrap(apiClient.post('/auth/register', payload)),
  login: (payload) => unwrap(apiClient.post('/auth/login', payload)),
  logout: () => unwrap(apiClient.post('/auth/logout')),
  me: () => unwrap(apiClient.get('/auth/me')),
  updateProfile: (payload) => unwrap(apiClient.patch('/auth/profile', payload)),
  changePassword: (payload) => unwrap(apiClient.patch('/auth/change-password', payload)),
};

export const orgsApi = {
  create: (payload) => unwrap(apiClient.post('/organizations', payload)),
  getCurrent: () => unwrap(apiClient.get('/organizations/current')),
  updateCurrent: (payload) => unwrap(apiClient.patch('/organizations/current', payload)),
  listMembers: () => unwrap(apiClient.get('/organizations/members')),
  updateMember: (memberId, payload) =>
    unwrap(apiClient.patch(`/organizations/members/${memberId}`, payload)),
  removeMember: (memberId) => unwrap(apiClient.delete(`/organizations/members/${memberId}`)),
  listInvitations: () => unwrap(apiClient.get('/organizations/invitations')),
  createInvitation: (payload) => unwrap(apiClient.post('/organizations/invitations', payload)),
  revokeInvitation: (invitationId) =>
    unwrap(apiClient.delete(`/organizations/invitations/${invitationId}`)),
  acceptInvitation: (token) => unwrap(apiClient.post('/organizations/invitations/accept', { token })),
};

export const projectsApi = {
  list: (params) => unwrap(apiClient.get('/projects', { params })),
  getById: (projectId) => unwrap(apiClient.get(`/projects/${projectId}`)),
  create: (payload) => unwrap(apiClient.post('/projects', payload)),
  update: (projectId, payload) => unwrap(apiClient.patch(`/projects/${projectId}`, payload)),
  archive: (projectId, isArchived) =>
    unwrap(apiClient.patch(`/projects/${projectId}/archive`, { isArchived })),
  listMembers: (projectId) => unwrap(apiClient.get(`/projects/${projectId}/members`)),
  addMember: (projectId, payload) =>
    unwrap(apiClient.post(`/projects/${projectId}/members`, payload)),
  removeMember: (projectId, userId) =>
    unwrap(apiClient.delete(`/projects/${projectId}/members/${userId}`)),
  listDocuments: (projectId) => unwrap(apiClient.get(`/projects/${projectId}/documents`)),
  uploadDocument: (projectId, formData) =>
    unwrap(
      apiClient.post(`/projects/${projectId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ),
  downloadDocument: (documentId, filename) =>
    downloadAuthenticatedFile(`/projects/documents/${documentId}/download`, filename),
};

export const tasksApi = {
  list: (params) => unwrap(apiClient.get('/tasks', { params })),
  getById: (taskId) => unwrap(apiClient.get(`/tasks/${taskId}`)),
  create: (payload) => unwrap(apiClient.post('/tasks', payload)),
  update: (taskId, payload) => unwrap(apiClient.patch(`/tasks/${taskId}`, payload)),
  remove: (taskId) => unwrap(apiClient.delete(`/tasks/${taskId}`)),
  addDependency: (taskId, dependsOnTaskId) =>
    unwrap(apiClient.post(`/tasks/${taskId}/dependencies`, { dependsOnTaskId })),
  removeDependency: (taskId, dependencyId) =>
    unwrap(apiClient.delete(`/tasks/${taskId}/dependencies/${dependencyId}`)),
  addComment: (taskId, body) => unwrap(apiClient.post(`/tasks/${taskId}/comments`, { body })),
  uploadAttachment: (taskId, formData) =>
    unwrap(
      apiClient.post(`/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ),
  downloadAttachment: (attachmentId, filename) =>
    downloadAuthenticatedFile(`/tasks/attachments/${attachmentId}/download`, filename),
};

export const milestonesApi = {
  list: (params) => unwrap(apiClient.get('/milestones', { params })),
  create: (payload) => unwrap(apiClient.post('/milestones', payload)),
  update: (milestoneId, payload) => unwrap(apiClient.patch(`/milestones/${milestoneId}`, payload)),
  remove: (milestoneId) => unwrap(apiClient.delete(`/milestones/${milestoneId}`)),
  getTimeline: (projectId) => unwrap(apiClient.get(`/milestones/project/${projectId}/timeline`)),
};

export const fieldReportsApi = {
  list: (params) => unwrap(apiClient.get('/field-reports', { params })),
  getById: (reportId) => unwrap(apiClient.get(`/field-reports/${reportId}`)),
  create: (formData) =>
    unwrap(
      apiClient.post('/field-reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ),
  update: (reportId, formData) =>
    unwrap(
      apiClient.patch(`/field-reports/${reportId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ),
  submit: (reportId) => unwrap(apiClient.post(`/field-reports/${reportId}/submit`)),
  review: (reportId, payload) =>
    unwrap(apiClient.post(`/field-reports/${reportId}/review`, payload)),
  downloadEvidence: (reportId, filename) =>
    downloadAuthenticatedFile(`/field-reports/${reportId}/evidence`, filename),
};

export const budgetsApi = {
  list: () => unwrap(apiClient.get('/budgets')),
  getProjectBudget: (projectId) => unwrap(apiClient.get(`/budgets/project/${projectId}`)),
  upsertProjectBudget: (projectId, payload) =>
    unwrap(apiClient.put(`/budgets/project/${projectId}`, payload)),
  listExpenses: (params) => unwrap(apiClient.get('/budgets/expenses', { params })),
  createExpense: (formData) =>
    unwrap(
      apiClient.post('/budgets/expenses', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ),
  decideExpense: (expenseId, payload) =>
    unwrap(apiClient.post(`/budgets/expenses/${expenseId}/decision`, payload)),
  downloadReceipt: (expenseId, filename) =>
    downloadAuthenticatedFile(`/budgets/expenses/${expenseId}/receipt`, filename),
};

export const resourcesApi = {
  list: (params) => unwrap(apiClient.get('/resources', { params })),
  create: (payload) => unwrap(apiClient.post('/resources', payload)),
  update: (resourceId, payload) => unwrap(apiClient.patch(`/resources/${resourceId}`, payload)),
  listAssignments: (params) => unwrap(apiClient.get('/resources/assignments', { params })),
  assign: (resourceId, payload) =>
    unwrap(apiClient.post(`/resources/${resourceId}/assignments`, payload)),
  updateAssignment: (assignmentId, payload) =>
    unwrap(apiClient.patch(`/resources/assignments/${assignmentId}`, payload)),
};

export const risksApi = {
  list: (params) => unwrap(apiClient.get('/risks', { params })),
  create: (payload) => unwrap(apiClient.post('/risks', payload)),
  update: (riskId, payload) => unwrap(apiClient.patch(`/risks/${riskId}`, payload)),
  remove: (riskId) => unwrap(apiClient.delete(`/risks/${riskId}`)),
};

export const issuesApi = {
  list: (params) => unwrap(apiClient.get('/issues', { params })),
  create: (payload) => unwrap(apiClient.post('/issues', payload)),
  update: (issueId, payload) => unwrap(apiClient.patch(`/issues/${issueId}`, payload)),
};

export const notificationsApi = {
  list: (params) => unwrap(apiClient.get('/notifications', { params })),
  markRead: (notificationId) => unwrap(apiClient.patch(`/notifications/${notificationId}/read`)),
  markAllRead: () => unwrap(apiClient.patch('/notifications/read-all')),
  checkDeadlines: () => unwrap(apiClient.post('/notifications/check-deadlines')),
};

export const activityApi = {
  list: (params) => unwrap(apiClient.get('/activity-logs', { params })),
};

export const analyticsApi = {
  getOrganization: (params) => unwrap(apiClient.get('/analytics/organization', { params })),
  getProject: (projectId) => unwrap(apiClient.get(`/analytics/projects/${projectId}`)),
  getMyDashboard: () => unwrap(apiClient.get('/analytics/my-dashboard')),
  exportCsv: (reportType, projectId) => {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return downloadAuthenticatedFile(
      `/analytics/export/${reportType}${query}`,
      `fieldledger-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`
    );
  },
};
