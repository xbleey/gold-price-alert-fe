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

export const fetchAiChatSessions = ({ pageNum = 1, pageSize = 50 } = {}) =>
  apiClient.get('/ai/chat/sessions', {
    params: {
      pageNum,
      pageSize,
    },
  });

export const fetchAiChatMessages = (sessionId, { pageNum = 1, pageSize = 100 } = {}) =>
  apiClient.get(`/ai/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    params: {
      pageNum,
      pageSize,
    },
  });

export const sendAiChat = ({ sessionId, message, stream = false }) =>
  apiClient.post('/ai/chat', {
    sessionId: sessionId || null,
    message: String(message || ''),
    stream: Boolean(stream),
  });

const resolveApiUrl = (path) => {
  const base = String(apiClient.defaults.baseURL || '').replace(/\/+$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
  if (/^https?:\/\//i.test(base)) {
    return `${base}${normalizedPath}`;
  }
  return `${base || ''}${normalizedPath}`;
};

const parseJsonSafely = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const createStreamError = (status, payload) => {
  const error = new Error(payload?.message || payload || 'AI 对话请求失败');
  error.response = {
    status,
    data: payload,
  };
  return error;
};

const emitSseEvent = (rawEvent, onEvent) => {
  const lines = String(rawEvent || '').split(/\r?\n/);
  let event = 'message';
  const dataLines = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message';
      return;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  });

  const data = parseJsonSafely(dataLines.join('\n'));
  onEvent?.({ event, data });
  if (event === 'error') {
    throw createStreamError(200, data);
  }
  return { event, data };
};

export const streamAiChat = async ({ sessionId, message, signal, onEvent } = {}) => {
  const authorization = resolveAuthorization();
  if (!authorization) {
    throw createStreamError(401, { status: 'unauthorized', message: 'missing authorization token' });
  }

  const response = await fetch(resolveApiUrl('/ai/chat'), {
    method: 'POST',
    headers: {
      Authorization: authorization,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: sessionId || null,
      message: String(message || ''),
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const payload = parseJsonSafely(await response.text());
    throw createStreamError(response.status, payload);
  }
  if (!response.body) {
    throw createStreamError(response.status, { status: 'stream_error', message: '浏览器不支持流式响应' });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let lastEvent = null;
  let completedByDoneEvent = false;

  const handleChunk = async (chunkText) => {
    buffer += chunkText;
    const normalized = buffer.replace(/\r\n/g, '\n');
    const chunks = normalized.split('\n\n');
    buffer = chunks.pop() || '';

    for (const chunk of chunks) {
      if (!chunk.trim()) {
        continue;
      }
      lastEvent = emitSseEvent(chunk, onEvent);
      if (lastEvent.event === 'done') {
        completedByDoneEvent = true;
        await reader.cancel().catch(() => {});
        return true;
      }
    }
    return false;
  };

  while (!completedByDoneEvent) {
    let readResult;
    try {
      readResult = await reader.read();
    } catch (error) {
      if (completedByDoneEvent) {
        break;
      }
      throw error;
    }

    const { done, value } = readResult;
    if (done) {
      break;
    }
    if (await handleChunk(decoder.decode(value, { stream: true }))) {
      return lastEvent;
    }
  }

  const remaining = decoder.decode();
  if (remaining && await handleChunk(remaining)) {
    return lastEvent;
  }
  if (!completedByDoneEvent && buffer.trim()) {
    lastEvent = emitSseEvent(buffer, onEvent);
  }
  return lastEvent;
};

export const fetchUsers = () => apiClient.get('/users');

export const getUser = (id) => apiClient.get(`/users/${id}`);

export const createUser = (payload) => apiClient.post('/users', payload);

export const updateUser = (id, payload) => apiClient.put(`/users/${id}`, payload);

export const deleteUser = (id) => apiClient.delete(`/users/${id}`);
