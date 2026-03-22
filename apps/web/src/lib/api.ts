import axios from 'axios';

const normalizeBaseUrl = (value?: string) => {
  if (!value) return undefined;
  return value.replace(/\/+$/, '');
};

const api = axios.create({
    baseURL: normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
    withCredentials: true,
});
export default api;
