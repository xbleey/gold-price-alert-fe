const AUTH_SESSION_STORAGE_KEY = 'gold-alert-auth-session';
const LEGACY_BASIC_AUTH_STORAGE_KEY = 'gold-alert-basic-auth-token';

const normalizeRole = (value) => String(value || 'USER').trim().toUpperCase() || 'USER';

const normalizeAuthSession = (session) => {
  const accessToken = String(session?.accessToken || '').trim();
  if (!accessToken) {
    return null;
  }
  return {
    accessToken,
    username: String(session?.username || '').trim().toLowerCase(),
    role: normalizeRole(session?.role),
    expiresAt: String(session?.expiresAt || '').trim(),
  };
};

const readStoredSession = () => {
  const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getAuthSession = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const normalized = normalizeAuthSession(readStoredSession());
  if (!normalized) {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  }
  if (localStorage.getItem(LEGACY_BASIC_AUTH_STORAGE_KEY)) {
    localStorage.removeItem(LEGACY_BASIC_AUTH_STORAGE_KEY);
  }
  return normalized;
};

export const setAuthSession = (session) => {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = normalizeAuthSession(session);
  if (!normalized) {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.removeItem(LEGACY_BASIC_AUTH_STORAGE_KEY);
};

export const clearAuthSession = () => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_BASIC_AUTH_STORAGE_KEY);
};

export const getAuthToken = () => getAuthSession()?.accessToken || '';

export const setAuthToken = (token) => {
  const currentSession = getAuthSession() || {};
  setAuthSession({
    ...currentSession,
    accessToken: token,
  });
};

export const clearAuthToken = () => {
  clearAuthSession();
};
