import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Multi-tenant local dev helper: real browser traffic resolves the tenant
// from the `Host` header automatically (see backend/src/middleware/tenant.ts),
// so no subdomain logic is needed here for production. But `localhost` has no
// subdomain, so for local development you can simulate a tenant by setting
// NEXT_PUBLIC_DEV_TENANT_SUBDOMAIN (e.g. "grupovj") in frontend/.env.local —
// it's sent as an `X-Tenant-Subdomain` header, which the backend tenant
// middleware accepts as a fallback only when NODE_ENV !== "production".
const DEV_TENANT_SUBDOMAIN = process.env.NEXT_PUBLIC_DEV_TENANT_SUBDOMAIN;

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  if (DEV_TENANT_SUBDOMAIN) {
    config.headers['X-Tenant-Subdomain'] = DEV_TENANT_SUBDOMAIN;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.includes('/login')
      ) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;