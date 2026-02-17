<template>
  <div v-if="isRouteNotFound" class="auth-shell">
    <el-card class="login-card">
      <el-result icon="warning" title="404" sub-title="页面不存在">
        <template #extra>
          <el-button type="primary" @click="handleNavigateToLogin">去登录页</el-button>
        </template>
      </el-result>
    </el-card>
  </div>

  <div v-else-if="isLoginRoute" class="auth-shell">
    <el-card class="login-card">
      <div class="login-head">
        <h1>金价告警控制台</h1>
        <p>请输入账号密码完成登录</p>
      </div>
      <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="loginForm.username"
            maxlength="64"
            autocomplete="username"
            clearable
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            show-password
            autocomplete="current-password"
            clearable
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-button type="primary" class="login-submit-btn" :loading="authState.loading" @click="handleLogin">
          登录
        </el-button>
      </el-form>
      <p class="login-hint">默认管理员：admin / admin</p>
    </el-card>
  </div>

  <div v-else-if="authState.loading || !authState.authenticated" class="auth-shell">
    <el-card class="login-card">
      <el-skeleton :rows="5" animated />
    </el-card>
  </div>

  <div v-else class="secure-shell">
    <div class="auth-toolbar">
      <div class="auth-toolbar-meta">
        <span>当前用户：{{ authState.profile?.username || '-' }}</span>
        <el-tag size="small" :type="isAdmin ? 'warning' : 'info'">
          {{ isAdmin ? 'ADMIN' : 'USER' }}
        </el-tag>
      </div>
      <div class="inline-actions">
        <el-button :type="currentRoutePath === '/dashboard' ? 'primary' : 'default'" @click="handleNavigateToDashboard">
          业务面板
        </el-button>
        <el-button
          :type="currentRoutePath === '/users' ? 'primary' : 'default'"
          :disabled="!isAdmin"
          @click="handleNavigateToUsers"
        >
          用户管理
        </el-button>
        <el-button type="danger" plain @click="handleLogout">退出登录</el-button>
      </div>
    </div>

    <DashboardPage v-if="currentRoutePath === '/dashboard'" />
    <UserManagementPage v-else-if="isAdmin" />
    <div v-else class="app-content">
      <el-empty description="当前账号无用户管理权限" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import DashboardPage from './views/DashboardPage.vue';
import UserManagementPage from './views/UserManagementPage.vue';
import { fetchCurrentUser } from './api';
import { isAuthErrorNotified } from './api/client';
import { buildBasicAuthToken, clearAuthToken, getAuthToken, setAuthToken } from './auth';

