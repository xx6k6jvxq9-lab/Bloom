# Bloom 项目架构说明

本文档以当前仓库代码为准，描述的是“现状架构”，不是理想态设计。
目标读者是需要继续开发、维护、拆分或接手这个项目的人。

## 1. 项目定位

Bloom 是一个以“手机桌面壳 + AI 角色互动”为核心体验的 React + TypeScript 项目。
它不是单一聊天页，而是把聊天、通讯录、动态、约会、情侣空间、音乐、钱包、论坛、监控、桌面自定义和小游戏整合进统一手机容器中的关系型产品。

从架构角度看，当前项目处于一种典型的“过渡态”：

- 顶层入口和大量业务装配仍然集中在 `src/App.tsx`
- 但聊天、持久化、角色域、动态编排、情侣空间 AI 主链已经逐步拆出
- 代码已经明显脱离“单文件原型期”，但还没有进入“彻底领域化”的成熟阶段

理解这个项目最重要的一点是：
它不是普通的“页面集合”，而是一个围绕“关系持续存在”组织起来的前端应用壳。
很多模块看起来彼此独立，实际上会通过角色、聊天、记忆、视觉配置和持久化层彼此联动。

## 2. 技术栈与运行方式

### 2.1 前端技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `motion`
- `lucide-react`

### 2.2 服务与依赖

- Express
- `@google/genai`
- OpenAI 兼容接口调用
- `better-sqlite3`

当前要注意的是：

- `better-sqlite3` 已在依赖里，但现阶段主数据链仍以浏览器本地持久化为主
- AI 调用统一收口到前端服务层，不是每个模块各自直接请求 provider

### 2.3 运行入口

- [`package.json`](../package.json)
  - `npm run dev` -> `tsx server.ts`
  - `npm run build` -> `vite build`
  - `npm run preview` -> `vite preview`
  - `npm run lint` -> `tsc --noEmit`
- [`server.ts`](../server.ts)
  - 本地 Express 服务入口
  - 开发模式下挂载 Vite middleware
  - 生产模式下托管 `dist`
  - 提供音乐代理接口
- [`src/main.tsx`](../src/main.tsx)
  - React 挂载入口
- [`src/App.tsx`](../src/App.tsx)
  - 应用总装配入口

### 2.4 当前环境变量心智

项目当前并不是“只靠 `.env` 驱动所有 AI 配置”的架构。

- [`.env.example`](../.env.example) 主要给 Gemini 和部署环境预留变量
- 实际业务里还支持在应用内部维护 API 配置
- `runtimeClient` 会根据 active config 判断走 Gemini 还是 OpenAI 兼容接口

这意味着：

- 环境变量更像基础兜底
- 真正运行时使用哪套模型配置，更多由应用状态决定

## 3. 根目录结构

```text
Bloom/
├─ src/                前端主代码
├─ docs/               项目文档
├─ app/                保留目录，当前不是主架构核心
├─ dist/               构建产物
├─ server.ts           本地服务与代理入口
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
└─ metadata.json
```

### 3.1 根目录关键文件

- [`src/App.tsx`](../src/App.tsx)
  - 当前仍然是总装配中心
  - 管顶层页面切换、主要业务状态、弹层总线、大量模块衔接
- [`src/types.ts`](../src/types.ts)
  - 全局核心类型中心
- [`server.ts`](../server.ts)
  - 本地服务端入口
- [`src/main.tsx`](../src/main.tsx)
  - React 入口
- [`README.md`](../README.md)
  - 对外入口说明
- [`docs/product-introduction.md`](./product-introduction.md)
  - 产品向介绍
- [`docs/project-architecture.md`](./project-architecture.md)
  - 当前这份工程向文档

## 4. 总体分层

当前项目大体可以理解成六层：

1. 页面与 UI 层
2. 页面装配层
3. 业务运行时层
4. 服务层
5. 持久化层
6. 本地代理服务层

更具体一点：

- `components`
  - 更偏“看得见的页面和控件”
- `features`
  - 更偏“可复用的领域边界与运行时能力”
- `services`
  - 更偏“AI、规则、生成、编排”
- `persistence` 子域
  - 更偏“数据如何在本地保存、恢复和避免污染”
- `server.ts`
  - 更偏“开发时 BFF / 代理层”

这个分层并不是严格 DDD，也不是完全分离干净的 clean architecture。
它更像是从大型 `App.tsx` 中逐步长出来的“半领域化结构”。

## 5. `src/components` 层

`src/components` 负责页面、可视模块和面向 UI 的业务组件。

### 5.1 首页与手机桌面

- [`src/components/home/HomeScreen/Page.tsx`](../src/components/home/HomeScreen/Page.tsx)
  - 手机首页入口
  - 负责桌面图标、Dock、导航区、小组件与布局适配
