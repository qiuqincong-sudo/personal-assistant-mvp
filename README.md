# 个人助理系统 MVP

这是一个最小可用版本：ChatGPT Actions 调用 Vercel 上的 Node.js + TypeScript API，长期事项存入飞书多维表，需要日期视图的事项同步到 Google Calendar。

我选择 Vercel 作为优先部署目标，因为这个 MVP 以 HTTP API 为主，不需要常驻进程；Vercel 对 TypeScript API Routes、环境变量、预览部署和 ChatGPT Actions 的 HTTPS 入口都比较直接。Cloudflare Worker 也可以做，但 Google service account 的 RSA 签名和 Node 生态在 Vercel 上更省心。

## 项目目录结构

```text
.
├── api/
│   ├── briefing/today.ts       # GET /api/briefing/today
│   ├── calendar/sync.ts        # POST /api/calendar/sync
│   ├── health.ts               # GET /api/health
│   └── items/
│       ├── index.ts            # GET/POST /api/items
│       └── [id].ts             # PATCH /api/items/{id}
├── public/openapi.yaml         # ChatGPT Actions OpenAPI Schema
├── src/
│   ├── config.ts               # 环境变量读取
│   ├── fieldMapping.ts         # 飞书字段映射
│   ├── localServer.ts          # 零依赖本地开发服务，复用 api handlers
│   ├── types.ts                # 事项、简报、枚举类型
│   └── lib/
│       ├── briefing.ts         # 今日简报聚合逻辑
│       ├── colors.ts           # 颜色规则
│       ├── dateTime.ts         # 时区和日期处理
│       ├── feishu.ts           # 飞书开放平台 API
│       ├── filters.ts          # 查询过滤
│       ├── googleCalendar.ts   # Google Calendar API
│       ├── http.ts             # API 鉴权、CORS、错误处理
│       ├── itemCleaning.ts     # 有效事项过滤，跳过飞书空白模板行
│       └── itemMapper.ts       # 飞书记录和内部字段互转
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.runtime.json
└── vercel.json
```

## 飞书字段映射配置

字段映射在 `src/fieldMapping.ts`。请在飞书多维表中创建同名字段：

| API 字段 | 飞书字段 | 建议字段类型 |
| --- | --- | --- |
| `title` | 标题 | 文本 |
| `category` | 分类 | 单选：工作 / 会议活动 / 自媒体 / 生活 / 健康 / 宠物 / 消费账单 / 长期项目 / 其他 |
| `type` | 类型 | 单选：任务 / 日程 / 提醒 / 长期项目 / 待确认 |
| `priority` | 优先级 | 单选：P0 / P1 / P2 / P3 |
| `status` | 状态 | 单选：未开始 / 进行中 / 待确认 / 等待反馈 / 已完成 / 已取消 |
| `receive_date` | 接收日期 | 日期 |
| `start_time` | 开始时间 | 日期，开启时间 |
| `end_time` | 结束时间 | 日期，开启时间 |
| `due_time` | 截止时间 | 日期，开启时间 |
| `location` | 地点 | 文本 |
| `counterpart` | 对接人 | 文本 |
| `department` | 对接部门 | 文本 |
| `deliverable` | 交付物 | 文本 |
| `next_action` | 下一步动作 | 文本 |
| `estimated_duration` | 预计耗时 | 文本 |
| `reminder_method` | 提醒方式 | 文本 |
| `sync_calendar` | 是否同步日历 | 复选框 |
| `calendar_event_id` | 日历事件ID | 文本 |
| `notes` | 备注 | 文本 |
| `raw_input` | 原始输入 | 文本 |

日期字段在 API 中使用 ISO 字符串，例如 `2026-07-02T14:30:00+08:00`；写入飞书时会转换为毫秒时间戳。

## Google Calendar 同步逻辑

`POST /api/calendar/sync` 接收飞书记录 ID：

```json
{ "item_id": "recxxxxxx" }
```

同步规则：

1. 先从飞书读取事项。
2. 如果事项已有 `calendar_event_id`，调用 Google Calendar 更新原事件。
3. 如果没有 `calendar_event_id`，创建新事件。
4. 创建或更新成功后，把 Google 事件 ID 回写到飞书的 `日历事件ID`，并把 `是否同步日历` 设为 true。
5. 如果事项没有 `start_time`，但有 `due_time`，会把截止时间作为 30 分钟提醒事件。
6. 如果没有 `end_time`，默认使用 `DEFAULT_EVENT_DURATION_MINUTES`，默认 60 分钟。

颜色规则：

