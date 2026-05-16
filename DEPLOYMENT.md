# WhisperJournal 部署說明（正式上線）

## 這個專案有被「簡化」嗎？

**沒有去掉業務功能。**  
先前為方便本機開發，在 `backend` 增加了 **`redis-memory-server`**（執行 `npm run start:dev` 時自動起記憶體 Redis，無須先開 Docker）。  
**上線環境請使用真實 Redis**（本文件的 Docker Compose 已內建 Redis 容器與持久化卷）。

---

## 架構（生產）

| 服務 | 說明 |
|------|------|
| **redis** | 資料與 Bull 佇列共用，資料放在 Docker volume `redis_data` |
| **api** | NestJS，對內埠 `4000`，僅 Docker 網路可訪問 |
| **web** | Nginx 提供前端靜態檔，並把 `/api/*` 反向代理到 **api** |

瀏覽器一律使用**同源**路徑 `/api/...`（與開發時 Vite 代理一致），無須改前端程式。

---

## 前置需求

- 已安裝 **Docker** 與 **Docker Compose**
- 伺服器或本機可開啟對外埠（預設 **8080**，見環境變數）

---

## 一步：準備環境變數

在專案**根目錄**：

```bash
copy deploy.env.example .env
```

（Linux/macOS：`cp deploy.env.example .env`）

編輯 `.env`，**務必修改**：

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

並視需要填 `GEMINI_API_KEY`、`WEATHER_API_KEY` 等。

---

## 二步：建置並啟動

在專案**根目錄**：

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

或使用 npm 腳本（同上效果）：

```bash
npm run docker:up
```

首次會建立映像並下載依賴，可能需要數分鐘。

---

## 三步：驗證

1. 開啟瀏覽器：`http://localhost:8080`（若改了 `WEB_PORT` 則改為對應埠號）。
2. 健康檢查（需略過 Nginx 時可對 API 容器除錯；一般使用者只看網頁即可）。

查看日誌：

```bash
docker compose -f docker-compose.prod.yml logs -f
```

或：`npm run docker:logs`

---

## 停止與移除容器

```bash
docker compose -f docker-compose.prod.yml down
```

資料仍在 volume `redis_data` 中；若要**清空 Redis 資料**：

```bash
docker compose -f docker-compose.prod.yml down -v
```

（慎用：會刪除持久化卷）

---

## HTTPS 與域名（正式對外）

目前 Compose 僅暴露 **HTTP（80 在 web 容器內）** 映射到主機 `WEB_PORT`。對外公開服務時建議：

1. 在雲主機前加 **Nginx / Caddy / Traefik**，申請 **Let’s Encrypt** 憑證，並將流量反代到 `127.0.0.1:8080`（或你所設埠）。
2. 或使用雲廠商負載均衡器的 HTTPS，後端仍連至此埠。

---

## 僅本機開發（不需 Docker 跑後端時）

1. 可先只起 Redis：`docker compose up -d`（僅 `redis` 服務之 `docker-compose.yml`）。
2. 或在 Windows 使用 **`npm run start:dev`**（後端腳本會啟用 **redis-memory-server**）。
3. 前端：`npm run dev`，或一次啟動：`npm run dev:stack`。

詳見專案根目錄 `package.json` 中的 `dev`、`dev:api`、`dev:stack`。

---

## 檔案一覽（部署相關）

| 檔案 | 用途 |
|------|------|
| `docker-compose.prod.yml` | 生產三件套：redis + api + web |
| `backend/Dockerfile` | 後端映像 |
| `Dockerfile.web` | 前端建置 + Nginx |
| `deploy/nginx.conf` | 反向代理 `/api` |
| `deploy.env.example` | 複製為 `.env` 的範本 |