- [`src/components/home/HomeScreen/layout.ts`](../src/components/home/HomeScreen/layout.ts)
  - 首页布局计算逻辑
- [`src/components/home/HomeScreen/HomeScreen.css`](../src/components/home/HomeScreen/HomeScreen.css)
  - 首页样式
- [`src/components/shared/DesktopWidgets.tsx`](../src/components/shared/DesktopWidgets.tsx)
  - 小组件渲染

这条线更偏“手机壳体验层”，不是业务核心，却决定了产品感。

### 5.2 主应用壳

- [`src/components/main/MainAppShell/Page.tsx`](../src/components/main/MainAppShell/Page.tsx)
  - 主应用壳
  - 承接聊天 / 通讯录 / 动态 / 我的四大主入口
- [`src/components/main/ContactsShell/Page.tsx`](../src/components/main/ContactsShell/Page.tsx)
  - 联系人、角色资料与通讯录组织
- [`src/components/main/NewFriendsPage.tsx`](../src/components/main/NewFriendsPage.tsx)
  - 新朋友页
- [`src/components/main/GroupChatManagerPage.tsx`](../src/components/main/GroupChatManagerPage.tsx)
  - 群聊管理
- [`src/components/main/MePage.tsx`](../src/components/main/MePage.tsx)
  - 我的页面，承担大量配置和数据入口

### 5.3 聊天相关 UI

- [`src/components/chat/ChatSettingsPanel.tsx`](../src/components/chat/ChatSettingsPanel.tsx)
  - 聊天设置
  - 角色资料、摘要、通话、部分 AI 配置相关入口
- [`src/components/chat/GameCard.tsx`](../src/components/chat/GameCard.tsx)
  - 聊天流中的游戏卡片

### 5.4 约会模块

- [`src/components/dating/DatingModal.tsx`](../src/components/dating/DatingModal.tsx)
  - 约会规划或恢复入口
- [`src/components/dating/DatingScene.tsx`](../src/components/dating/DatingScene.tsx)
  - 正式约会场景页
- [`src/components/dating/sessionUtils.ts`](../src/components/dating/sessionUtils.ts)
  - 约会 session 兼容与辅助逻辑

### 5.5 情侣空间 UI

情侣空间现在已经不是单页，而是一组页面族：

- [`src/components/couple-space/CoupleSpaceApp/Page.tsx`](../src/components/couple-space/CoupleSpaceApp/Page.tsx)
  - 情侣空间主页面
  - 当前承担入口切换、当前 partner 视图、手动触发与数据写回
- [`src/components/couple-space/PerceptionView.tsx`](../src/components/couple-space/PerceptionView.tsx)
  - 历史遗留视图，仍有兼容价值
- `calendar/*`
  - 日历、心情印章等关系时间内容
- `loveletters/*`
  - 情书展示与回复区
- `archive/*`
  - 归档中心
- `interaction/*`
  - 互动中心、回忆卷轴、心动胶囊等玩法区
- `settings/*`
  - 主动能力相关设置与检查卡片

### 5.6 其他业务页面

- [`src/components/media/MusicApp.tsx`](../src/components/media/MusicApp.tsx)
- [`src/components/wallet/WalletApp/Page.tsx`](../src/components/wallet/WalletApp/Page.tsx)
- [`src/components/social/ForumApp/Page.tsx`](../src/components/social/ForumApp/Page.tsx)
- [`src/components/monitor/MonitorApp/Page.tsx`](../src/components/monitor/MonitorApp/Page.tsx)
- [`src/components/monitor/PhoneInterface.tsx`](../src/components/monitor/PhoneInterface.tsx)
- [`src/components/customization/CustomizationApp/Page.tsx`](../src/components/customization/CustomizationApp/Page.tsx)
- [`src/components/games/GameCenter.tsx`](../src/components/games/GameCenter.tsx)

这些模块大多是“业务视图层”，真正的规则、存储和生成逻辑往下沉在 `features` 与 `services`。

## 6. `src/features` 层

`src/features` 是当前最值得关注的架构演进层，因为它承载的是“从大文件里拆出来的领域边界”。

### 6.1 `features/chat-session`

核心文件：

- [`src/features/chat-session/ChatSessionMount.tsx`](../src/features/chat-session/ChatSessionMount.tsx)
- [`src/features/chat-session/DirectChatSessionContainer.tsx`](../src/features/chat-session/DirectChatSessionContainer.tsx)
- [`src/features/chat-session/GroupChatSessionContainer.tsx`](../src/features/chat-session/GroupChatSessionContainer.tsx)
- [`src/features/chat-session/ChatSessionScreen.tsx`](../src/features/chat-session/ChatSessionScreen.tsx)
- [`src/features/chat-session/GroupChatSessionScreen.tsx`](../src/features/chat-session/GroupChatSessionScreen.tsx)
- [`src/features/chat-session/ChatSessionPersistenceBridge.tsx`](../src/features/chat-session/ChatSessionPersistenceBridge.tsx)

