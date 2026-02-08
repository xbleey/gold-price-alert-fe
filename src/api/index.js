import { apiClient } from './client';

export const fetchPrice = () => apiClient.get('/price');

export const fetchHistory = (length) =>
  apiClient.get('/history', {
    params: {
      length,
    },
  });

export const getThreshold = () => apiClient.get('/threshold');

export const setThreshold = (value) =>
  apiClient.post('/threshold', null, {
    params: {
      value,
    },
  });

export const clearThreshold = () => apiClient.delete('/threshold');

export const fetchAlertList = ({ pageNum, pageSize, alertLevel }) =>
  apiClient.get('/alert/list', {
    params: {
      pageNum,
      pageSize,
      alertLevel: alertLevel || undefined,
    },
  });

export const sendTestEmail = () => apiClient.post('/test/email');
