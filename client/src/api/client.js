import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('fl_access_token')) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem('fl_access_token');
        window.dispatchEvent(new Event('fl:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const apiErr = error?.response?.data?.error;
  if (apiErr?.details?.length) {
    return `${apiErr.message} (${apiErr.details.map((d) => `${d.field}: ${d.message}`).join('; ')})`;
  }
  return apiErr?.message || error?.message || fallback;
}

export async function downloadAuthenticatedFile(url, filename) {
  const response = await apiClient.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function fetchApiHealth() {
  const { data } = await apiClient.get('/health');
  return data;
}
