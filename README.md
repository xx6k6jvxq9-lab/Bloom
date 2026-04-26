# Bloom

Bloom 是一个以“手机桌面容器 + AI 角色关系经营”为核心的 React + TypeScript 项目。它不是单一聊天页，而是把聊天、通讯录、动态、约会、情侣空间、音乐、论坛、钱包、监控、自定义和小游戏整合进一个可长期使用的 AI 手机里。

## 当前产品形态

- 手机桌面式首页，支持壁纸、图标、组件、导航栏和字体布局自定义
- AI 单聊与群聊，支持流式回复、消息操作、摘要与通话记录沉淀
- 通讯录、角色资料、备注名、角色核心人设/表达风格/边界包配置
- 动态系统，支持发布、评论、回复，以及聊天触发和自动触发
- 约会场景，支持沉浸式剧情内容生成与会话留存
- 情侣空间，支持按角色独立存储的关系空间、留言板、情书、共笔、小账本、情侣动态、纪念日、日历、心情印章、归档和心动胶囊机
- 主动内容能力，已在情侣空间中形成 `Auto / Draft / Confirm` 分层
- 本地持久化与资源持久化，保证聊天、关系内容和视觉资源可恢复

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `motion`
- `lucide-react`
- Express
- `@google/genai`
- OpenAI 兼容接口
- `better-sqlite3`（已安装，当前主持久化仍以浏览器本地存储为主）

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

参考 [`.env.example`](./.env.example) 创建本地环境文件。

当前项目支持两种 AI 配置方式：

- 通过环境变量提供 Gemini Key
- 在应用内的 API 中心维护 `provider / baseUrl / apiKey / model / temperature`

### 3. 启动开发环境

```bash
npm run dev
```

默认会启动 [`server.ts`](./server.ts)，它同时承担：

- Express 本地服务
- Vite 开发中间件
- 网易云音乐代理接口

默认地址：

- `http://localhost:3000`

## 常用命令

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Cloudflare 备用部署

如果你要把当前项目先作为 Cloudflare Pages 备用入口使用：

1. 在 Cloudflare Pages 里连接仓库
2. 构建命令填 `npm run build`
3. 输出目录填 `dist`
4. 如果只是先做联调或轻量备用，可以创建一个 KV namespace，并绑定成 `WECHAT_BRIDGE_KV`
5. 如果你准备承接更高并发，优先部署 `cloudflare/wechat-bridge-do` 这个 Durable Object Worker，再把 Pages 项目的 `WECHAT_BRIDGE_DO` 绑定到它

当前仓库已经补了 Pages Functions 版微信桥接接口，覆盖：

- `POST /api/wechat/bind-session`
- `GET /api/wechat/bind-session/by-character/:characterId`
- `GET /api/wechat/bind-session/:token`
- `POST /api/wechat/bind-session/:token/bind`
- `GET /api/wechat/binding/by-character/:characterId`
- `POST /api/wechat/binding/by-character/:characterId/disable`
- `GET /api/wechat/bindings`
- `POST /api/wechat/messages`
- `POST /api/wechat/clawbot/callback`
- `POST /api/wechat/messages/pull`

注意：

- 这套 Cloudflare 版微信桥接状态现在存到 KV，不再依赖本地 `.codex-wechat-bridge.json`
- KV 适合先做备用站联调，但不是强一致存储；后续如果你要把微信桥接做成正式主链路，更推荐迁到 D1 或 Durable Objects
- Pages 项目本身不能直接创建和部署 Durable Object；你需要先单独部署 [cloudflare/wechat-bridge-do/wrangler.toml](./cloudflare/wechat-bridge-do/wrangler.toml)，再在 Pages 项目里绑定 `WECHAT_BRIDGE_DO`

## 目录概览

```text
.
├─ src/                 前端主代码
├─ docs/                产品与架构文档
├─ app/                 保留目录
├─ server.ts            本地服务与代理入口
├─ package.json
└─ vite.config.ts
```

## 文档入口

- [产品介绍](./docs/product-introduction.md)
- [完整 PRD](./docs/full-ai-product-prd.md)
- [项目架构说明](./docs/project-architecture.md)
- [求职版项目介绍](./docs/job-product-introduction.md)
- [WeChat + OpenClaw Cloudflare Deploy](./docs/wechat-openclaw-cloudflare-deploy.md)

## 当前工程判断

这个仓库已经明显超出 demo 阶段，当前更接近“关系型 AI 手机”的可持续迭代版本：

- `src/App.tsx` 仍承担大量顶层装配
- 聊天会话、运行时、角色域、持久化、关系上下文、记忆层、动态编排、情侣空间主动内容链路已经拆出独立模块
- 情侣空间和主动内容是当前最有差异化、也最值得继续深化的产品主线
