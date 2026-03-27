<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>金价告警控制台</h1>
      <p>首页展示 K 线趋势，支持最近 6 小时到 15 分钟的快速切换。</p>
    </header>
    <main class="app-content">
      <el-card class="section-card kline-card">
        <div class="section-head">
          <p class="section-title">金价 K 线趋势</p>
          <div class="inline-actions kline-actions">
            <el-radio-group
              v-model="klineState.range"
              class="kline-range-group"
              @change="handleRangeChange"
            >
              <el-radio-button v-for="item in klineRanges" :key="item.value" :label="item.value">
                {{ item.label }}
              </el-radio-button>
            </el-radio-group>
            <el-button
              type="primary"
              class="kline-refresh-btn"
              :loading="klineState.loading"
              @click="handleFetchKline"
            >
              刷新 K 线
            </el-button>
          </div>
        </div>
        <div class="kline-summary">
          <span>最新价：{{ klineState.latestPrice }}</span>
          <span>币种：{{ klineState.latestSymbol }}</span>
          <span>最新时间：{{ klineState.latestTime }}</span>
          <span>样本数：{{ klineState.windowData.length }}</span>
        </div>
        <div ref="chartWrapperRef" class="chart-wrapper">
          <div v-if="klineState.candles.length" ref="klineChartRef" class="kline-chart" />
          <el-empty v-else description="当前时间窗口暂无可用历史数据" />
        </div>
      </el-card>

      <div
        class="mobile-tab-swipe-zone"
        @touchstart.passive="handleTabTouchStart"
        @touchmove.passive="handleTabTouchMove"
        @touchend="handleTabTouchEnd"
        @touchcancel="resetTabTouchState"
      >
        <el-tabs v-model="activeTab" type="border-card">
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
            <el-descriptions :column="1" border>
              <el-descriptions-item label="抓取时间">
                {{ formatDateTimeValue(priceState.result?.fetchedAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="价格">
                {{ formatPrice(priceState.result?.price) }}
              </el-descriptions-item>
              <el-descriptions-item label="币种">
                {{ priceState.result?.symbol || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="阈值配置" name="threshold">
          <el-card class="section-card">
            <p class="section-title">当前阈值</p>
            <p class="threshold-value">{{ formatThreshold(thresholdState.info?.threshold) }}</p>
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
          </el-card>

          <el-card class="section-card">
            <p class="section-title">设置阈值</p>
            <div class="inline-actions">
              <el-input
                v-model="thresholdState.value"
                placeholder="请输入阈值，例如 35.129（保存时截断为两位小数）"
                inputmode="decimal"
                style="max-width: 280px"
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
            <div class="inline-actions alert-filter-actions">
              <el-button
                v-for="level in alertLevels"
                :key="level"
                size="small"
                :type="isAlertLevelSelected(level) ? 'primary' : 'default'"
                :plain="!isAlertLevelSelected(level)"
                :disabled="alertState.loading"
                @click="toggleAlertLevel(level)"
              >
                {{ level }}
              </el-button>
            </div>
            <el-divider />
            <el-table stripe :data="alertState.records" style="width: 100%">
              <el-table-column prop="alertLevel" label="等级" width="140" />
              <el-table-column prop="alertTimeBeijing" label="告警时间(北京)" min-width="200">
                <template #default="{ row }">
                  {{ formatDateTimeValue(row.alertTimeBeijing) }}
                </template>
              </el-table-column>
              <el-table-column prop="alertTimeUtc" label="告警时间(UTC)" min-width="200">
                <template #default="{ row }">
                  {{ formatDateTimeValue(row.alertTimeUtc) }}
                </template>
              </el-table-column>
              <el-table-column prop="thresholdPercent" label="阈值%" width="120" />
              <el-table-column prop="changePercent" label="涨跌幅%" width="120" />
              <el-table-column prop="baselinePrice" label="基准价" width="120">
                <template #default="{ row }">
                  {{ formatPrice(row.baselinePrice) }}
                </template>
              </el-table-column>
              <el-table-column prop="latestPrice" label="最新价" width="120">
                <template #default="{ row }">
                  {{ formatPrice(row.latestPrice) }}
                </template>
              </el-table-column>
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

        <el-tab-pane label="报警等级配置" name="alert-level-config">
          <el-card class="section-card">
            <div class="section-head">
              <p class="section-title">等级列表</p>
              <div class="inline-actions">
                <el-button :loading="alertLevelState.loading" @click="handleFetchAlertLevels">
                  刷新列表
                </el-button>
                <el-button type="primary" @click="handleOpenAlertLevelCreateDialog">
                  新增等级
                </el-button>
              </div>
            </div>

            <el-table stripe v-loading="alertLevelState.loading" :data="alertLevelState.records" style="width: 100%">
              <el-table-column prop="levelName" label="等级编码" width="120" />
              <el-table-column prop="levelRank" label="等级序号" width="120" />
              <el-table-column prop="thresholdPercent" label="阈值%" width="120">
                <template #default="{ row }">
                  {{ formatAlertThreshold(row.thresholdPercent) }}
                </template>
              </el-table-column>
              <el-table-column prop="windowMinutes" label="统计窗口(分钟)" width="140" />
              <el-table-column prop="cooldownMinutes" label="冷却时间(分钟)" width="140" />
              <el-table-column prop="protectedLevel" label="系统内置" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.protectedLevel ? 'warning' : 'info'">
                    {{ row.protectedLevel ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200" fixed="right">
                <template #default="{ row }">
                  <div class="recipient-row-actions">
                    <el-button type="primary" link @click="handleOpenAlertLevelEditDialog(row.levelName)">
                      编辑
                    </el-button>
                    <el-button
                      type="danger"
                      link
                      :disabled="row.protectedLevel"
                      @click="handleDeleteAlertLevel(row)"
                    >
                      删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <div class="recipient-total">共 {{ alertLevelState.total }} 条</div>
          </el-card>
        </el-tab-pane>

        <el-tab-pane label="收件人管理" name="recipients">
          <el-card class="section-card">
            <div class="section-head">
              <p class="section-title">收件人列表</p>
              <div class="inline-actions">
                <el-button :loading="recipientState.loading" @click="handleFetchRecipients">
                  刷新列表
                </el-button>
                <el-button type="primary" @click="handleOpenRecipientCreateDialog">
                  新增收件人
                </el-button>
              </div>
            </div>

            <el-table stripe v-loading="recipientState.loading" :data="recipientState.records" style="width: 100%">
              <el-table-column prop="id" label="ID" width="100" />
              <el-table-column prop="email" label="邮箱" min-width="260" />
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
                    <el-button type="primary" link @click="handleOpenRecipientEditDialog(row.id)">
                      编辑
                    </el-button>
                    <el-button type="danger" link @click="handleDeleteRecipient(row)">
                      删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <div class="recipient-total">共 {{ recipientState.total }} 条</div>
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
      </div>

      <el-dialog
        v-model="recipientState.dialogVisible"
        :title="recipientState.mode === 'create' ? '新增收件人' : '编辑收件人'"
        width="420px"
        @closed="resetRecipientForm"
      >
        <el-form ref="recipientFormRef" :model="recipientState.form" :rules="recipientRules" label-width="76px">
          <el-form-item label="邮箱" prop="email">
            <el-input
              v-model="recipientState.form.email"
              placeholder="请输入邮箱地址"
              maxlength="320"
              clearable
            />
          </el-form-item>
          <el-form-item label="启用" prop="enabled">
            <el-switch v-model="recipientState.form.enabled" />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="inline-actions recipient-dialog-footer">
            <el-button @click="recipientState.dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="recipientState.submitting" @click="handleSubmitRecipient">
              保存
            </el-button>
          </div>
        </template>
      </el-dialog>

      <el-dialog
        v-model="alertLevelState.dialogVisible"
        :title="alertLevelState.mode === 'create' ? '新增报警等级' : '编辑报警等级'"
        width="460px"
        @closed="resetAlertLevelForm"
      >
        <el-form
          ref="alertLevelFormRef"
          :model="alertLevelState.form"
          :rules="alertLevelRules"
          class="alert-level-form"
          label-width="110px"
        >
          <el-form-item label="等级编码" prop="levelName">
            <el-input
              v-model="alertLevelState.form.levelName"
              placeholder="请输入等级编码，例如 P6"
              maxlength="16"
              :disabled="alertLevelState.mode === 'edit'"
              clearable
            />
          </el-form-item>
          <el-form-item label="阈值百分比" prop="thresholdPercent">
            <el-input
              v-model="alertLevelState.form.thresholdPercent"
              placeholder="请输入 0.00~10.00，必须两位小数，例如 0.20"
              inputmode="decimal"
              clearable
            />
          </el-form-item>
          <el-form-item label="统计窗口(分钟)" prop="windowMinutes">
            <el-input-number
              v-model="alertLevelState.form.windowMinutes"
              :min="0"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="冷却时间(分钟)" prop="cooldownMinutes">
            <el-input-number
              v-model="alertLevelState.form.cooldownMinutes"
              :min="0"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="inline-actions recipient-dialog-footer">
            <el-button @click="alertLevelState.dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="alertLevelState.submitting" @click="handleSubmitAlertLevel">
              保存
            </el-button>
          </div>
        </template>
      </el-dialog>
    </main>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { CandlestickChart, LineChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ElMessage, ElMessageBox } from 'element-plus';
import { isAuthErrorNotified } from '../api/client';
import { formatDateTimeValue } from '../utils/dateTime';
import {
  createAlertLevel,
  clearThreshold,
  createMailRecipient,
  deleteAlertLevel,
  deleteMailRecipient,
  fetchAlertLevels,
  fetchAlertList,
  fetchHistory,
  fetchMailRecipients,
  fetchPrice,
  getAlertLevel,
  getMailRecipient,
  getThreshold,
  sendTestEmail,
  setThreshold,
  updateAlertLevel,
  updateMailRecipient,
} from '../api';

echarts.use([
  CandlestickChart,
  LineChart,
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const activeTab = ref('price');
const tabOrder = ['price', 'threshold', 'alerts', 'alert-level-config', 'recipients', 'test-email'];
const MOBILE_TAB_SWIPE_MIN_DISTANCE = 56;
const MOBILE_TAB_MAX_VERTICAL_DRIFT = 40;
const MOBILE_TAB_HORIZONTAL_RATIO = 1.2;
const alertLevels = ['INFO_LEVEL', 'MINOR_LEVEL', 'MODERATE_LEVEL', 'MAJOR_LEVEL', 'CRITICAL_LEVEL'];
const defaultAlertLevels = ['MAJOR_LEVEL', 'CRITICAL_LEVEL'];
const NON_NEGATIVE_NUMBER_PATTERN = /^(?:\d+\.?\d*|\.\d+)$/;
const ALERT_LEVEL_NAME_PATTERN = /^P[1-9]\d*$/i;
const ALERT_LEVEL_THRESHOLD_PATTERN = /^(?:10\.00|[0-9]\.\d{2})$/;

const klineRanges = [
  { label: '最近6小时', value: '6h', minutes: 360, bucketMinutes: 15, length: 2000 },
  { label: '最近2小时', value: '2h', minutes: 120, bucketMinutes: 5, length: 1000 },
  { label: '最近1小时', value: '1h', minutes: 60, bucketMinutes: 2, length: 700 },
  { label: '最近30分钟', value: '30m', minutes: 30, bucketMinutes: 1, length: 400 },
  { label: '最近15分钟', value: '15m', minutes: 15, bucketMinutes: 1, length: 250 },
];
const klineRangeMap = Object.fromEntries(klineRanges.map((item) => [item.value, item]));

const klineState = reactive({
  loading: false,
  range: '2h',
  rawData: [],
  windowData: [],
  candles: [],
  latestPrice: '-',
  latestSymbol: '-',
  latestTime: '-',
});

const priceState = reactive({
  loading: false,
  result: null,
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
    alertLevels: [...defaultAlertLevels],
  },
  records: [],
  total: 0,
});

const emailState = reactive({
  loading: false,
  message: '',
});

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/;
const recipientFormRef = ref();
const alertLevelFormRef = ref();
const recipientState = reactive({
  loading: false,
  submitting: false,
  dialogVisible: false,
  mode: 'create',
  records: [],
  total: 0,
  form: {
    id: null,
    email: '',
    enabled: true,
  },
});

const alertLevelState = reactive({
  loading: false,
  submitting: false,
  dialogVisible: false,
  mode: 'create',
  records: [],
  total: 0,
  form: {
    levelName: '',
    thresholdPercent: '',
    windowMinutes: 0,
    cooldownMinutes: 0,
  },
});

const recipientRules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    {
      validator: (_, value, callback) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) {
          callback(new Error('请输入邮箱地址'));
          return;
        }
        if (normalized.length > 320) {
          callback(new Error('邮箱长度不能超过 320'));
          return;
        }
        if (!EMAIL_PATTERN.test(normalized)) {
          callback(new Error('邮箱格式不正确'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

const validateNonNegativeInteger = (_, value, callback) => {
  if (value === '' || value === null || value === undefined) {
    callback(new Error('请输入非负整数'));
    return;
  }
  if (!Number.isInteger(value) || value < 0) {
    callback(new Error('请输入非负整数'));
    return;
  }
  callback();
};

const alertLevelRules = {
  levelName: [
    { required: true, message: '请输入等级编码', trigger: 'blur' },
    {
      validator: (_, value, callback) => {
        const normalized = String(value || '').trim().toUpperCase();
        if (!normalized) {
          callback(new Error('请输入等级编码'));
          return;
        }
        if (!ALERT_LEVEL_NAME_PATTERN.test(normalized)) {
          callback(new Error('等级编码格式错误，应为 P<number>，例如 P6'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  thresholdPercent: [
    { required: true, message: '请输入阈值百分比', trigger: 'blur' },
    {
      validator: (_, value, callback) => {
        const normalized = String(value || '').trim();
        if (!normalized) {
          callback(new Error('请输入阈值百分比'));
          return;
        }
        if (!ALERT_LEVEL_THRESHOLD_PATTERN.test(normalized)) {
          callback(new Error('请输入 0.00~10.00 且必须两位小数的值'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  windowMinutes: [{ validator: validateNonNegativeInteger, trigger: 'change' }],
  cooldownMinutes: [{ validator: validateNonNegativeInteger, trigger: 'change' }],
};

const isPhoneViewport = ref(false);
const chartWrapperRef = ref();
const klineChartRef = ref();
const tabTouchState = reactive({
  tracking: false,
  blocked: false,
  startX: 0,
  startY: 0,
  deltaX: 0,
  deltaY: 0,
});

const resetTabTouchState = () => {
  tabTouchState.tracking = false;
  tabTouchState.blocked = false;
  tabTouchState.startX = 0;
  tabTouchState.startY = 0;
  tabTouchState.deltaX = 0;
  tabTouchState.deltaY = 0;
};

const moveTabByOffset = (offset) => {
  if (!offset) {
    return;
  }
  const currentIndex = tabOrder.indexOf(activeTab.value);
  if (currentIndex < 0) {
    return;
  }
  const nextIndex = Math.min(Math.max(currentIndex + offset, 0), tabOrder.length - 1);
  if (nextIndex === currentIndex) {
    return;
  }
  activeTab.value = tabOrder[nextIndex];
};

const shouldBlockTabSwipe = (target) => {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(
      'input, textarea, select, button, a, .el-input, .el-input-number, .el-select, .el-switch, .el-slider, .el-radio-group, .el-checkbox-group, .el-pagination, .el-table, .el-dialog',
    ),
  );
};

const handleTabTouchStart = (event) => {
  resetTabTouchState();
  if (!isPhoneViewport.value || event.touches.length !== 1) {
    return;
  }
  if (shouldBlockTabSwipe(event.target)) {
    tabTouchState.blocked = true;
    return;
  }
  const touch = event.touches[0];
  tabTouchState.startX = touch.clientX;
  tabTouchState.startY = touch.clientY;
  tabTouchState.tracking = true;
};

const handleTabTouchMove = (event) => {
  if (!tabTouchState.tracking || tabTouchState.blocked || event.touches.length !== 1) {
    return;
  }
  const touch = event.touches[0];
  tabTouchState.deltaX = touch.clientX - tabTouchState.startX;
  tabTouchState.deltaY = touch.clientY - tabTouchState.startY;
};

const handleTabTouchEnd = () => {
  if (!tabTouchState.tracking || tabTouchState.blocked) {
    resetTabTouchState();
    return;
  }

  const absX = Math.abs(tabTouchState.deltaX);
  const absY = Math.abs(tabTouchState.deltaY);
  const horizontalRatio = absX / Math.max(absY, 1);
  const isTabSwipe =
    absX >= MOBILE_TAB_SWIPE_MIN_DISTANCE &&
    absY <= MOBILE_TAB_MAX_VERTICAL_DRIFT &&
    horizontalRatio >= MOBILE_TAB_HORIZONTAL_RATIO;

  if (isTabSwipe) {
    moveTabByOffset(tabTouchState.deltaX < 0 ? 1 : -1);
  }
  resetTabTouchState();
};

const getRangeConfig = () => klineRangeMap[klineState.range] || klineRanges[1];

const normalizeHistory = (rows) =>
  (rows || [])
    .map((item) => {
      const timestamp = Date.parse(item.fetchedAt);
      const price = Number(item.price);
      if (!Number.isFinite(timestamp) || !Number.isFinite(price)) {
        return null;
      }
      return {
        timestamp,
        price,
        symbol: item.symbol || '-',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

const buildCandles = (points, startMs, bucketMinutes) => {
  if (!points.length) {
    return [];
  }
  const bucketMs = bucketMinutes * 60 * 1000;
  const groups = new Map();

  points.forEach((point) => {
    const offset = Math.floor((point.timestamp - startMs) / bucketMs);
    if (offset < 0) {
      return;
    }
    if (!groups.has(offset)) {
      groups.set(offset, []);
    }
    groups.get(offset).push(point);
  });

  const offsets = [...groups.keys()].sort((a, b) => a - b);
  if (!offsets.length) {
    return [];
  }

  const firstOffset = offsets[0];
  const lastOffset = offsets[offsets.length - 1];
  const candles = [];
  let previousClose = null;

  for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
    const group = groups.get(offset);
    if (group && group.length) {
      const sorted = group.sort((a, b) => a.timestamp - b.timestamp);
      const prices = sorted.map((item) => item.price);
      const candle = {
        time: startMs + offset * bucketMs,
        open: prices[0],
        close: prices[prices.length - 1],
        high: Math.max(...prices),
        low: Math.min(...prices),
      };
      candles.push(candle);
      previousClose = candle.close;
      continue;
    }

    if (previousClose == null) {
      continue;
    }

    candles.push({
      time: startMs + offset * bucketMs,
      open: previousClose,
      close: previousClose,
      high: previousClose,
      low: previousClose,
    });
  }

  return candles;
};

const applyKlineWindow = () => {
  if (!klineState.rawData.length) {
    klineState.windowData = [];
    klineState.candles = [];
    klineState.latestPrice = '-';
    klineState.latestSymbol = '-';
    klineState.latestTime = '-';
    return;
  }

  const config = getRangeConfig();
  const latestTimestamp = klineState.rawData[klineState.rawData.length - 1].timestamp;
  const windowStart = latestTimestamp - config.minutes * 60 * 1000;
  const windowData = klineState.rawData.filter((point) => point.timestamp >= windowStart);

  klineState.windowData = windowData;
  klineState.candles = buildCandles(windowData, windowStart, config.bucketMinutes);

  const latest = windowData[windowData.length - 1];
  if (latest) {
    klineState.latestPrice = formatPrice(latest.price);
    klineState.latestSymbol = latest.symbol;
    klineState.latestTime = formatDateTimeValue(latest.timestamp);
  } else {
    klineState.latestPrice = '-';
    klineState.latestSymbol = '-';
    klineState.latestTime = '-';
  }
};

const handleFetchPrice = async ({ silent = false } = {}) => {
  priceState.loading = true;
  try {
    const { data } = await fetchPrice();
    priceState.result = data;
    if (!silent) {
      ElMessage.success('价格已更新');
    }
  } catch (error) {
    showErrorMessage('抓取失败', error);
  } finally {
    priceState.loading = false;
  }
};

const handleFetchKline = async ({ silent = false } = {}) => {
  klineState.loading = true;
  try {
    const config = getRangeConfig();
    const { data } = await fetchHistory(config.length);
    klineState.rawData = normalizeHistory(data);
    applyKlineWindow();
    if (!silent) {
      ElMessage.success('K 线数据已更新');
    }
  } catch (error) {
    showErrorMessage('加载失败', error);
  } finally {
    klineState.loading = false;
  }
};

const handleRangeChange = () => {
  applyKlineWindow();
  void handleFetchKline({ silent: true });
};

const handleGetThreshold = async ({ silent = false } = {}) => {
  thresholdState.loading = true;
  try {
    const { data } = await getThreshold();
    thresholdState.info = data;
    thresholdState.value = data?.threshold == null ? '' : formatThreshold(data.threshold);
  } catch (error) {
    if (!silent) {
      showErrorMessage('读取失败', error);
    }
  } finally {
    thresholdState.loading = false;
  }
};

const normalizeThresholdForSubmit = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized || !NON_NEGATIVE_NUMBER_PATTERN.test(normalized)) {
    return '';
  }

  const [integerPartRaw = '0', decimalPartRaw = ''] = normalized.split('.');
  const integerPart = integerPartRaw === '' ? '0' : String(Number.parseInt(integerPartRaw, 10));
  const decimalPart = `${decimalPartRaw}00`.slice(0, 2);
  return `${integerPart}.${decimalPart}`;
};

const handleSetThreshold = async () => {
  const thresholdValue = String(thresholdState.value ?? '').trim();
  if (!thresholdValue) {
    ElMessage.warning('请先输入阈值');
    return;
  }
  if (!NON_NEGATIVE_NUMBER_PATTERN.test(thresholdValue) || Number(thresholdValue) < 0) {
    ElMessage.warning('请输入非负数字，例如 35、35.1 或 35.12');
    return;
  }

  const normalizedThreshold = normalizeThresholdForSubmit(thresholdValue);
  thresholdState.saving = true;
  try {
    const { data } = await setThreshold(normalizedThreshold);
    thresholdState.info = data;
    thresholdState.value = normalizedThreshold;
    ElMessage.success('阈值已更新');
  } catch (error) {
    showErrorMessage('保存失败', error);
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
    showErrorMessage('清空失败', error);
  } finally {
    thresholdState.clearing = false;
  }
};

const handleFetchAlerts = async ({ silent = false } = {}) => {
  alertState.loading = true;
  try {
    const selectedLevels = alertState.query.alertLevels || [];
    if (!selectedLevels.length) {
      alertState.records = [];
      alertState.total = 0;
      return;
    }
    const { data } = await fetchAlertList(alertState.query);
    alertState.records = data.records || [];
    alertState.total = Number(data.total || 0);
  } catch (error) {
    if (!silent) {
      showErrorMessage('查询失败', error);
    }
  } finally {
    alertState.loading = false;
  }
};

const isAlertLevelSelected = (level) => alertState.query.alertLevels.includes(level);

const toggleAlertLevel = (level) => {
  const selected = alertState.query.alertLevels;
  const nextSelected = selected.includes(level)
    ? selected.filter((item) => item !== level)
    : [...selected, level];

  alertState.query.alertLevels = alertLevels.filter((item) => nextSelected.includes(item));
  alertState.query.pageNum = 1;
  handleFetchAlerts();
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

const normalizeAlertLevelName = (value) => String(value || '').trim().toUpperCase();

const formatAlertThreshold = (value) => {
  const threshold = Number(value);
  if (!Number.isFinite(threshold)) {
    return '-';
  }
  return threshold.toFixed(2);
};

const normalizeAlertThresholdForSubmit = (value) => Number(String(value || '').trim()).toFixed(2);

const resetAlertLevelForm = () => {
  alertLevelState.form.levelName = '';
  alertLevelState.form.thresholdPercent = '';
  alertLevelState.form.windowMinutes = 0;
  alertLevelState.form.cooldownMinutes = 0;
  alertLevelFormRef.value?.clearValidate();
};

const handleFetchAlertLevels = async ({ silent = false } = {}) => {
  alertLevelState.loading = true;
  try {
    const { data } = await fetchAlertLevels();
    alertLevelState.records = data.records || [];
    alertLevelState.total = Number(data.total || alertLevelState.records.length || 0);
  } catch (error) {
    if (!silent) {
      showErrorMessage('查询失败', error);
    }
  } finally {
    alertLevelState.loading = false;
  }
};

const handleOpenAlertLevelCreateDialog = () => {
  alertLevelState.mode = 'create';
  alertLevelState.dialogVisible = true;
  resetAlertLevelForm();
};

const handleOpenAlertLevelEditDialog = async (levelName) => {
  alertLevelState.submitting = true;
  try {
    const { data } = await getAlertLevel(levelName);
    const record = data.record || {};
    alertLevelState.mode = 'edit';
    alertLevelState.form.levelName = normalizeAlertLevelName(record.levelName || levelName);
    alertLevelState.form.thresholdPercent = formatAlertThreshold(record.thresholdPercent);
    alertLevelState.form.windowMinutes = Number(record.windowMinutes || 0);
    alertLevelState.form.cooldownMinutes = Number(record.cooldownMinutes || 0);
    alertLevelState.dialogVisible = true;
    alertLevelFormRef.value?.clearValidate();
  } catch (error) {
    showErrorMessage('读取失败', error);
  } finally {
    alertLevelState.submitting = false;
  }
};

const handleSubmitAlertLevel = async () => {
  const formEl = alertLevelFormRef.value;
  if (!formEl) {
    return;
  }
  try {
    await formEl.validate();
  } catch {
    return;
  }

  alertLevelState.submitting = true;
  const levelName = normalizeAlertLevelName(alertLevelState.form.levelName);
  const payload = {
    thresholdPercent: normalizeAlertThresholdForSubmit(alertLevelState.form.thresholdPercent),
    window: Number(alertLevelState.form.windowMinutes),
    cooldown: Number(alertLevelState.form.cooldownMinutes),
  };

  try {
    if (alertLevelState.mode === 'create') {
      await createAlertLevel({
        levelName,
        ...payload,
      });
      ElMessage.success('报警等级已创建');
    } else {
      await updateAlertLevel(levelName, payload);
      ElMessage.success('报警等级已更新');
    }
    alertLevelState.dialogVisible = false;
    resetAlertLevelForm();
    await handleFetchAlertLevels({ silent: true });
  } catch (error) {
    showErrorMessage('保存失败', error);
  } finally {
    alertLevelState.submitting = false;
  }
};

const handleDeleteAlertLevel = async (row) => {
  if (row.protectedLevel) {
    ElMessage.warning('系统内置等级不允许删除');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认删除报警等级 ${row.levelName} 吗？`,
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

  alertLevelState.loading = true;
  try {
    await deleteAlertLevel(row.levelName);
    ElMessage.success('报警等级已删除');
    await handleFetchAlertLevels({ silent: true });
  } catch (error) {
    showErrorMessage('删除失败', error);
  } finally {
    alertLevelState.loading = false;
  }
};

const handleSendEmail = async () => {
  emailState.loading = true;
  try {
    const { data } = await sendTestEmail();
    emailState.message = data;
    ElMessage.success('测试邮件已触发');
  } catch (error) {
    showErrorMessage('发送失败', error);
  } finally {
    emailState.loading = false;
  }
};

const resetRecipientForm = () => {
  recipientState.form.id = null;
  recipientState.form.email = '';
  recipientState.form.enabled = true;
  recipientFormRef.value?.clearValidate();
};

const handleFetchRecipients = async ({ silent = false } = {}) => {
  recipientState.loading = true;
  try {
    const { data } = await fetchMailRecipients();
    recipientState.records = data.records || [];
    recipientState.total = Number(data.total || recipientState.records.length || 0);
  } catch (error) {
    if (!silent) {
      showErrorMessage('查询失败', error);
    }
  } finally {
    recipientState.loading = false;
  }
};

const handleOpenRecipientCreateDialog = () => {
  recipientState.mode = 'create';
  recipientState.dialogVisible = true;
  resetRecipientForm();
};

const handleOpenRecipientEditDialog = async (id) => {
  recipientState.submitting = true;
  try {
    const { data } = await getMailRecipient(id);
    const record = data.record || {};
    recipientState.mode = 'edit';
    recipientState.form.id = record.id || id;
    recipientState.form.email = record.email || '';
    recipientState.form.enabled = Boolean(record.enabled);
    recipientState.dialogVisible = true;
    recipientFormRef.value?.clearValidate();
  } catch (error) {
    showErrorMessage('读取失败', error);
  } finally {
    recipientState.submitting = false;
  }
};

const normalizeRecipientEmail = (value) => String(value || '').trim().toLowerCase();

const handleSubmitRecipient = async () => {
  const formEl = recipientFormRef.value;
  if (!formEl) {
    return;
  }
  try {
    await formEl.validate();
  } catch {
    return;
  }

  recipientState.submitting = true;
  const payload = {
    email: normalizeRecipientEmail(recipientState.form.email),
    enabled: Boolean(recipientState.form.enabled),
  };

  try {
    if (recipientState.mode === 'create') {
      await createMailRecipient(payload);
      ElMessage.success('收件人已创建');
    } else {
      await updateMailRecipient(recipientState.form.id, payload);
      ElMessage.success('收件人已更新');
    }
    recipientState.dialogVisible = false;
    resetRecipientForm();
    await handleFetchRecipients({ silent: true });
  } catch (error) {
    showErrorMessage('保存失败', error);
  } finally {
    recipientState.submitting = false;
  }
};

const handleDeleteRecipient = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确认删除收件人 ${row.email} 吗？`,
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

  recipientState.loading = true;
  try {
    await deleteMailRecipient(row.id);
    ElMessage.success('收件人已删除');
    await handleFetchRecipients({ silent: true });
  } catch (error) {
    showErrorMessage('删除失败', error);
  } finally {
    recipientState.loading = false;
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

const showErrorMessage = (title, error) => {
  if (isAuthErrorNotified(error)) {
    return;
  }
  ElMessage.error(`${title}：${resolveError(error)}`);
};

const formatKlineXAxisTime = (value) => {
  const normalized = String(value ?? '').trim();
  let timestamp = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(timestamp) && /^\d+$/.test(normalized)) {
    timestamp = Number(normalized);
    if (Math.abs(timestamp) < 1e12) {
      timestamp *= 1000;
    }
  }
  if (!Number.isFinite(timestamp)) {
    timestamp = Date.parse(normalized);
  }
  if (!Number.isFinite(timestamp)) {
    return '-';
  }
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const formatPrice = (value) => {
  const price = Number(value);
  if (!Number.isFinite(price)) {
    return '-';
  }
  return price.toFixed(2);
};

const formatThreshold = (value) => formatPrice(value);

let klineChart = null;
let klineResizeObserver = null;

const disposeKlineChart = () => {
  if (!klineChart) {
    return;
  }
  klineChart.dispose();
  klineChart = null;
};

const resizeKlineChart = () => {
  if (!klineChart) {
    return;
  }
  klineChart.resize();
};

const ensureKlineChart = () => {
  const target = klineChartRef.value;
  if (!target) {
    return null;
  }
  if (klineChart && klineChart.getDom() !== target) {
    disposeKlineChart();
  }
  if (!klineChart) {
    klineChart = echarts.init(target);
  }
  return klineChart;
};

const getKlineChartOption = () => {
  const candles = klineState.candles;
  const latest = candles[candles.length - 1];
  const categoryData = candles.map((item) => item.time);
  const candlestickData = candles.map((item) => [item.open, item.close, item.low, item.high]);
  const closeLineData = candles.map((item) => item.close);
  const axisLabelInterval =
    candles.length <= 8 ? 0 : Math.max(0, Math.ceil(candles.length / (isPhoneViewport.value ? 4 : 7)) - 1);
  const zoomStart = candles.length > 24 ? Math.max(0, Math.round(((candles.length - 24) / candles.length) * 100)) : 0;

  return {
    animationDuration: 380,
    animationDurationUpdate: 220,
    grid: isPhoneViewport.value
      ? { left: 54, right: 16, top: 28, bottom: 70 }
      : { left: 66, right: 24, top: 28, bottom: 74 },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#243249',
        },
      },
      backgroundColor: 'rgba(9, 15, 28, 0.94)',
      borderColor: '#334155',
      textStyle: {
        color: '#e2e8f0',
      },
      formatter: (params) => {
        const seriesParams = Array.isArray(params) ? params : [params];
        const candleParam = seriesParams.find((item) => item.seriesType === 'candlestick') || seriesParams[0];
        if (!candleParam || !Array.isArray(candleParam.data)) {
          return '';
        }
        const [open, close, low, high] = candleParam.data;
        const change = open === 0 ? 0 : ((close - open) / open) * 100;
        return [
          `<div>${formatDateTimeValue(candleParam.axisValue)}</div>`,
          `<div>开盘：${formatPrice(open)}</div>`,
          `<div>收盘：${formatPrice(close)}</div>`,
          `<div>最高：${formatPrice(high)}</div>`,
          `<div>最低：${formatPrice(low)}</div>`,
          `<div>涨跌：${change >= 0 ? '+' : ''}${change.toFixed(2)}%</div>`,
        ].join('');
      },
    },
    xAxis: {
      type: 'category',
      data: categoryData,
      boundaryGap: true,
      axisLine: {
        lineStyle: {
          color: '#475569',
        },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#94a3b8',
        interval: axisLabelInterval,
        formatter: (value) => formatKlineXAxisTime(value),
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      scale: true,
      splitNumber: 5,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#94a3b8',
        formatter: (value) => formatPrice(value),
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(71, 85, 105, 0.35)',
        },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        zoomLock: candles.length <= 12,
        moveOnMouseMove: true,
      },
      {
        type: 'slider',
        height: 22,
        bottom: 16,
        borderColor: 'rgba(71, 85, 105, 0.5)',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        fillerColor: 'rgba(212, 175, 55, 0.18)',
        handleStyle: {
          color: '#d4af37',
          borderColor: '#f8d568',
        },
        textStyle: {
          color: '#94a3b8',
        },
        labelFormatter: (value) => formatKlineXAxisTime(value),
        start: zoomStart,
        end: 100,
      },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: candlestickData,
        barMaxWidth: isPhoneViewport.value ? 14 : 18,
        itemStyle: {
          color: '#22c55e',
          color0: '#ef4444',
          borderColor: '#22c55e',
          borderColor0: '#ef4444',
        },
        markLine: latest
          ? {
              symbol: ['none', 'none'],
              lineStyle: {
                color: '#f8d568',
                type: 'dashed',
                width: 1,
                opacity: 0.8,
              },
              label: {
                color: '#f8fafc',
                backgroundColor: 'rgba(30, 41, 59, 0.95)',
                padding: [4, 6],
                borderRadius: 4,
                formatter: ({ value }) => `最新 ${formatPrice(value)}`,
              },
              data: [{ yAxis: latest.close }],
            }
          : undefined,
      },
      {
        name: '收盘趋势',
        type: 'line',
        data: closeLineData,
        symbol: 'none',
        smooth: 0.18,
        lineStyle: {
          color: 'rgba(250, 204, 21, 0.55)',
          width: 1,
        },
        emphasis: {
          disabled: true,
        },
        silent: true,
      },
    ],
  };
};

const renderKlineChart = () => {
  if (!klineState.candles.length) {
    disposeKlineChart();
    return;
  }
  const chart = ensureKlineChart();
  if (!chart) {
    return;
  }
  chart.setOption(getKlineChartOption(), { notMerge: true });
  resizeKlineChart();
};

const updateViewportFlag = () => {
  if (typeof window === 'undefined') {
    return;
  }
  isPhoneViewport.value = window.innerWidth <= 430;
};

const initKlineResizeObserver = () => {
  if (typeof ResizeObserver === 'undefined' || !chartWrapperRef.value) {
    return;
  }
  klineResizeObserver = new ResizeObserver(() => {
    resizeKlineChart();
  });
  klineResizeObserver.observe(chartWrapperRef.value);
};

watch(
  [() => klineState.candles, () => isPhoneViewport.value],
  async () => {
    await nextTick();
    renderKlineChart();
  },
  { flush: 'post' },
);

onMounted(() => {
  updateViewportFlag();
  window.addEventListener('resize', updateViewportFlag);
  initKlineResizeObserver();
  Promise.allSettled([
    handleFetchPrice({ silent: true }),
    handleFetchKline({ silent: true }),
    handleGetThreshold({ silent: true }),
    handleFetchAlerts({ silent: true }),
    handleFetchAlertLevels({ silent: true }),
    handleFetchRecipients({ silent: true }),
  ]);
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('resize', updateViewportFlag);
  if (klineResizeObserver) {
    klineResizeObserver.disconnect();
    klineResizeObserver = null;
  }
  disposeKlineChart();
});
</script>