| 规则 | 本系统颜色 | Google colorId |
| --- | --- | --- |
| P0 / 今天截止 | 红色 | 11 |
| 自媒体 / 内容创作 | 绿色 | 10 |
| 会议活动 / 文创 / 竞赛 / 设计方向 | 紫色 | 3 |
| 表格 / 报表 / 资料整理 | 灰色 | 8 |
| 普通生活事项 | 蓝色 | 9 |
| 消费 / 账单 / 还款提醒 | 黄色 | 5 |
| 健康 / 宠物事项 | 橙色 | 6 |

## OpenAPI Schema

Schema 文件在 `public/openapi.yaml`。部署到 Vercel 后可以用：

```text
https://你的域名.vercel.app/openapi.yaml
```

在 ChatGPT Actions 里导入该 Schema，并配置 Bearer Token，值为你的 `API_SHARED_SECRET`。

本地开发时也可以访问：

```text
http://localhost:3000/openapi.yaml
```

## 配置飞书

1. 在飞书开放平台创建企业自建应用。
2. 记录应用的 `App ID` 和 `App Secret`。
3. 在权限管理中开通多维表格记录读写相关权限，然后发布应用版本。
4. 新建一个多维表，按上面的字段表创建字段。
5. 把该应用添加到多维表的可访问范围，确保应用有读取和编辑权限。
6. 从多维表 URL 获取 `app_token` 和 `table_id`。常见 URL 形态是：

```text
https://xxx.feishu.cn/base/{app_token}?table={table_id}
```

## 配置 Google Calendar

1. 在 Google Cloud 创建项目。
2. 启用 Google Calendar API。
3. 创建 Service Account，并生成 JSON key。
4. 打开目标 Google Calendar 的设置，把日历分享给 Service Account 的 `client_email`，权限选择“Make changes to events”。
5. 环境变量中填写：
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_CALENDAR_ID`

个人主日历不建议直接用 `primary`；请在 Google Calendar 设置页复制具体 Calendar ID。

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

必填项：

```bash
API_SHARED_SECRET=replace-with-a-long-random-secret
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxx
FEISHU_BITABLE_APP_TOKEN=bascnxxxxxxxxxxxx
FEISHU_BITABLE_TABLE_ID=tblxxxxxxxxxxxx
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
APP_TIMEZONE=Asia/Shanghai
APP_TIMEZONE_OFFSET=+08:00
DEFAULT_EVENT_DURATION_MINUTES=60
BRIEFING_DUE_SOON_DAYS=3
```

所有密钥只从环境变量读取，代码中没有写死密钥。

## 本地测试步骤

安装依赖，`npm` 或 `pnpm` 都可以：

```bash
npm install
# 或
pnpm install
```

启动本地服务：

```bash
npm run dev
```

`npm run dev` 会先编译 TypeScript 到 `.local-build`，再启动一个本地开发服务。这个服务复用 `api/` 里的 Vercel handler，所以本地路径和部署路径保持一致，但不依赖本机安装 Vercel CLI。

如果你本机已经安装了 Vercel CLI，也可以用：

```bash
npm run dev:vercel
```

健康检查：

```bash
curl http://localhost:3000/api/health
```

新增事项：

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer $API_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI 劳动竞赛初赛",
    "category": "会议活动",
    "type": "日程",
    "priority": "P1",
    "status": "未开始",
    "start_time": "2026-07-02T14:30:00+08:00",
    "end_time": "2026-07-02T17:00:00+08:00",
    "location": "双鱼创新中心五楼多功能会议室",
    "notes": "未提供结束时间，先按17:00占位",
    "raw_input": "AI 劳动竞赛初赛 时间：2026年7月2日（星期四）下午14:30开始 地点：双鱼创新中心五楼多功能会议室"
  }'
```

查询未完成事项：

```bash
curl -H "Authorization: Bearer $API_SHARED_SECRET" \
  "http://localhost:3000/api/items?status=未完成"
```

同步到 Google Calendar，把 `recxxxxxx` 换成新增事项返回的 `item.id`：

```bash
curl -X POST http://localhost:3000/api/calendar/sync \
  -H "Authorization: Bearer $API_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "item_id": "recxxxxxx" }'
```

获取今日简报：

```bash
curl -H "Authorization: Bearer $API_SHARED_SECRET" \
  "http://localhost:3000/api/briefing/today"
```

测试指定日期：

```bash
curl -H "Authorization: Bearer $API_SHARED_SECRET" \
  "http://localhost:3000/api/briefing/today?date=2026-07-02"
```

