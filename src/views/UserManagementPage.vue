<template>
  <div class="app-content user-management-page">
    <el-card class="section-card">
      <div class="section-head">
        <p class="section-title">用户列表</p>
        <div class="inline-actions">
          <el-button :loading="userState.loading" @click="handleFetchUsers">
            刷新列表
          </el-button>
          <el-button type="primary" @click="handleOpenCreateDialog">
            新增用户
          </el-button>
        </div>
      </div>

      <el-table stripe v-loading="userState.loading" :data="userState.records" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" min-width="180" />
        <el-table-column prop="roleName" label="角色" width="120" />
        <el-table-column prop="enabled" label="启用" width="120">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="190">
          <template #default="{ row }">
            {{ formatDateTimeValue(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="190">
          <template #default="{ row }">
            {{ formatDateTimeValue(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="recipient-row-actions">
              <el-button type="primary" link @click="handleOpenEditDialog(row.id)">
                编辑
              </el-button>
              <el-button
                type="danger"
                link
                :disabled="isProtectedAdmin(row)"
                @click="handleDeleteUser(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="recipient-total">共 {{ userState.total }} 条</div>
    </el-card>

    <el-dialog
      v-model="userState.dialogVisible"
      :title="userState.mode === 'create' ? '新增用户' : '编辑用户'"
      width="460px"
      @closed="resetUserForm"
    >
      <el-form ref="userFormRef" :model="userState.form" :rules="userRules" label-width="92px">
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="userState.form.username"
            :disabled="userState.mode === 'edit'"
            maxlength="64"
            clearable
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="userState.form.password"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="userState.mode === 'create' ? '请输入密码' : '留空表示不修改'"
            clearable
          />
        </el-form-item>
        <el-form-item label="角色" prop="roleName">
          <el-select v-model="userState.form.roleName" style="width: 100%">
            <el-option label="管理员" value="ADMIN" />
            <el-option label="普通用户" value="USER" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用" prop="enabled">
          <el-switch v-model="userState.form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="inline-actions recipient-dialog-footer">
          <el-button @click="userState.dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="userState.submitting" @click="handleSubmitUser">
            保存
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createUser, deleteUser, fetchUsers, getUser, updateUser } from '../api';

const userFormRef = ref();

const userState = reactive({
  loading: false,
  submitting: false,
  records: [],
  total: 0,
  dialogVisible: false,
  mode: 'create',
  form: {
    id: null,
    username: '',
    password: '',
    roleName: 'USER',
    enabled: true,
  },
});

const validatePassword = (_rule, value, callback) => {
  const password = String(value || '').trim();
  if (userState.mode === 'create' && !password) {
    callback(new Error('请输入密码'));
    return;
  }
  if (password && (password.length < 4 || password.length > 128)) {
    callback(new Error('密码长度必须在 4~128 之间'));
    return;
  }
  callback();
};

const userRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9._-]{3,64}$/, message: '仅支持字母/数字/._-，长度 3~64', trigger: 'blur' },
  ],
  password: [
    { validator: validatePassword, trigger: 'blur' },
  ],
  roleName: [
    { required: true, message: '请选择角色', trigger: 'change' },
  ],
};

const formatDateTime = (timestamp) => {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
};

const formatDateTimeValue = (value) => {
  if (!value) {
    return '-';
  }
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return String(value);
  }
  return formatDateTime(timestamp);
};

const isProtectedAdmin = (row) =>
  String(row.username || '').toLowerCase() === 'admin' && String(row.roleName || '').toUpperCase() === 'ADMIN';

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

const resetUserForm = () => {
  userState.form.id = null;
  userState.form.username = '';
  userState.form.password = '';
  userState.form.roleName = 'USER';
  userState.form.enabled = true;
  userFormRef.value?.clearValidate();
};

const handleFetchUsers = async ({ silent = false } = {}) => {
  userState.loading = true;
  try {
    const { data } = await fetchUsers();
    userState.records = data.records || [];
    userState.total = Number(data.total || userState.records.length || 0);
  } catch (error) {
    if (!silent) {
      ElMessage.error(`查询失败：${resolveError(error)}`);
    }
  } finally {
    userState.loading = false;
  }
};

const handleOpenCreateDialog = () => {
  userState.mode = 'create';
  userState.dialogVisible = true;
  resetUserForm();
};

const handleOpenEditDialog = async (id) => {
  userState.submitting = true;
  try {
    const { data } = await getUser(id);
    const record = data.record || {};
    userState.mode = 'edit';
    userState.form.id = record.id || id;
    userState.form.username = record.username || '';
    userState.form.password = '';
    userState.form.roleName = record.roleName || 'USER';
    userState.form.enabled = Boolean(record.enabled);
    userState.dialogVisible = true;
    userFormRef.value?.clearValidate();
  } catch (error) {
    ElMessage.error(`读取失败：${resolveError(error)}`);
  } finally {
    userState.submitting = false;
  }
};

const handleSubmitUser = async () => {
  const formEl = userFormRef.value;
  if (!formEl) {
    return;
  }
  try {
    await formEl.validate();
  } catch {
    return;
  }

  userState.submitting = true;
  try {
    if (userState.mode === 'create') {
      await createUser({
        username: String(userState.form.username || '').trim(),
        password: String(userState.form.password || '').trim(),
        roleName: userState.form.roleName,
        enabled: Boolean(userState.form.enabled),
      });
      ElMessage.success('用户已创建');
    } else {
      const payload = {
        roleName: userState.form.roleName,
        enabled: Boolean(userState.form.enabled),
      };
      const password = String(userState.form.password || '').trim();
      if (password) {
        payload.password = password;
      }
      await updateUser(userState.form.id, payload);
      ElMessage.success('用户已更新');
    }
    userState.dialogVisible = false;
    resetUserForm();
    await handleFetchUsers({ silent: true });
  } catch (error) {
    ElMessage.error(`保存失败：${resolveError(error)}`);
  } finally {
    userState.submitting = false;
  }
};

const handleDeleteUser = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认删除用户 ${row.username} 吗？`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );
  } catch {
    return;
  }

  userState.loading = true;
  try {
    await deleteUser(row.id);
    ElMessage.success('用户已删除');
    await handleFetchUsers({ silent: true });
  } catch (error) {
    ElMessage.error(`删除失败：${resolveError(error)}`);
  } finally {
    userState.loading = false;
  }
};

onMounted(() => {
  handleFetchUsers({ silent: true });
});
</script>
