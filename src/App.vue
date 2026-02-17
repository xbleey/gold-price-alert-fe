<template>
  <div v-if="!authState.authenticated" class="auth-shell">
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

  <div v-else class="secure-shell">
    <div class="auth-toolbar">
      <div class="auth-toolbar-meta">
        <span>当前用户：{{ authState.profile?.username || '-' }}</span>
        <el-tag size="small" :type="isAdmin ? 'warning' : 'info'">
          {{ isAdmin ? 'ADMIN' : 'USER' }}
        </el-tag>
      </div>
      <div class="inline-actions">
        <el-button :type="activePage === 'dashboard' ? 'primary' : 'default'" @click="activePage = 'dashboard'">
          业务面板
        </el-button>
        <el-button
          :type="activePage === 'users' ? 'primary' : 'default'"
          :disabled="!isAdmin"
          @click="activePage = 'users'"
        >
          用户管理
        </el-button>
        <el-button type="danger" plain @click="handleLogout">退出登录</el-button>
      </div>
    </div>

    <DashboardPage v-if="activePage === 'dashboard'" />
    <UserManagementPage v-else-if="isAdmin" />
    <div v-else class="app-content">
      <el-empty description="当前账号无用户管理权限" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import DashboardPage from './views/DashboardPage.vue';
import UserManagementPage from './views/UserManagementPage.vue';
import { fetchCurrentUser } from './api';
import { buildBasicAuthToken, clearAuthToken, getAuthToken, setAuthToken } from './auth';

const loginFormRef = ref();
const activePage = ref('dashboard');

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

const isAdmin = computed(() => {
  const roles = authState.profile?.roles || [];
  return roles.includes('ROLE_ADMIN');
});

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

const loadCurrentUser = async (authorization) => {
  const { data } = await fetchCurrentUser(authorization);
  authState.profile = data;
  authState.authenticated = true;
  if (!data?.roles?.includes('ROLE_ADMIN') && activePage.value === 'users') {
    activePage.value = 'dashboard';
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
    await loadCurrentUser(authorization);
    setAuthToken(authorization);
    loginForm.password = '';
    activePage.value = 'dashboard';
    ElMessage.success('登录成功');
  } catch (error) {
    clearAuthToken();
    authState.authenticated = false;
    authState.profile = null;
    ElMessage.error(`登录失败：${resolveError(error)}`);
  } finally {
    authState.loading = false;
  }
};

const handleLogout = () => {
  clearAuthToken();
  authState.authenticated = false;
  authState.profile = null;
  activePage.value = 'dashboard';
  loginForm.password = '';
  ElMessage.success('已退出登录');
};

onMounted(async () => {
  const token = getAuthToken();
  if (!token) {
    return;
  }
  authState.loading = true;
  try {
    await loadCurrentUser(token);
  } catch {
    clearAuthToken();
    authState.authenticated = false;
    authState.profile = null;
  } finally {
    authState.loading = false;
  }
});
</script>