const normalizeBasePath = (value) => {
  const withLeadingSlash = String(value || '/').startsWith('/') ? String(value || '/') : `/${String(value || '/')}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

const normalizeRoutePath = (value) => {
  const raw = String(value || '/').split(/[?#]/)[0] || '/';
  if (raw === '/') {
    return '/';
  }
  const normalized = raw.replace(/\/+/g, '/').replace(/^\/?/, '/').replace(/\/+$/, '');
  return normalized || '/';
};

const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL || '/');
const APP_BASE_PATH_NO_TRAILING_SLASH = APP_BASE_PATH === '/' ? '' : APP_BASE_PATH.slice(0, -1);
const KNOWN_ROUTE_PATHS = ['/login', '/dashboard', '/users'];
const PROTECTED_ROUTE_PATHS = ['/dashboard', '/users'];

const resolveRoutePathFromLocation = () => {
  if (typeof window === 'undefined') {
    return '/';
  }
  const pathname = String(window.location.pathname || '/');
  if (!APP_BASE_PATH_NO_TRAILING_SLASH) {
    return normalizeRoutePath(pathname);
  }
  if (pathname === APP_BASE_PATH_NO_TRAILING_SLASH) {
    return '/';
  }
  if (pathname.startsWith(`${APP_BASE_PATH_NO_TRAILING_SLASH}/`)) {
    return normalizeRoutePath(pathname.slice(APP_BASE_PATH_NO_TRAILING_SLASH.length));
  }
  return normalizeRoutePath(pathname);
};

const buildPathWithBase = (routePath) => {
  const normalizedRoutePath = normalizeRoutePath(routePath);
  if (!APP_BASE_PATH_NO_TRAILING_SLASH) {
    return normalizedRoutePath === '/' ? '/' : normalizedRoutePath;
  }
  if (normalizedRoutePath === '/') {
    return APP_BASE_PATH;
  }
  return `${APP_BASE_PATH_NO_TRAILING_SLASH}${normalizedRoutePath}`;
};

const loginFormRef = ref();
const currentRoutePath = ref('/');
const redirectPath = ref('/dashboard');
const verifiedToken = ref('');
const routing = reactive({
  guarding: false,
  pendingPath: '',
});

const loginForm = reactive({
  username: 'admin',
  password: 'admin',
});

const authState = reactive({
  loading: false,
  authenticated: false,
  profile: null,
});

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const isLoginRoute = computed(() => currentRoutePath.value === '/login');
const isRouteNotFound = computed(
  () => currentRoutePath.value !== '/' && !KNOWN_ROUTE_PATHS.includes(currentRoutePath.value),
);

const isAdmin = computed(() => {
  const roles = authState.profile?.roles || [];
  return roles.includes('ROLE_ADMIN');
});

const resetAuthState = () => {
  authState.authenticated = false;
  authState.profile = null;
  verifiedToken.value = '';
};

const resolveError = (error) => {
  if (!error) {
    return '未知错误';
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.response?.data) {
    return JSON.stringify(error.response.data);
  }
  return error.message || String(error);
};

const showErrorMessage = (title, error) => {
  if (isAuthErrorNotified(error)) {
    return;
  }
  ElMessage.error(`${title}：${resolveError(error)}`);
};

const loadCurrentUser = async (authorization, options = {}) => {
  const { data } = await fetchCurrentUser(authorization, options);
  authState.profile = data;
  authState.authenticated = true;
  verifiedToken.value = authorization;
  return data;
};

const isProtectedRoute = (path) => PROTECTED_ROUTE_PATHS.includes(path);

const navigateTo = (path, { replace = false } = {}) => {
  const normalizedPath = normalizeRoutePath(path);
  currentRoutePath.value = normalizedPath;
  if (typeof window === 'undefined') {
    return;
  }
  const nextPath = buildPathWithBase(normalizedPath);
  if (window.location.pathname === nextPath) {
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', nextPath);
    return;
  }
  window.history.pushState(null, '', nextPath);
};

const redirectToLogin = (path) => {
  if (isProtectedRoute(path)) {
    redirectPath.value = path;
  }
  ElMessage.warning('用户未登录，请先登录');
  navigateTo('/login', { replace: true });
};

const guardRoute = async (path) => {
  if (path !== '/' && !KNOWN_ROUTE_PATHS.includes(path)) {
    return;
  }

  if (path === '/') {
    navigateTo(getAuthToken() ? '/dashboard' : '/login', { replace: true });
    return;
  }

  if (!isProtectedRoute(path)) {
    if (path === '/login' && authState.authenticated) {
      navigateTo('/dashboard', { replace: true });
    }
    return;
  }

  const token = getAuthToken();
  if (!token) {
    resetAuthState();
    redirectToLogin(path);
    return;
  }

  if (authState.authenticated && authState.profile && verifiedToken.value === token) {
    return;
  }

  authState.loading = true;
  try {
    await loadCurrentUser(token, { suppressAuthPopup: true });
  } catch (error) {
    clearAuthToken();
    resetAuthState();
    if (error?.response?.status === 401) {
      redirectToLogin(path);
      return;
    }
    showErrorMessage('鉴权失败', error);
    navigateTo('/login', { replace: true });
  } finally {
    authState.loading = false;
  }
};

const triggerRouteGuard = async (path) => {
  if (routing.guarding) {
    routing.pendingPath = path;
    return;
  }

  routing.guarding = true;
  let nextPath = path;
  try {
    while (nextPath) {
      routing.pendingPath = '';
      await guardRoute(nextPath);
      nextPath = routing.pendingPath;
    }
  } finally {
    routing.guarding = false;
  }
};

const handleLogin = async () => {
  const formEl = loginFormRef.value;
  if (!formEl) {
    return;
  }
  try {
    await formEl.validate();
  } catch {
    return;
  }

  authState.loading = true;
  try {
    const authorization = buildBasicAuthToken(
      String(loginForm.username || '').trim(),
      String(loginForm.password || ''),
    );
    await loadCurrentUser(authorization, { suppressAuthPopup: true });
    setAuthToken(authorization);
    loginForm.password = '';
    const nextPath = isProtectedRoute(redirectPath.value) ? redirectPath.value : '/dashboard';
    redirectPath.value = '/dashboard';
    navigateTo(nextPath, { replace: true });
    ElMessage.success('登录成功');
  } catch (error) {
    clearAuthToken();
    resetAuthState();
    showErrorMessage('登录失败', error);
  } finally {
    authState.loading = false;
  }
};

const handleLogout = () => {
  clearAuthToken();
  resetAuthState();
  redirectPath.value = '/dashboard';
  loginForm.password = '';
  navigateTo('/login', { replace: true });
  ElMessage.success('已退出登录');
};

const handleNavigateToLogin = () => {
  navigateTo('/login', { replace: true });
};

const handleNavigateToDashboard = () => {
  navigateTo('/dashboard');
};

const handleNavigateToUsers = () => {
  navigateTo('/users');
};

const syncRoutePathFromLocation = () => {
  currentRoutePath.value = resolveRoutePathFromLocation();
};

const handlePopstate = () => {
  syncRoutePathFromLocation();
};

watch(currentRoutePath, (path) => {
  void triggerRouteGuard(path);
});

onMounted(() => {
  if (typeof window === 'undefined') {
    return;
  }
  syncRoutePathFromLocation();
  window.addEventListener('popstate', handlePopstate);
  void triggerRouteGuard(currentRoutePath.value);
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('popstate', handlePopstate);
});
</script>
