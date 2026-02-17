import axios from 'axios';
import { getAuthToken } from '../auth';

const apiBase = import.meta.env.VITE_API_BASE || '/gold-price-alert/api';

export const apiClient = axios.create({
  baseURL: apiBase,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (!token) {
    return config;
  }
  const nextConfig = { ...config };
  nextConfig.headers = {
    ...(config.headers || {}),
    Authorization: config.headers?.Authorization || token,
  };
  return nextConfig;
});
