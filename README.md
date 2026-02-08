# 金价告警前端

该项目是金价告警系统的前端控制台，基于 Vite + Vue 3 + Element Plus 构建，用于可视化查询与操作后端接口。

## 功能概览
- 价格抓取与历史快照查询。
- 告警历史分页查询与等级筛选。
- 阈值读取、写入、清空。
- 健康探针与测试邮件触发。

## 环境配置
本地与生产使用不同的环境变量文件：

- `.env.development`：本地开发配置。
- `.env.production`：生产构建配置。

关键变量说明：

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE` | 后端 API 的路径前缀，默认 `/gold-price-alert/api` |
| `VITE_BASE_PATH` | 前端部署路径前缀，生产环境使用 `/gold-price-alert/` |
| `VITE_API_PROXY_TARGET` | 本地开发时的代理目标地址 |

> 如需调整后端地址，可在 `.env.development` 中修改 `VITE_API_PROXY_TARGET`。

## 本地启动

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5000
```

## 生产构建

```bash
npm install
npm run build
```
