import axios from 'axios';

const normalizeBaseUrl = (value?: string) => {
  if (!value) return undefined;
  return value.replace(/\/+$/, '');
};

const api = axios.create({
    baseURL: normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
    withCredentials: true,
});

let hardRedirectInProgress = false;
let authMeBackendFailureCount = 0;
const AUTH_ME_BACKEND_FAILURE_LIMIT = 3;

const isProtectedRoute = (pathname: string) =>
  pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

const hardRedirect = (targetPath: string) => {
  if (typeof window === 'undefined') return;
  if (hardRedirectInProgress) return;
  if (window.location.pathname === targetPath) return;
  hardRedirectInProgress = true;
  window.location.replace(targetPath);
};

api.interceptors.response.use(
  (response) => {
    const requestUrl = typeof response?.config?.url === 'string' ? response.config.url : '';
    if (requestUrl.includes('/auth/me')) {
      authMeBackendFailureCount = 0;
    }
    return response;
  },
  (error) => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const requestUrl = typeof error?.config?.url === 'string' ? error.config.url : '';
      const status: number | undefined = error?.response?.status;
      const code: string | undefined = error?.code;
      const hasResponse = Boolean(error?.response);
      const backendUnavailable =
        !hasResponse ||
        status === 0 ||
        (typeof status === 'number' && status >= 500) ||
        code === 'ERR_NETWORK' ||
        code === 'ECONNABORTED';
      const isAuthMeRequest = requestUrl.includes('/auth/me');

      if (isProtectedRoute(pathname)) {
        if (status === 401) {
          hardRedirect('/auth/login?session=expired');
        } else if (backendUnavailable && isAuthMeRequest) {
          authMeBackendFailureCount += 1;
          // Keep user on dashboard for transient outages and only fallback after repeated auth-check failures.
          if (authMeBackendFailureCount >= AUTH_ME_BACKEND_FAILURE_LIMIT) {
            hardRedirect('/');
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