职责：

- 根据 `activeApp` 决定当前挂载直聊还是群聊会话
- 从 `selectedCharacterId / selectedGroupId` 找到当前目标
- 组装会话所需依赖并下发给 container
- 把会话层与持久化 bridge 串起来

`ChatSessionMount` 的意义是把“会话装配”从 `App.tsx` 中独立出来。
它本身不负责真正的生成逻辑，而是做“选谁、挂谁、把依赖传进去”。

### 6.2 `features/chat-runtime`

核心文件：

- [`src/features/chat-runtime/useDirectChatRuntime.ts`](../src/features/chat-runtime/useDirectChatRuntime.ts)
- [`src/features/chat-runtime/useGroupChatRuntime.ts`](../src/features/chat-runtime/useGroupChatRuntime.ts)
- [`src/features/chat-runtime/useSessionRuntimeCore.ts`](../src/features/chat-runtime/useSessionRuntimeCore.ts)
- [`src/features/chat-runtime/types.ts`](../src/features/chat-runtime/types.ts)

职责：

- 管理一轮消息生成是否在进行中
- 维护当前 generation id
- 防止旧请求覆盖新请求结果
- 统一运行时错误态
- 为直聊与群聊提供共享运行时内核

[`useSessionRuntimeCore.ts`](../src/features/chat-runtime/useSessionRuntimeCore.ts) 当前非常关键，因为它把“生成状态控制”收口成了一个可共享核心：

- `isLoading`
- `error`
- `activeGenerationIdRef`
- `runGeneration`

这条线是聊天链真正摆脱“页面直接调 AI”的关键一步。

### 6.3 `features/persistence`

这是当前项目最稳定的一层基础设施之一。

#### 基础文件

- [`src/features/persistence/browserDb.ts`](../src/features/persistence/browserDb.ts)
- [`src/features/persistence/localConfigStore.ts`](../src/features/persistence/localConfigStore.ts)
- [`src/features/persistence/storageKeys.ts`](../src/features/persistence/storageKeys.ts)
- [`src/features/persistence/persistentAssetService.ts`](../src/features/persistence/persistentAssetService.ts)
- [`src/features/persistence/persistentAssetRef.ts`](../src/features/persistence/persistentAssetRef.ts)
- [`src/features/persistence/objectUrlRegistry.ts`](../src/features/persistence/objectUrlRegistry.ts)
- [`src/features/persistence/sanitizeTransientAssetValue.ts`](../src/features/persistence/sanitizeTransientAssetValue.ts)
- [`src/features/persistence/useResolvedPersistentValue.ts`](../src/features/persistence/useResolvedPersistentValue.ts)

#### 业务 store / bridge

当前已经拆出对应存储域的模块：

- `charactersStore.ts`
- `visualSettingsStore.ts`
- `userProfileStore.ts`
- `momentsStore.ts`
- `forumDataStore.ts`
- `coupleSpaceStore.ts`
- `chatOrganizationStore.ts`
- `meDataStore.ts`
- `musicDataStore.ts`
- `walletDataStore.ts`
- `friendRequestsStore.ts`
- `callHistoryStore.ts`
- `datingRecordsStore.ts`
- `chatHistoryStore.ts`

以及对应的 `usePersisted*Bridge.ts`。

#### 这一层解决的问题

1. 不把所有业务数据都绑在同一个 `appData` 整包 localStorage 上
2. 避免首屏空值把已有本地数据覆盖掉
3. 让资源类字段和普通 JSON 字段分开处理
4. 给后续域拆分留出持久化边界

#### 资源持久化心智

资源类字段不是简单字符串。
当前这条链已经开始区分：

- 原始临时值
- 已持久化引用
- 页面可显示的最终 URL

这也是为什么会存在：

- `sanitizeTransientAssetValue`
- `persistentAssetRef`
- `useResolvedPersistentValue`

### 6.4 `features/character-domain`

核心文件：

- [`src/features/character-domain/useCharacterDirectory.ts`](../src/features/character-domain/useCharacterDirectory.ts)
- [`src/features/character-domain/characterMutations.ts`](../src/features/character-domain/characterMutations.ts)

职责：

- 建立角色读取边界
- 建立角色写入边界
- 减少页面直接散写 `characters`

[`characterMutations.ts`](../src/features/character-domain/characterMutations.ts) 当前是很明确的“统一 mutation 入口”：

- `replaceCharacters`
- `updateCharacterById`
- `patchCharacterById`
- `removeCharacterById`
- `upsertCharacter`

这一层虽然还很轻，但意义很大。
它代表项目已经开始从“页面直接 `map`/`filter` 角色数组”转向“角色写入由角色域表达”。

