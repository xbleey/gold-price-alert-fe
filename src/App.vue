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
          <div class="inline-actions">
            <el-radio-group
              v-model="klineState.range"
              class="kline-range-group"
              @change="handleRangeChange"
            >
              <el-radio-button v-for="item in klineRanges" :key="item.value" :label="item.value">
                {{ item.label }}
              </el-radio-button>
            </el-radio-group>
            <el-button type="primary" :loading="klineState.loading" @click="handleFetchKline">
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
        <div class="chart-wrapper">
          <svg
            v-if="chartModel"
            class="kline-svg"
            :viewBox="`0 0 ${chartModel.width} ${chartModel.height}`"
            preserveAspectRatio="xMidYMid meet"
          >
            <g>
              <line
                v-for="line in chartModel.gridLines"
                :key="line.y"
                class="chart-grid-line"
                :x1="chartModel.padding.left"
                :y1="line.y"
                :x2="chartModel.width - chartModel.padding.right"
                :y2="line.y"
              />
              <text
                v-for="line in chartModel.gridLines"
                :key="`label-${line.y}`"
                class="chart-y-label"
                :x="chartModel.padding.left - 8"
                :y="line.y + 4"
              >
                {{ line.label }}
              </text>
            </g>
            <g>
              <line
                v-for="bar in chartModel.bars"
                :key="`wick-${bar.time}`"
                class="chart-wick"
                :x1="bar.x"
                :y1="bar.wickTop"
                :x2="bar.x"
                :y2="bar.wickBottom"
              />
              <rect
                v-for="bar in chartModel.bars"
                :key="`body-${bar.time}`"
                class="chart-body"
                :x="bar.bodyX"
                :y="bar.bodyY"
                :width="bar.bodyWidth"
                :height="bar.bodyHeight"
                :fill="bar.color"
              />
            </g>
            <g>
              <text
                v-for="label in chartModel.xLabels"
                :key="label.time"
                class="chart-x-label"
                :x="label.x"
                :y="chartModel.height - 10"
              >
                {{ label.label }}
              </text>
            </g>
          </svg>
          <el-empty v-else description="当前时间窗口暂无可用历史数据" />
        </div>
      </el-card>

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
                {{ priceState.result?.fetchedAt || '-' }}
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
            <p class="threshold-value">{{ thresholdState.info?.threshold || '-' }}</p>
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
            <el-table :data="alertState.records" style="width: 100%">
              <el-table-column prop="alertLevel" label="等级" width="140" />
              <el-table-column prop="alertTimeBeijing" label="告警时间(北京)" min-width="200" />
              <el-table-column prop="alertTimeUtc" label="告警时间(UTC)" min-width="200" />
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  clearThreshold,
  fetchAlertList,
  fetchHistory,
  fetchPrice,
  getThreshold,
  sendTestEmail,
  setThreshold,
} from './api';

const activeTab = ref('price');
const alertLevels = ['INFO_LEVEL', 'MINOR_LEVEL', 'MODERATE_LEVEL', 'MAJOR_LEVEL', 'CRITICAL_LEVEL'];
const defaultAlertLevels = ['MAJOR_LEVEL', 'CRITICAL_LEVEL'];

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

const isPhoneViewport = ref(false);

const chartModel = computed(() => {
  if (!klineState.candles.length) {
    return null;
  }
  const width = isPhoneViewport.value ? 860 : 1100;
  const height = isPhoneViewport.value ? 520 : 430;
  const padding = isPhoneViewport.value
    ? { top: 20, right: 18, bottom: 36, left: 58 }
    : { top: 24, right: 24, bottom: 42, left: 66 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxPrice = Math.max(...klineState.candles.map((item) => item.high));
  const minPrice = Math.min(...klineState.candles.map((item) => item.low));
  const priceSpan = Math.max(maxPrice - minPrice, maxPrice * 0.002, 0.01);
  const slotWidth = innerWidth / Math.max(klineState.candles.length, 1);
  const bodyWidth = Math.max(5, Math.min(slotWidth * 0.56, 18));

  const toY = (price) => padding.top + ((maxPrice - price) / priceSpan) * innerHeight;
  const bars = klineState.candles.map((item, index) => {
    const x = padding.left + slotWidth * index + slotWidth / 2;
    const upper = Math.max(item.open, item.close);
    const lower = Math.min(item.open, item.close);
    const top = toY(upper);
    const bottom = toY(lower);
    return {
      time: item.time,
      x,
      wickTop: toY(item.high),
      wickBottom: toY(item.low),
      bodyX: x - bodyWidth / 2,
      bodyY: top,
      bodyWidth,
      bodyHeight: Math.max(bottom - top, 1),
      color: item.close >= item.open ? '#22c55e' : '#ef4444',
    };
  });

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = maxPrice - priceSpan * ratio;
    return {
      y: padding.top + innerHeight * ratio,
      label: formatPrice(value),
    };
  });

  const labelStep = Math.max(1, Math.ceil(klineState.candles.length / 6));
  const xLabels = bars
    .map((bar, index) => {
      if (index !== klineState.candles.length - 1 && index % labelStep !== 0) {
        return null;
      }
      return {
        time: bar.time,
        x: bar.x,
        label: formatTime(bar.time),
      };
    })
    .filter(Boolean);

  return {
    width,
    height,
    padding,
    bars,
    gridLines,
    xLabels,
  };
});

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
    klineState.latestTime = formatDateTime(latest.timestamp);
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
    ElMessage.error(`抓取失败：${resolveError(error)}`);
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
    ElMessage.error(`加载失败：${resolveError(error)}`);
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
  } catch (error) {
    if (!silent) {
      ElMessage.error(`读取失败：${resolveError(error)}`);
    }
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
      ElMessage.error(`查询失败：${resolveError(error)}`);
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

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

const formatPrice = (value) => {
  const price = Number(value);
  if (!Number.isFinite(price)) {
    return '-';
  }
  return price.toFixed(2);
};

const updateViewportFlag = () => {
  if (typeof window === 'undefined') {
    return;
  }
  isPhoneViewport.value = window.innerWidth <= 430;
};

onMounted(() => {
  updateViewportFlag();
  window.addEventListener('resize', updateViewportFlag);
  Promise.allSettled([
    handleFetchPrice({ silent: true }),
    handleFetchKline({ silent: true }),
    handleGetThreshold({ silent: true }),
    handleFetchAlerts({ silent: true }),
  ]);
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('resize', updateViewportFlag);
});
</script>
