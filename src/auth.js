const AUTH_STORAGE_KEY = 'gold-alert-basic-auth-token';

export const getAuthToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem(AUTH_STORAGE_KEY) || '';
};

export const setAuthToken = (token) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, token);
};

export const clearAuthToken = () => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const buildBasicAuthToken = (username, password) => {
  const account = `${username ?? ''}:${password ?? ''}`;
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return `Basic ${window.btoa(account)}`;
  }
  return `Basic ${btoa(account)}`;
};

const decodeBase64 = (value) => {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(value);
  }
  return atob(value);
};

export const parseBasicAuthToken = (token) => {
  const rawToken = String(token || '').trim();
  if (!rawToken) {
    return null;
  }
  if (!/^basic\s+/i.test(rawToken)) {
    return null;
  }

  const encoded = rawToken.replace(/^basic\s+/i, '').trim();
  if (!encoded) {
    return null;
  }

  try {
    const decoded = decodeBase64(encoded);
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) {
      return {
        username: decoded,
        password: '',
      };
    }
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
};