### 6.5 `features/couple-space-interactions`

这一层目前最突出的是 `heart-capsule-machine`。

包含内容：

- 页面
- 回合类型
- prompt
- 回复生成
- 历史记录
- 每日抽取逻辑

这一层说明情侣空间已经不再只是内容展示页，而是开始有自己独立的互动玩法域。

## 7. `src/services` 层

`services` 负责 AI 调用、业务规则、生成逻辑和流程编排。

### 7.1 `services/ai/runtimeClient`

核心文件：

- [`src/services/ai/runtimeClient.ts`](../src/services/ai/runtimeClient.ts)

职责：

- 判断当前 active config 走 Gemini 还是 OpenAI 兼容接口
- 校验 `apiKey / baseUrl / model`
- 提供 `generateTextWithConfig`
- 提供 `streamTextWithConfig`
- 清理 provider 可能泄露出的 `<think>` 内容

这层非常关键，因为它让上层业务不需要每个场景都知道 provider 细节。
上层更关心的是：

- 我要生成什么
- 用哪套配置
- 是一次性文本还是流式消息

### 7.2 Prompt 体系

主要位于：

- `services/ai/prompts/base`
- `services/ai/prompts/builders`
- `services/ai/prompts/scenarios`
- `services/ai/prompts/character`
- `services/ai/prompts/coupleSpace`

当前已明确拆分出的 prompt 场景包括：

- 普通聊天
- 群聊
- 摘要
- 动态生成
- 动态评论回复
- 约会
- 情侣空间多子场景

这意味着 Prompt 已经不再只是零散模板，而是逐步演进成“AI 行为规则层”。

### 7.3 `services/chat`

- [`src/services/chat/messageActions.ts`](../src/services/chat/messageActions.ts)

职责：

- 收藏
- 转发
- 引用
- 删除
- 分享
- 回复预览
- 聊天 header 状态和布局辅助

这层的价值在于把“消息操作规则”从 UI 组件里拿出来。

### 7.4 `services/moments`

核心文件：

- [`src/services/moments/triggers.ts`](../src/services/moments/triggers.ts)
- [`src/services/moments/generators.ts`](../src/services/moments/generators.ts)
- [`src/services/moments/orchestrator.ts`](../src/services/moments/orchestrator.ts)

当前分层非常清楚：

- `triggers`
  - 判断是否应触发
- `generators`
  - 生成动态文本或评论回复
- `orchestrator`
  - 串起触发与生成，并输出最终结果

[`orchestrator.ts`](../src/services/moments/orchestrator.ts) 当前可以理解为“动态系统的薄编排层”：

- 命令触发发布
- 自动触发发布
- chat reaction 生成
- 正式内容生成

### 7.5 `services/relationship-time`

负责纪念日、关系时间线、心情印章等偏关系时间维度的逻辑。

### 7.6 `services/couple-space`

负责情侣空间中偏业务辅助的部分，例如回忆条目模板与构造逻辑。

## 8. 情侣空间 AI 架构

这是当前项目里最复杂、也是最值得单独理解的一组结构。

### 8.1 数据层心智

核心文件：

- [`src/features/persistence/coupleSpaceStore.ts`](../src/features/persistence/coupleSpaceStore.ts)

当前情侣空间已经不是单空间对象，而是：

- `currentPartnerId`
- `spacesByPartnerId`

也就是“当前查看哪个 partner 的空间 + 所有 partner 的空间仓库”。

`coupleSpaceStore.ts` 当前承担的真实职责包括：

- 创建默认数据
- 创建默认 state
- 把旧版单空间数据迁移成 per-partner 结构
- 对单个 partner 的空间做 hydrate
- 根据当前 partner 投影出当前正在编辑的空间数据

这意味着它不仅是 store，还是兼容层和迁移层。

### 8.2 Prompt 与上下文层

核心目录：

- `services/ai/couple-space/context`
- `services/ai/couple-space/prompt`
- `services/ai/prompts/builders/*Couple*`

职责分工：

- `context`
  - 统一收口角色信息、关系上下文、最近聊天、最近情侣空间痕迹
- `builders`
  - 根据具体动作生成 prompt
- `promptService`
  - 负责挑选 builder 并调用 runtime

这条线的结果是：
页面不再直接承担 prompt 拼装。

### 8.3 主动能力静态决策链

主要位于：

- `services/ai/couple-space/initiative`

当前已经具备的链路大致是：

1. signal collector
2. normalized context
3. runner
4. scorer
5. selector
6. decision trace
7. trace serializer

这条链的意义不是立即执行，而是：

- 选出候选动作
- 给出为什么选它
- 给出后续执行应该怎么接

### 8.4 执行桥

主要位于：

- `services/ai/couple-space/execution`

当前已经具备：

- execution plan
- commit route
- execution bridge
- readiness
- execution request
- executor capability map
- draft / direct-write / confirm sink

