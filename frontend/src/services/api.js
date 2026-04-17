import axios from 'axios';

const normalizeBase = (base = '/') => {
  if (!base || base === '/') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const appBase = normalizeBase(import.meta.env.BASE_URL);
const loginPath = `${appBase}/login`;

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 30000 });
api.interceptors.response.use(
  r => r,
  err => {
    const onLoginRoute = window.location.pathname === loginPath || window.location.pathname.startsWith(`${loginPath}/`);
    if (err.response?.status === 401 && !onLoginRoute) {
      localStorage.removeItem('optivision-auth');
      window.location.href = loginPath;
    }
    return Promise.reject(err);
  }
);
export default api;
