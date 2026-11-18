import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('fl_access_token');
  const orgId = localStorage.getItem('fl_active_org_id');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (orgId) {
    config.headers['X-Organization-Id'] = orgId;
  }
  return config;
});

export async function fetchApiHealth() {
  const { data } = await apiClient.get('/health');
  return data;
}