这一层把“决策结果”往“可执行请求”推进了一步。

### 8.5 真实动作 helper

主要位于：

- `services/ai/couple-space/actions`

当前已覆盖的动作包括：

- `post_couple_daily`
- `post_message_board_entry`
- `write_love_letter`
- `write_co_note`
- `reply_message_board`
- `react_to_existing_post`
- `reply_daily_comment`
- `reply_love_letter`
- `create_ledger_entry`

### 8.6 产品入口

当前已经接入的入口包括：

- `runCoupleSpaceInitiativeManualCheck`
- `runCoupleSpaceInitiativeAutoCheck`
- `coupleSpaceInitiativeAutoCheckGate`

这表示情侣空间主动能力已经从“未来规划”变成“最小产品能力”。

## 9. 顶层状态与类型中心

### 9.1 类型中心

[`src/types.ts`](../src/types.ts) 仍然是全局核心类型中心。

当前最关键的类型包括：

- `Character`
- `ChatMessage`
- `ChatHistory`
- `VisualSettings`
- `AppSettings`
- `ApiConfig`
- `CallRecord`
- `DateSession`
- `WalletData`
- `ChatGroup`
- `CoupleSpaceData`
- `CoupleSpaceState`
- `CoupleSpaceInitiative*`

### 9.2 `App.tsx` 中的顶层业务数据

当前 `App.tsx` 内定义的 `AppData` 仍然管理大量核心数据：

- characters
- chatHistory
- userProfile
- masks
- favorites
- visualSettings
- groups
- moments
- worldBooks
- coupleSpace
- coupleSpaceState
- friendRequests
- chatGroups
- callHistory
- savedDates
- collectedDates
- musicData
- walletData

这说明项目虽然已经分层，但真正的“统一业务总线”仍然在顶层。

## 10. 关键主链路

### 10.1 应用启动链

1. `server.ts` 启动本地 Express + Vite 服务
2. `src/main.tsx` 挂载 React
3. `src/App.tsx` 初始化顶层状态和默认数据
4. 各类 persistence bridge 把本地存储 hydrate 回应用状态
5. 页面根据 `activeApp / selected*` 状态渲染对应模块

### 10.2 聊天主链

1. 用户进入聊天会话
2. `ChatSessionMount` 决定挂载直聊还是群聊
3. 对应 container 接收角色、群组、设置、历史、持久化写回函数
4. `useDirectChatRuntime` / `useGroupChatRuntime` 触发生成
5. `useSessionRuntimeCore` 统一控制 loading / error / generation id
6. prompt builder 组装输入
7. `runtimeClient` 发起请求
8. 结果写回 `chatHistory` 或群聊历史

### 10.3 动态主链

1. 聊天或页面触发动态相关行为
2. `triggers.ts` 判断是否应触发
3. `generators.ts` 生成内容或评论回复
4. `orchestrator.ts` 输出最终结果
5. 顶层状态写回动态数据

### 10.4 约会主链

1. 聊天入口触发约会
2. `DatingModal` 规划或恢复 session
3. `DatingScene` 承载正式场景
4. `buildDatingPrompt`
5. `runtimeClient`
6. 写回 `DateSession`

### 10.5 情侣空间主链

1. 页面进入情侣空间
2. 根据 `currentPartnerId` 获取当前 partner 的空间数据
3. 页面触发某个生成或回复动作
4. `createCoupleSpacePromptCommonInput`
5. `coupleSpacePromptService`
6. 某个 `buildCouple*Prompt`
7. `runtimeClient`
8. 写回当前 partner 的 `posts / loveLetters / messageBoard / coNotes / ...`

## 11. 本地持久化架构

### 11.1 分层心智

当前本地持久化不是一层简单的 `localStorage.setItem`，而是三层：

1. 配置/JSON 层
2. 资源层
3. bridge 层

### 11.2 JSON 层

由 `localConfigStore` 和各类 `*Store.ts` 负责：

- 存
- 读
- 删除
- 提供默认值

### 11.3 资源层

由 `browserDb`、`persistentAssetService`、`objectUrlRegistry` 负责：

- 把资源保存在浏览器数据库中
- 提供资源引用而不是直接散落原始 blob URL
- 在页面显示时再解析成可用地址

### 11.4 bridge 层

由 `usePersisted*Bridge.ts` 负责：

- 首屏 hydrate
- 后续自动保存
- 避免未初始化数据覆盖已有本地数据

## 12. 本地服务端架构

[`server.ts`](../server.ts) 当前的角色更接近“开发期本地 BFF”。

### 12.1 当前接口

- `GET /api/health`
- `GET /api/netease/song`
- `GET /api/netease/lyric`
- `GET /api/netease/song/detail`
- `GET /api/netease/playlist`

