import axios from 'axios';
import { ElMessage } from 'element-plus';
import { getAuthToken } from '../auth';

const apiBase = import.meta.env.VITE_API_BASE || '/gold-price-alert/api';

const isAuthErrorStatus = (status) => status === 401 || status === 403;

const toBearerAuthorization = (token) => {
  const rawToken = String(token || '').trim();
  if (!rawToken) {
    return '';
  }
  if (/^bearer\s+/i.test(rawToken)) {
    return rawToken;
  }
  return `Bearer ${rawToken}`;
};

const resolveResponseError = (error) => {
  const payload = error?.response?.data;
  if (payload?.message) {
    return String(payload.message);
  }
  if (typeof payload === 'string') {
    return payload.trim();
  }
  if (!payload) {
    return '';
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

export const isAuthErrorNotified = (error) => Boolean(error?.__authErrorNotified);

export const apiClient = axios.create({
  baseURL: apiBase,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  if (config?.skipAuth) {
    return config;
  }
  const token = getAuthToken();
  const authorization = toBearerAuthorization(token);
  if (!authorization) {
    return config;
  }
  const nextConfig = { ...config };
  nextConfig.headers = {
    ...(config.headers || {}),
    Authorization: config.headers?.Authorization || authorization,
  };
  return nextConfig;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = Number(error?.response?.status);
    const suppressAuthPopup = Boolean(error?.config?.suppressAuthPopup);
    if (isAuthErrorStatus(status) && !suppressAuthPopup && !isAuthErrorNotified(error)) {
      const detail = resolveResponseError(error);
      const baseMessage = status === 401 ? '接口未授权(401)' : '接口无权限访问(403)';
      ElMessage.error(detail ? `${baseMessage}：${detail}` : baseMessage);
      error.__authErrorNotified = true;
    }
    return Promise.reject(error);
  },
);
