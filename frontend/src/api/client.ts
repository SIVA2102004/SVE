import axios from 'axios';

const defaultApiUrl =
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'https://sve-filx.onrender.com/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('shopflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('shopflow_token');
        localStorage.removeItem('shopflow_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Keep backend warm in background so queries respond instantly
if (typeof window !== 'undefined') {
  const pingServer = () => {
    fetch(`${import.meta.env.VITE_API_URL || defaultApiUrl}/ping`, { method: 'GET', keepalive: true }).catch(() => {});
  };
  // Ping immediately on load, then every 3 minutes
  pingServer();
  setInterval(pingServer, 3 * 60 * 1000);
}

export default api;