### 12.2 当前职责

- 提供健康检查
- 提供网易云音乐歌曲直链代理
- 提供歌词、歌曲详情、歌单详情代理
- 开发模式下托管 Vite middleware
- 生产模式下返回前端构建产物

### 12.3 当前边界

这个服务端目前不是完整业务后端。
它更偏：

- 本地开发承载层
- 第三方接口代理层
- 前端体验补充层

## 13. 当前架构特征

从当前仓库来看，最真实的结构特征是：

- 顶层 `App.tsx` 依然重，但已经不是唯一业务中心
- 聊天链是当前拆分最成熟的主链之一
- 持久化层已经具备比较稳定的基础设施价值
- 情侣空间是最近扩展最快、服务层最复杂的业务域
- 角色域已经开始建立统一读写边界，但仍未彻底完成
- 业务状态仍然存在“顶层集中 + 子域分流”并存的状态

## 14. 当前风险

### 14.1 `App.tsx` 过大

虽然很多链路已经拆出，但顶层仍承担：

- 大量状态
- 页面切换
- 模块编排
- 回调下发
- 弹层与容器协调

这仍然是最大的维护风险。

### 14.2 顶层状态过重

`AppData` 仍集中承载多类业务对象。
短期方便联动，长期会让：

- 修改影响面变大
- 回归成本变高
- 子域边界继续模糊

### 14.3 角色域仍在收口期

已经有读取与 mutation 入口，但距离完整角色域仍有距离，特别是资源字段与跨模块联动。

### 14.4 文档与命名历史包袱

当前仓库中仍能看到：

- 历史乱码痕迹
- 遗留命名
- 旧心智与新结构并存

## 15. 后续更合理的演进方向

1. 继续减少 `App.tsx` 的总装配复杂度
2. 继续把角色写入与资源联动收口到 `character-domain`
3. 继续把情侣空间产品入口与状态流收紧
4. 视聊天链复杂度决定是否再抽更高一层 shared runtime
5. 持续减少“单一顶层整包状态”的依赖

## 16. 目录树总览

下面这份目录树不是完整文件清单，而是为了帮助建立“目录职责心智”的工程视图。

```text
src/
├─ App.tsx
├─ main.tsx
├─ types.ts
├─ utils.ts
├─ index.css
├─ assets/
├─ components/
│  ├─ chat/
│  ├─ couple-space/
│  ├─ customization/
│  ├─ dating/
│  ├─ games/
│  ├─ home/
│  ├─ main/
│  ├─ media/
│  ├─ monitor/
│  ├─ shared/
│  ├─ social/
│  └─ wallet/
├─ features/
│  ├─ character-domain/
│  ├─ chat-runtime/
│  ├─ chat-session/
│  ├─ couple-space-interactions/
│  └─ persistence/
└─ services/
   ├─ ai/
   │  ├─ couple-space/
   │  └─ prompts/
   ├─ chat/
   ├─ couple-space/
   ├─ moments/
   └─ relationship-time/
```

### 16.1 目录职责速记

- `components`
  - 页面和 UI 表达
- `features`
  - 领域边界、会话装配、运行时、持久化
- `services`
  - 规则、生成、AI 调用、业务编排
- `types.ts`
  - 共享数据模型中心
- `App.tsx`
  - 当前总装配核心

### 16.2 新代码放哪里

这是后续维护很容易踩坑的地方。

- 如果是页面、按钮、卡片、列表、弹层：
  - 优先放 `components`
- 如果是某条业务链的状态控制、装配逻辑、bridge、domain helper：
  - 优先放 `features`
- 如果是 Prompt、AI 调用、候选选择、内容生成、统一动作 helper：
  - 优先放 `services`
- 如果只是因为“在 `App.tsx` 里顺手好写”：
  - 通常应该先停一下，判断是否真的该继续堆进顶层

## 17. 关键状态对象说明

这部分是为了帮助理解“现在到底有哪些状态是顶层的、哪些已经拆出去、哪些仍然耦合”。

### 17.1 顶层页面态

`App.tsx` 当前维护的高频页面态包括：

- `activeApp`
  - 当前打开的是首页、聊天、情侣空间、监控、论坛等哪个应用
- `activeTab`
  - 主壳中的 `chat / contacts / moments / me`
- `selectedCharacterId`
  - 当前选中的角色
- `selectedGroupId`
  - 当前选中的群聊
- `selectedForumPostId`
  - 当前正在查看的论坛帖子
- `statusBarVisible`
  - 状态栏显隐

这一层决定“用户现在在哪个页面、看谁、从哪返回”。

### 17.2 顶层业务态

`appData` 是当前最核心的业务对象聚合体。

它至少包含：

