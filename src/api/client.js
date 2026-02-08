import axios from 'axios';

const apiBase = import.meta.env.VITE_API_BASE || '/gold-price-alert/api';

export const apiClient = axios.create({
  baseURL: apiBase,
  timeout: 15000,
});
