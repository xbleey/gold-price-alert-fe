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

export const fetchAlertList = ({ pageNum, pageSize, alertLevels }) => {
  const params = new URLSearchParams();
  params.append('pageNum', String(pageNum));
  params.append('pageSize', String(pageSize));
  (alertLevels || []).forEach((level) => params.append('alertLevel', level));

  return apiClient.get('/alert/list', {
    params,
    paramsSerializer: (value) => value.toString(),
  });
};

export const sendTestEmail = () => apiClient.post('/test/email');
