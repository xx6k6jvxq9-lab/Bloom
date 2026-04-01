# Bloom

Bloom 是一个以“手机桌面壳 + AI 角色互动”为核心体验的 React + TypeScript 项目。
它不是单一聊天页，而是把聊天、通讯录、动态、约会、情侣空间、音乐、钱包、论坛、监控、桌面自定义和小游戏整合进同一个手机式容器里，让角色、关系、记忆和生活痕迹持续沉淀。

## 核心能力

- AI 角色单聊与群聊
- 约会剧情与会话记录
- 动态发布、评论与自动生成
- 情侣空间、多角色关系沉淀与主动内容能力
- 音乐、钱包、论坛、监控、桌面个性化
- 浏览器本地持久化与资源存储

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `motion`
- `lucide-react`
- Express
- `@google/genai`

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

参考 [`.env.example`](./.env.example) 创建本地环境文件。

如果你使用 Gemini，可在本地环境中提供 `GEMINI_API_KEY`。
如果你使用 OpenAI 兼容接口，当前项目也支持在应用内部的 API 配置中填写 `baseUrl / apiKey / model`。

### 3. 启动开发环境

```bash
npm run dev
```

默认会启动 [server.ts](./server.ts)，它同时承担：

- Express 本地服务
- Vite 中间件开发服务器
- 网易云音乐代理接口

开发地址默认是 `http://localhost:3000`。

## 常用命令

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## 目录概览

```text
.
├─ src/        前端主代码
├─ docs/       项目文档
├─ app/        保留目录，当前不是主架构核心
├─ server.ts   本地服务与代理入口
└─ package.json
```

更详细的说明见：

- [产品介绍](./docs/product-introduction.md)
- [项目架构说明](./docs/project-architecture.md)

## 当前架构状态

当前项目已经从“所有逻辑集中在 `App.tsx`”演进到“顶层壳仍在 `App.tsx`，但聊天会话、运行时、持久化、角色域、情侣空间 AI 链路逐步独立”的阶段。

已经比较明确的模块边界包括：

- `src/features/chat-session`
- `src/features/chat-runtime`
- `src/features/persistence`
- `src/features/character-domain`
- `src/services/ai`
- `src/services/moments`

同时，`src/App.tsx` 依然承担大量顶层装配和状态编排职责，仍是后续继续拆分的重点。