## 部署到 Vercel 并接入 ChatGPT Actions

这个项目可以直接部署到 Vercel。线上部署使用根目录 `api/` 下的 Vercel Serverless Functions，本地的 `src/localServer.ts` 只用于 `npm run dev`，不会影响线上。

### 需要配置的环境变量

生产环境必填：

```text
API_SHARED_SECRET
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_BITABLE_APP_TOKEN
FEISHU_BITABLE_TABLE_ID
APP_TIMEZONE
APP_TIMEZONE_OFFSET
DEFAULT_EVENT_DURATION_MINUTES
BRIEFING_DUE_SOON_DAYS
```

Google Calendar 还没配置时可以先不填以下变量；这时 `POST /api/calendar/sync` 会返回明确的 `503` 配置缺失错误，其他接口不受影响：

```text
GOOGLE_CLIENT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_CALENDAR_ID
```

不要把 `API_SHARED_SECRET`、`FEISHU_APP_SECRET`、`GOOGLE_PRIVATE_KEY` 写进代码、提交到 Git，或发给不需要访问接口的人。

### Vercel 后台配置

1. 把项目推送到 GitHub。
2. 在 Vercel 新建项目，导入这个仓库。
3. Framework Preset 选择 `Other`；项目根目录保持仓库根目录。
4. 在 Project Settings -> Environment Variables 中逐项添加上面的环境变量。
5. Environment 选择 Production；如果要用 Preview 部署测试，也同时给 Preview 添加同样变量。
6. 部署。Vercel 会自动识别：
   - `api/health.ts` -> `/api/health`
   - `api/items/index.ts` -> `/api/items`
   - `api/items/[id].ts` -> `/api/items/{id}`
   - `api/briefing/today.ts` -> `/api/briefing/today`
   - `api/calendar/sync.ts` -> `/api/calendar/sync`
   - `public/openapi.yaml` -> `/openapi.yaml`

### 部署后测试接口

把下面的 `https://你的域名.vercel.app` 换成 Vercel 给你的域名：

```text
https://你的域名.vercel.app/api/health
```

最小测试：

```bash
export BASE_URL="https://你的域名.vercel.app"
export API_SHARED_SECRET="只在本机终端临时填入，不要提交"

curl -i "$BASE_URL/api/health"

curl -i "$BASE_URL/api/items" \
  -H "Authorization: Bearer $API_SHARED_SECRET"

curl -i "$BASE_URL/api/briefing/today" \
  -H "Authorization: Bearer $API_SHARED_SECRET"

curl -i "$BASE_URL/openapi.yaml"
```

写入测试：

```bash
curl -i -X POST "$BASE_URL/api/items" \
  -H "Authorization: Bearer $API_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "ChatGPT Actions 写入测试",
    "category": "生活",
    "type": "提醒",
    "priority": "P2",
    "status": "未开始",
    "notes": "部署后公网接口写入测试",
    "raw_input": "ChatGPT Actions 写入测试"
  }'
```

### 接入 ChatGPT Actions

1. 打开自定义 GPT 的 Actions 配置。
2. 导入 OpenAPI Schema：

```text
https://你的域名.vercel.app/openapi.yaml
```

3. Authentication 选择 API Key 或 Bearer Token 形式。
4. Header 使用：

```text
Authorization: Bearer 你的_API_SHARED_SECRET
```

5. 保存后，先让 ChatGPT 调用 `GET /api/health`，再测试 `POST /api/items` 写入飞书。

不要把 `API_SHARED_SECRET` 放进提示词正文；只放在 Actions 的鉴权配置里。

## 验收命令

### 本地验收

先启动本地服务：

```bash
npm install
npm run typecheck
npm run build:local
npm run dev
```

另开一个终端：

```bash
export BASE_URL="http://localhost:3000"
export API_SHARED_SECRET="填入你的本地 API_SHARED_SECRET"

curl -i "$BASE_URL/api/health"

curl -i "$BASE_URL/api/items" \
  -H "Authorization: Bearer $API_SHARED_SECRET"

curl -i "$BASE_URL/api/items?include_empty=true" \
  -H "Authorization: Bearer $API_SHARED_SECRET"

curl -i "$BASE_URL/api/briefing/today" \
  -H "Authorization: Bearer $API_SHARED_SECRET"

curl -i -X POST "$BASE_URL/api/items" \
  -H "Authorization: Bearer $API_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "本地验收测试事项",
    "category": "生活",
    "type": "提醒",
    "priority": "P2",
    "status": "未开始",
    "notes": "本地接口写入飞书测试",
    "raw_input": "本地验收测试事项"
  }'
```