- `characters`
- `chatHistory`
- `userProfile`
- `masks`
- `favorites`
- `friendRequests`
- `chatGroups`
- `callHistory`
- `visualSettings`
- `groups`
- `moments`
- `worldBooks`
- `coupleSpace`
- `coupleSpaceState`
- `musicData`
- `walletData`
- `savedDates`
- `collectedDates`

这意味着：

- 大部分主业务都还会在顶层相遇
- 子域虽然拆出去了，但最终装配和联动依旧通过顶层完成

### 17.3 `settings`

`settings` 是另一类与 `appData` 并列的重要对象。

它承载的不是“用户内容数据”，而是运行时偏系统级的配置，例如：

- 当前可用模型配置列表
- 当前激活配置
- 一些 AI 行为相关设置

很多 AI 链路不会直接从 `.env` 读配置，而是从这里取 active config。

### 17.4 `VisualSettings`

`VisualSettings` 是当前非常重要、也比较重的一个对象。

它不仅仅是主题色，而是覆盖：

- 全局壁纸
- 桌面图标配置
- 小组件配置
- 顶部导航配置
- 桌面排布参数
- 聊天外观配置
- 动态卡片配置
- 全局 CSS

也就是说，视觉系统已经是“配置驱动 UI”的形态，不是几组简单样式变量。

### 17.5 `CoupleSpaceData` 与 `CoupleSpaceState`

这一组对象需要单独理解：

- `CoupleSpaceData`
  - 单个 partner 的空间内容
- `CoupleSpaceState`
  - 全部 partner 空间的容器状态

当前心智是：

- `currentPartnerId`
  - 当前正在查看谁
- `spacesByPartnerId`
  - 所有 partner 的空间仓库

这层很重要，因为它解释了为什么情侣空间现在能支持：

- 每个角色独立空间
- 旧数据向新结构迁移
- 页面按当前 partner 投影视图

### 17.6 `ChatHistory` 与 `ChatGroup[]`

聊天当前不是单一数组，而是两套结构并行：

- `chatHistory`
  - 直聊历史，通常按角色 id 分桶
- `chatGroups`
  - 群聊对象数组，每个群对象内部包含自己的 `history`

而持久化层又会把群聊历史抽成：

- `groupHistories: Record<string, ChatMessage[]>`

所以聊天链实际上有三层视角：

1. 顶层 UI 视角
2. 会话容器视角
3. 持久化标准化视角

## 18. 数据流与时序说明

这部分不是严格 UML，只是把当前真实数据流写清楚。

### 18.1 启动与 hydrate 时序

1. `server.ts` 启动开发服务
2. `main.tsx` 渲染 `App`
3. `App.tsx` 先以默认状态启动
4. 各类 `usePersisted*Bridge` 或 store 加载本地数据
5. hydrate 后回写到顶层状态
6. 页面重新渲染到真实本地状态

关键点：

- 默认值不是最终值
- 真正用户状态通常要等 bridge 完成 hydrate
- 这也是为什么 bridge 层需要避免“首帧空值覆盖已有数据”

### 18.2 聊天发送时序

1. 用户在聊天 UI 中输入内容
2. 会话 container 组装上下文
3. runtime hook 开始 `runGeneration`
4. prompt builder 生成 prompt
5. `runtimeClient` 发起请求
6. 流式内容逐步回写消息列表
7. 最终消息写回 `chatHistory` 或群历史
8. persistence bridge 观察到状态变化并保存

关键点：

- 运行时和持久化是分层的
- UI 不直接等同于存储
- `generationId` 用来避免并发覆盖

### 18.3 动态发布时序

1. 聊天或页面行为触发动态机会
2. `triggers.ts` 判断是否应发布
3. `generators.ts` 生成聊天反应或动态正文
4. `orchestrator.ts` 返回标准结果
5. 顶层状态更新 `moments`
6. 持久化层保存 moments

### 18.4 情侣空间生成时序

1. 页面进入当前 partner 的情侣空间
2. 用户触发某个动作，或系统执行 manual/auto check
3. 上下文层收集角色、关系、最近聊天、最近情侣空间痕迹
4. prompt builder 生成对应动作 prompt
5. `coupleSpacePromptService` 统一调用 `runtimeClient`
6. 结果进入对应 sink 或页面写回逻辑
7. 更新当前 partner 的空间数据
8. 最终由持久化层保存

### 18.5 聊天历史持久化时序

从 [`usePersistedChatHistoryBridge.ts`](../src/features/persistence/usePersistedChatHistoryBridge.ts) 可以看到，这条链是比较典型的“双阶段”：

1. 先加载本地持久化记录
2. 如果本地记录与当前内存不同，就先把本地记录 hydrate 回内存
3. 只有 hydrate 完成后，后续状态变更才允许写回

这说明当前持久化设计已经明确考虑了“首次装载覆盖”的问题。

## 19. 高风险改动点

这一节很实用，后面谁改代码都建议先看。

