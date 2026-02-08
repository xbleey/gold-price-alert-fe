<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>金价告警控制台</h1>
      <p>用于可视化查询与操作后端接口，支持开发与生产环境切换。</p>
    </header>
    <main class="app-content">
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="接口概览" name="overview">
          <el-card class="section-card">
            <p class="section-title">当前接口配置</p>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="API Base">{{ apiBase }}</el-descriptions-item>
              <el-descriptions-item label="站点 Base">{{ siteBase }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
          <el-card class="section-card">
            <p class="section-title">接口清单</p>
            <el-table :data="endpointRows" style="width: 100%">
              <el-table-column prop="name" label="用途" min-width="160" />
              <el-table-column prop="method" label="方法" width="100" />
              <el-table-column prop="path" label="路径" min-width="200" />
              <el-table-column prop="description" label="说明" min-width="260" />
            </el-table>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="价格快照" name="price">
          <el-card class="section-card">
            <p class="section-title">最新价格抓取</p>
            <div class="inline-actions">
              <el-button type="primary" :loading="priceState.loading" @click="handleFetchPrice">
                立即抓取
              </el-button>
              <span v-if="priceState.result" class="value-label">
                状态：{{ priceState.result.status || '-' }}
              </span>
            </div>
            <el-divider />
            <el-descriptions :column="2" border>
              <el-descriptions-item label="抓取时间">
                {{ priceState.result?.fetchedAt || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="价格">
                {{ priceState.result?.price || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="币种">
                {{ priceState.result?.symbol || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card class="section-card">
            <p class="section-title">历史快照</p>
            <div class="inline-actions">
              <el-input-number v-model="historyState.length" :min="1" :max="500" />
              <el-button :loading="historyState.loading" @click="handleFetchHistory">
                查询历史
              </el-button>
            </div>
            <el-divider />
            <el-table :data="historyState.data" style="width: 100%">
              <el-table-column prop="fetchedAt" label="抓取时间" min-width="200" />
              <el-table-column prop="price" label="价格" min-width="120" />
              <el-table-column prop="symbol" label="币种" min-width="120" />
              <el-table-column prop="updatedAtReadable" label="更新时间" min-width="200" />
            </el-table>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="阈值配置" name="threshold">
          <el-card class="section-card">
            <p class="section-title">当前阈值</p>
            <div class="inline-actions">
              <el-button :loading="thresholdState.loading" @click="handleGetThreshold">
                刷新阈值
              </el-button>
              <el-tag
                v-if="thresholdState.info"
                class="status-tag"
                :type="thresholdState.info.status === 'ok' ? 'success' : 'info'"
              >
                {{ thresholdState.info.status }}
              </el-tag>
            </div>
            <el-divider />
            <el-descriptions :column="1" border>
              <el-descriptions-item label="阈值">
                {{ thresholdState.info?.threshold || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card class="section-card">
            <p class="section-title">设置阈值</p>
            <div class="inline-actions">
              <el-input
                v-model="thresholdState.value"
                placeholder="请输入阈值，例如 0.35"
                style="max-width: 240px"
              />
              <el-button type="primary" :loading="thresholdState.saving" @click="handleSetThreshold">
                保存阈值
              </el-button>
              <el-button type="danger" :loading="thresholdState.clearing" @click="handleClearThreshold">
                清空阈值
              </el-button>
            </div>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="告警历史" name="alerts">
          <el-card class="section-card">
            <p class="section-title">告警查询</p>
            <div class="inline-actions">
              <el-select v-model="alertState.query.alertLevel" placeholder="全部等级" clearable>
                <el-option v-for="level in alertLevels" :key="level" :label="level" :value="level" />
              </el-select>
              <el-button :loading="alertState.loading" @click="handleFetchAlerts">
                查询告警
              </el-button>
            </div>
            <el-divider />
            <el-table :data="alertState.records" style="width: 100%">
              <el-table-column prop="alertLevel" label="等级" width="140" />
              <el-table-column prop="alertTimeBeijing" label="告警时间(北京)" min-width="200" />
              <el-table-column prop="alertTimeUtc" label="告警时间(UTC)" min-width="200" />
              <el-table-column prop="thresholdPercent" label="阈值%" width="120" />
              <el-table-column prop="changePercent" label="涨跌幅%" width="120" />
              <el-table-column prop="baselinePrice" label="基准价" width="120" />
              <el-table-column prop="latestPrice" label="最新价" width="120" />
            </el-table>
            <el-divider />
            <el-pagination
              :current-page="alertState.query.pageNum"
              :page-size="alertState.query.pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="alertState.total"
              layout="total, sizes, prev, pager, next"
              @current-change="handleAlertPageChange"
              @size-change="handleAlertSizeChange"
            />
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="健康检查" name="health">
          <el-card class="section-card">
            <p class="section-title">健康探针</p>
            <div class="inline-actions">
              <el-button type="primary" :loading="healthState.loading" @click="handleHealthCheck">
                立即检查
              </el-button>
            </div>
            <el-divider />
            <el-row :gutter="16">
              <el-col :span="8">
                <el-card>
                  <p class="section-title">存活探针 /health/live</p>
                  <pre class="json-block">{{ formatJson(healthState.live) }}</pre>
                </el-card>
              </el-col>
              <el-col :span="8">
                <el-card>
                  <p class="section-title">就绪探针 /health/ready</p>
                  <pre class="json-block">{{ formatJson(healthState.ready) }}</pre>
                </el-card>
              </el-col>
              <el-col :span="8">
                <el-card>
                  <p class="section-title">综合探针 /health</p>
                  <pre class="json-block">{{ formatJson(healthState.overall) }}</pre>
                </el-card>
              </el-col>
            </el-row>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="测试邮件" name="test-email">
          <el-card class="section-card">
            <p class="section-title">触发测试邮件</p>
            <div class="inline-actions">
              <el-button type="primary" :loading="emailState.loading" @click="handleSendEmail">
                发送测试邮件
              </el-button>
              <span class="value-label">{{ emailState.message }}</span>
            </div>
          </el-card>
        </el-tab-pane>
      </el-tabs>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  clearThreshold,
  fetchAlertList,
  fetchHealth,
  fetchHealthLive,
  fetchHealthReady,
  fetchHistory,
  fetchPrice,
  getThreshold,
  sendTestEmail,
  setThreshold,
} from './api';

const activeTab = ref('overview');
const apiBase = import.meta.env.VITE_API_BASE || '/gold-price-alert/api';
const siteBase = import.meta.env.VITE_BASE_PATH || '/';

const endpointRows = [
  {
    name: '拉取最新价格',
    method: 'GET',
    path: '/price',
    description: '手动触发价格抓取并返回结果',
  },
  {
    name: '查询历史快照',
    method: 'GET',
    path: '/history?length=100',
    description: '返回最近 N 条金价快照',
  },
  {
    name: '获取阈值',
    method: 'GET',
    path: '/threshold',
    description: '查看当前阈值配置',
  },
  {
    name: '设置阈值',
    method: 'POST',
    path: '/threshold?value=0.35',
    description: '写入阈值配置',
  },
  {
    name: '清空阈值',
    method: 'DELETE',
    path: '/threshold',
    description: '删除阈值配置',
  },
  {
    name: '告警历史',
    method: 'GET',
    path: '/alert/list?pageNum=1&pageSize=20',
    description: '分页查询告警历史，可按等级过滤',
  },
  {
    name: '存活探针',
    method: 'GET',
    path: '/health/live',
    description: '检查服务进程是否存活',
  },
  {
    name: '就绪探针',
    method: 'GET',
    path: '/health/ready',
    description: '检查数据库和 Redis 连接',
  },
  {
    name: '综合探针',
    method: 'GET',
    path: '/health',
    description: '通用健康检查入口',
  },
  {
    name: '测试邮件',
    method: 'POST',
    path: '/test/email',
    description: '触发后端测试邮件发送',
  },
];

const alertLevels = ['INFO_LEVEL', 'MINOR_LEVEL', 'MODERATE_LEVEL', 'MAJOR_LEVEL', 'CRITICAL_LEVEL'];

const priceState = reactive({
  loading: false,
  result: null,
});

const historyState = reactive({
  loading: false,
  length: 100,
  data: [],
});

const thresholdState = reactive({
  loading: false,
  saving: false,
  clearing: false,
  info: null,
  value: '',
});

const alertState = reactive({
  loading: false,
  query: {
    pageNum: 1,
    pageSize: 20,
    alertLevel: '',
  },
  records: [],
  total: 0,
});

const healthState = reactive({
  loading: false,
  live: null,
  ready: null,
  overall: null,
});

const emailState = reactive({
  loading: false,
  message: '',
});

const handleFetchPrice = async () => {
  priceState.loading = true;
  try {
    const { data } = await fetchPrice();
    priceState.result = data;
    ElMessage.success('价格已更新');
  } catch (error) {
    ElMessage.error(`抓取失败：${resolveError(error)}`);
  } finally {
    priceState.loading = false;
  }
};

const handleFetchHistory = async () => {
  historyState.loading = true;
  try {
    const { data } = await fetchHistory(historyState.length);
    historyState.data = data || [];
    ElMessage.success('历史数据已加载');
  } catch (error) {
    ElMessage.error(`加载失败：${resolveError(error)}`);
  } finally {
    historyState.loading = false;
  }
};

const handleGetThreshold = async () => {
  thresholdState.loading = true;
  try {
    const { data } = await getThreshold();
    thresholdState.info = data;
  } catch (error) {
    ElMessage.error(`读取失败：${resolveError(error)}`);
  } finally {
    thresholdState.loading = false;
  }
};

const handleSetThreshold = async () => {
  if (!thresholdState.value) {
    ElMessage.warning('请先输入阈值');
    return;
  }
  thresholdState.saving = true;
  try {
    const { data } = await setThreshold(thresholdState.value);
    thresholdState.info = data;
    ElMessage.success('阈值已更新');
  } catch (error) {
    ElMessage.error(`保存失败：${resolveError(error)}`);
  } finally {
    thresholdState.saving = false;
  }
};

const handleClearThreshold = async () => {
  thresholdState.clearing = true;
  try {
    const { data } = await clearThreshold();
    thresholdState.info = { status: data.status, threshold: null };
    thresholdState.value = '';
    ElMessage.success('阈值已清空');
  } catch (error) {
    ElMessage.error(`清空失败：${resolveError(error)}`);
  } finally {
    thresholdState.clearing = false;
  }
};

const handleFetchAlerts = async () => {
  alertState.loading = true;
  try {
    const { data } = await fetchAlertList(alertState.query);
    alertState.records = data.records || [];
    alertState.total = Number(data.total || 0);
  } catch (error) {
    ElMessage.error(`查询失败：${resolveError(error)}`);
  } finally {
    alertState.loading = false;
  }
};

const handleAlertPageChange = (page) => {
  alertState.query.pageNum = page;
  handleFetchAlerts();
};

const handleAlertSizeChange = (size) => {
  alertState.query.pageSize = size;
  alertState.query.pageNum = 1;
  handleFetchAlerts();
};

const handleHealthCheck = async () => {
  healthState.loading = true;
  try {
    const [live, ready, overall] = await Promise.all([
      fetchHealthLive(),
      fetchHealthReady(),
      fetchHealth(),
    ]);
    healthState.live = live.data;
    healthState.ready = ready.data;
    healthState.overall = overall.data;
    ElMessage.success('健康检查完成');
  } catch (error) {
    ElMessage.error(`检查失败：${resolveError(error)}`);
  } finally {
    healthState.loading = false;
  }
};

const handleSendEmail = async () => {
  emailState.loading = true;
  try {
    const { data } = await sendTestEmail();
    emailState.message = data;
    ElMessage.success('测试邮件已触发');
  } catch (error) {
    ElMessage.error(`发送失败：${resolveError(error)}`);
  } finally {
    emailState.loading = false;
  }
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

const formatJson = (value) => {
  if (!value) {
    return '暂无数据';
  }
  return JSON.stringify(value, null, 2);
};
</script>
