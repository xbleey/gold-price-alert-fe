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
