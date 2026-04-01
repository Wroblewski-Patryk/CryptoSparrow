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
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const status: number | undefined = error?.response?.status;
      const code: string | undefined = error?.code;
      const hasResponse = Boolean(error?.response);
      const backendUnavailable =
        !hasResponse ||
        status === 0 ||
        (typeof status === 'number' && status >= 500) ||
        code === 'ERR_NETWORK' ||
        code === 'ECONNABORTED';

      if (isProtectedRoute(pathname)) {
        if (status === 401) {
          hardRedirect('/auth/login?session=expired');
        } else if (backendUnavailable) {
          hardRedirect('/');
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
