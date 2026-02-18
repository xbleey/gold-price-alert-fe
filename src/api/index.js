import { apiClient } from './client';
import { getAuthSession, getAuthToken } from '../auth';

const toBearerAuthorization = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  if (/^bearer\s+/i.test(raw)) {
    return raw;
  }
  return `Bearer ${raw}`;
};

const resolveAuthorization = (authorization) => toBearerAuthorization(authorization || getAuthToken());

const resolveUsernameFromSession = () => {
  const session = getAuthSession();
  return String(session?.username || '').trim().toLowerCase();
};

export const login = (username, password, options = {}) =>
  apiClient.post(
    '/auth/login',
    {
      username: String(username || '').trim(),
      password: String(password || ''),
    },
    {
      skipAuth: true,
      suppressAuthPopup: Boolean(options.suppressAuthPopup),
    },
  );

export const logout = (options = {}) =>
  apiClient.post('/auth/logout', null, {
    suppressAuthPopup: Boolean(options.suppressAuthPopup),
  });

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const resolveRolesFromProfile = (profile) => {
  const authorities = Array.isArray(profile?.authorities)
    ? profile.authorities
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    : [];
  if (authorities.length) {
    return authorities;
  }
  const role = normalizeRole(profile?.role);
  if (role) {
    return [`ROLE_${role}`];
  }
  return ['ROLE_USER'];
};

export const fetchCurrentUser = async (authorization, options = {}) => {
  const authHeader = resolveAuthorization(authorization);
  if (!authHeader) {
    throw new Error('missing authorization token');
  }
  const suppressAuthPopup = Boolean(options.suppressAuthPopup);
  const { data: profile } = await apiClient.get('/auth/me', {
    headers: {
      Authorization: authHeader,
    },
    suppressAuthPopup,
  });

  const username = String(profile?.username || resolveUsernameFromSession()).trim().toLowerCase();
  return {
    data: {
      username: username || '-',
      roles: resolveRolesFromProfile(profile),
      role: normalizeRole(profile?.role || ''),
      expiresAt: profile?.expiresAt,
    },
  };
};

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

export const fetchMailRecipients = () => apiClient.get('/mail/recipients');

export const getMailRecipient = (id) => apiClient.get(`/mail/recipients/${id}`);

export const createMailRecipient = (payload) => apiClient.post('/mail/recipients', payload);

export const updateMailRecipient = (id, payload) => apiClient.put(`/mail/recipients/${id}`, payload);

export const deleteMailRecipient = (id) => apiClient.delete(`/mail/recipients/${id}`);

export const fetchAlertLevels = () => apiClient.get('/alert/levels');

export const getAlertLevel = (levelName) => apiClient.get(`/alert/levels/${levelName}`);

export const createAlertLevel = (payload) => apiClient.post('/alert/levels', payload);

export const updateAlertLevel = (levelName, payload) => apiClient.put(`/alert/levels/${levelName}`, payload);

export const deleteAlertLevel = (levelName) => apiClient.delete(`/alert/levels/${levelName}`);

export const fetchUsers = () => apiClient.get('/users');

export const getUser = (id) => apiClient.get(`/users/${id}`);

export const createUser = (payload) => apiClient.post('/users', payload);

export const updateUser = (id, payload) => apiClient.put(`/users/${id}`, payload);

export const deleteUser = (id) => apiClient.delete(`/users/${id}`);