### 线上部署后验收

```bash
export BASE_URL="https://你的域名.vercel.app"
export API_SHARED_SECRET="填入 Vercel Production 环境里的 API_SHARED_SECRET"

curl -i "$BASE_URL/api/health"

curl -i "$BASE_URL/api/items" \
  -H "Authorization: Bearer $API_SHARED_SECRET"

curl -i "$BASE_URL/api/briefing/today" \
  -H "Authorization: Bearer $API_SHARED_SECRET"

curl -i "$BASE_URL/openapi.yaml"

curl -i -X POST "$BASE_URL/api/items" \
  -H "Authorization: Bearer $API_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "线上验收测试事项",
    "category": "生活",
    "type": "提醒",
    "priority": "P2",
    "status": "未开始",
    "notes": "线上公网接口写入飞书测试",
    "raw_input": "线上验收测试事项"
  }'
```

## API 说明

### POST /api/items

新增事项到飞书多维表。`title` 必填；未传的字段会使用保守默认值：

```json
{
  "category": "其他",
  "type": "待确认",
  "priority": "P2",
  "status": "未开始",
  "sync_calendar": false
}
```

### GET /api/items

查询事项。支持：

```text
status, category, type, from, to, priority, keyword, include_empty
```

`status=未完成` 会排除 `已完成` 和 `已取消`。

默认情况下，接口会自动过滤飞书里的空白模板行、标题为空的记录、标题为 `(未命名事项)` 的记录，以及没有任何有效字段的空记录。调试时可以加 `include_empty=true` 返回这些空记录：

```bash
curl -H "Authorization: Bearer $API_SHARED_SECRET" \
  "http://localhost:3000/api/items?include_empty=true"
```

飞书模板导入后建议删除多余空白行；即使没有删除，接口也会默认过滤。

### PATCH /api/items/{id}

更新事项字段，例如：

```json
{
  "status": "进行中",
  "next_action": "确认参会材料",
  "notes": "已提醒对接人"
}
```

### POST /api/calendar/sync

创建或更新 Google Calendar 事件，并把事件 ID 回写飞书。

如果 Google Calendar 还没有配置，接口会返回 `503` 和缺失的 Google 环境变量名；这属于当前阶段的预期降级，不会影响飞书事项读写和今日简报。

### GET /api/briefing/today

只读取飞书事项池，不依赖 Google Calendar；即使 Google 环境变量还没配置，也可以返回今日简报。

今日简报同样只基于有效事项生成，会自动跳过飞书空白模板行和未命名记录。

返回：

- 今日时间线
- 今日 P0/P1 事项
- 临近截止事项
- 待确认事项
- 等待反馈事项
- 未同步日历但已有开始时间或截止时间的事项
- 缺少时间、地点、截止时间、提醒方式等关键信息的事项

响应结构：

```json
{
  "date": "2026-07-01",
  "today_timeline": [],
  "p0_p1_items": [],
  "due_soon_items": [],
  "pending_confirmation_items": [],
  "waiting_feedback_items": [],
  "unsynced_calendar_items": [],
  "needs_info_items": []
}
```

## 安全注意事项

1. `API_SHARED_SECRET` 要足够长，并只配置给 ChatGPT Actions。
2. 不要把 `.env.local`、Google key JSON、飞书 App Secret 提交到 Git。
3. Google Calendar 只给 Service Account 目标日历的编辑权限，不要给整个 Google Workspace 过大权限。
4. 飞书应用只开多维表所需权限，并只授权到这个任务池表。
5. 生产环境建议定期轮换 `API_SHARED_SECRET`、飞书 App Secret 和 Google service account key。
6. 目前 API 返回错误详情用于调试；正式使用时可以减少第三方错误原文暴露。

## 下一阶段可以扩展的功能

1. 增加 Vercel Cron：每天 8:30 自动生成简报，并推送到邮箱、飞书或 Slack。
2. 增加自然语言解析层：把用户原话解析成结构化事项，再调用 `POST /api/items`。
3. 增加冲突检测：同步日历前检查时间冲突，并返回建议时间。
4. 增加批量同步：按日期或筛选条件批量创建 Calendar 事件。
5. 增加飞书服务端筛选：事项很多时，不再全量读取后本地过滤。
6. 增加变更审计：记录 ChatGPT 更新了哪些字段，避免误改。
7. 增加确认流：低置信度事项先进入 `待确认`，确认后再同步日历。
8. 增加多日简报、周计划、长期项目里程碑视图。