### 19.1 [`src/App.tsx`](../src/App.tsx)

这是当前最典型的高风险文件。

原因不是它“写得不好”，而是它承担的职责实在太多：

- 页面路由态
- 顶层业务态
- 默认数据
- 大量回调下发
- 业务模块拼装
- 弹层与容器协调

改这个文件时容易出现：

- 改一个入口影响多个模块
- 某个状态字段改名导致多个页面一起坏
- 局部需求顺手写进去后进一步加深耦合

### 19.2 [`src/types.ts`](../src/types.ts)

这个文件的改动面非常广。

风险点：

- 类型一改，会波及大量业务域
- 历史字段兼容问题容易被忽略
- 某些字段不仅用于 UI，还参与持久化和旧数据迁移

### 19.3 `features/persistence/*`

风险点：

- 改 store 结构容易影响已有本地数据
- 改 hydrate 行为可能导致老数据丢失或被清空
- 改资源字段处理可能引发图片/背景/头像显示异常

### 19.4 `coupleSpaceStore.ts`

这是情侣空间里极高风险的结构文件。

风险原因：

- 承担新旧结构兼容
- 承担 per-partner state 组织
- 牵涉情侣空间所有子模块

如果这里处理不慎，很容易出现：

- 当前 partner 丢失
- 旧数据读不出来
- 写回时串到错误 partner

### 19.5 `runtimeClient.ts`

这里是所有 AI 调用的共用入口之一。

风险点：

- provider 判断出错会影响多个功能域
- 错误处理方式变化会同时影响聊天、动态、约会、情侣空间
- 流式输出解析变更可能造成全局回归

## 20. 建议拆分路线图

这部分不是硬性计划，而是基于当前代码现实更合理的演进顺序。

### 20.1 第一阶段

目标：

- 继续减轻 `App.tsx`
- 不引入大范围回归

建议动作：

- 把顶层页面装配逻辑继续抽成更清晰的 mount / shell
- 把和某个业务域强绑定的回调继续从顶层下沉
- 保持状态 shape 不大改，优先做装配拆分

### 20.2 第二阶段

目标：

- 巩固领域边界

建议动作：

- 继续完善 `character-domain`
- 把角色资源类写入也逐步归口
- 减少业务页直接修改角色数组

### 20.3 第三阶段

目标：

- 把情侣空间从“复杂功能域”进一步整理成“稳定子系统”

建议动作：

- 继续统一 manual check / auto check / sink 的接入方式
- 继续减少页面层对内部执行细节的感知
- 明确哪些写回属于页面职责，哪些写回应由 service/execution 接管

### 20.4 第四阶段

目标：

- 再评估聊天链是否值得继续抽象

建议动作：

- 如果 direct/group runtime 的重复开始增加，再考虑更高一层 shared runtime
- 如果重复仍可控，就保持当前结构，不要为抽象而抽象

### 20.5 第五阶段

目标：

- 从“顶层大聚合状态”转向“领域化状态组织”

建议动作：

- 逐步减少 `appData` 的中心化程度
- 让更多业务域拥有自己的稳定边界和装配入口
- 保持迁移过程分阶段、可回归，不做一次性大重构

## 21. 建议阅读顺序

如果第一次接手项目，建议按下面顺序看：

1. [`src/types.ts`](../src/types.ts)
2. [`src/App.tsx`](../src/App.tsx)
3. [`src/components/main/MainAppShell/Page.tsx`](../src/components/main/MainAppShell/Page.tsx)
4. [`src/features/chat-session/ChatSessionMount.tsx`](../src/features/chat-session/ChatSessionMount.tsx)
5. [`src/features/chat-runtime/useSessionRuntimeCore.ts`](../src/features/chat-runtime/useSessionRuntimeCore.ts)
6. [`src/services/ai/runtimeClient.ts`](../src/services/ai/runtimeClient.ts)
7. [`src/services/ai/prompts/builders/buildChatPrompt.ts`](../src/services/ai/prompts/builders/buildChatPrompt.ts)
8. [`src/services/moments/orchestrator.ts`](../src/services/moments/orchestrator.ts)
9. [`src/features/persistence/coupleSpaceStore.ts`](../src/features/persistence/coupleSpaceStore.ts)
10. [`src/components/couple-space/CoupleSpaceApp/Page.tsx`](../src/components/couple-space/CoupleSpaceApp/Page.tsx)
11. [`src/services/ai/couple-space/prompt/coupleSpacePromptService.ts`](../src/services/ai/couple-space/prompt/coupleSpacePromptService.ts)

按这个顺序，可以最快建立以下认知：

- 顶层状态怎么组织
- 聊天会话怎么挂载、怎么运行
- AI 调用入口在哪里
- 动态系统怎么编排
- 情侣空间为什么会变成当前这种结构
- 持久化边界已经拆到了什么程度
