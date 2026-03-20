# 项目架构说明

## 1. 项目定位

这是一个以“手机桌面壳 + AI 角色互动”为核心体验的 React + TypeScript 项目。
它不是单一聊天页，而是把聊天、通讯录、动态、约会、情侣空间、音乐、钱包、论坛、监控、桌面自定义等能力包装成一个统一的手机容器。

### 产品感受描述

如果只从“功能清单”理解这个项目，会低估它真正想传达的体验。
更贴近产品侧的描述是：它像一部住着角色、情绪和关系的手机。

- 你打开的不是一个普通聊天窗口，而是一个会亮起桌面、会切换页面、会沉淀回忆的陪伴式设备。
- 角色不只在聊天里回复你，还会出现在动态、约会、情侣空间、音乐、收藏和日常痕迹里。
- 用户感受到的不是“一个 AI 功能入口”，而是“一个被包装成生活容器的关系型产品”。
- 它带有一点恋爱模拟、一点陪伴产品、一点手机养成和一点互动世界的娱乐化气质。

从产品表达上，它更接近“可以游玩的 AI 关系空间”，而不只是“可配置的大模型聊天壳”。

当前架构已经从“`src/App.tsx` 承担一切”进入到“`App.tsx` 仍是顶层壳，但 persistence / chat-session / chat-runtime / character-domain 逐步独立”的形态：

- 页面层已经拆出大量独立组件和业务页。
- Prompt、AI 调用、动态生成、消息操作、浏览器持久化已经开始 feature / service 化。
- 顶层状态和页面切换仍然主要由 `src/App.tsx` 持有。
- 聊天主链已经不再直接内嵌在 `App.tsx` 中，而是拆成 mount / container / screen / runtime / runtime core。

这份文档以“当前真实代码结构”为准，不描述理想态。

---

## 2. 技术栈与运行入口

### 前端

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `motion/react` 用于页面和面板动效
- `lucide-react` 用于图标

### AI 与数据

- `@google/genai` 用于 Gemini 请求
- OpenAI 兼容接口通过 `fetch(baseUrl + /chat/completions)` 调用
- 当前主要数据仍保存在前端内存与本地持久化链路中

### 本地开发与服务端入口

- [package.json](/e:/小手机/Bloom/package.json)
  - `npm run dev` 实际启动的是 `tsx server.ts`
- [server.ts](/e:/小手机/Bloom/server.ts)
  - Express + Vite 中间层开发服务器
  - 提供 `/api/health`
  - 提供网易云音乐代理接口，如歌曲、歌词、歌单详情
- [src/main.tsx](/e:/小手机/Bloom/src/main.tsx)
  - React 挂载入口

### 当前结论

这个项目不是纯静态前端：

- 前端 UI 和大多数业务状态在 React 内完成。
- 本地开发时通过 `server.ts` 承担开发服务器与部分代理能力。

---

## 3. 根目录结构

### 根目录关键文件

- [README.md](/e:/小手机/Bloom/README.md)
  - 运行说明，当前也存在中文乱码问题
- [docs/project-architecture.md](/e:/小手机/Bloom/docs/project-architecture.md)
  - 当前这份架构说明
- [src/App.tsx](/e:/小手机/Bloom/src/App.tsx)
  - 顶层状态、页面切换、主聊天链路、应用内弹窗总线
- [src/types.ts](/e:/小手机/Bloom/src/types.ts)
  - 全局核心类型
- [src/utils.ts](/e:/小手机/Bloom/src/utils.ts)
  - 通用工具、图片提取、应用内对话框事件
- [src/index.css](/e:/小手机/Bloom/src/index.css)
  - 全局样式与手机容器约束
- [server.ts](/e:/小手机/Bloom/server.ts)
  - 本地服务端入口

### 主要目录

- [src/components](/e:/小手机/Bloom/src/components)
  - UI 页面与业务组件
- [src/services](/e:/小手机/Bloom/src/services)
  - AI、聊天消息操作、动态生成等服务层
- [src/features](/e:/小手机/Bloom/src/features)
  - 持久化、聊天域、角色域等 feature 分层
- [docs](/e:/小手机/Bloom/docs)
  - 项目文档与历史资料
- [app](/e:/小手机/Bloom/app)
  - 当前仓库中仅保留 `applet` 目录，暂未成为主架构的一部分

---

## 4. 目录分层

### 4.1 `src/components`

#### 首页与手机桌面

- [src/components/home/HomeScreen/Page.tsx](/e:/小手机/Bloom/src/components/home/HomeScreen/Page.tsx)
  - 手机首页桌面
  - 图标、Dock、顶部导航卡片、桌面分页、拖拽布局
  - 根据容器宽高推导 `sizeTier` 与高屏修正
- [src/components/home/HomeScreen/layout.ts](/e:/小手机/Bloom/src/components/home/HomeScreen/layout.ts)
  - 首页桌面布局算法
  - 输出 slot、dock、navbar、widget 布局指标
- [src/components/home/HomeScreen/HomeScreen.css](/e:/小手机/Bloom/src/components/home/HomeScreen/HomeScreen.css)
  - 首页样式
- [src/components/shared/DesktopWidgets.tsx](/e:/小手机/Bloom/src/components/shared/DesktopWidgets.tsx)
  - 桌面小组件渲染

#### 主应用壳

- [src/components/main/MainAppShell/Page.tsx](/e:/小手机/Bloom/src/components/main/MainAppShell/Page.tsx)
  - 主壳容器
  - `chat / contacts / moments / me` 四个 tab 的组织与切换
- [src/components/main/ContactsShell/Page.tsx](/e:/小手机/Bloom/src/components/main/ContactsShell/Page.tsx)
  - 通讯录、好友申请、群聊管理入口、联系人分组
- [src/components/main/NewFriendsPage.tsx](/e:/小手机/Bloom/src/components/main/NewFriendsPage.tsx)
  - 新朋友页
- [src/components/main/GroupChatManagerPage.tsx](/e:/小手机/Bloom/src/components/main/GroupChatManagerPage.tsx)
  - 群聊创建与解散管理
- [src/components/main/MePage.tsx](/e:/小手机/Bloom/src/components/main/MePage.tsx)
  - 我的页面
  - 角色、面具、收藏、数据管理、世界书管理等入口

#### 聊天相关

- [src/components/chat/ChatSettingsPanel.tsx](/e:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)
  - 聊天设置、角色资料、摘要生成、通话记录管理
- [src/components/chat/GameCard.tsx](/e:/小手机/Bloom/src/components/chat/GameCard.tsx)
  - 聊天流内游戏卡片，弹层挂载到手机容器内

#### 约会模块

- [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)
  - 约会规划入口与恢复入口
- [src/components/dating/DatingScene.tsx](/e:/小手机/Bloom/src/components/dating/DatingScene.tsx)
  - 正式约会场景页，基于消息流承载剧情卡片与状态
- [src/components/dating/sessionUtils.ts](/e:/小手机/Bloom/src/components/dating/sessionUtils.ts)
  - 约会 session 规范化、背景图、兼容处理
- [src/components/dating/DatingScene.css](/e:/小手机/Bloom/src/components/dating/DatingScene.css)
  - 约会样式

#### 其它业务模块

- [src/components/couple-space/CoupleSpaceApp/Page.tsx](/e:/小手机/Bloom/src/components/couple-space/CoupleSpaceApp/Page.tsx)
  - 情侣空间
- [src/components/couple-space/PerceptionView.tsx](/e:/小手机/Bloom/src/components/couple-space/PerceptionView.tsx)
  - 感知页
- [src/components/media/MusicApp.tsx](/e:/小手机/Bloom/src/components/media/MusicApp.tsx)
  - 音乐模块
- [src/components/wallet/WalletApp/Page.tsx](/e:/小手机/Bloom/src/components/wallet/WalletApp/Page.tsx)
  - 钱包模块
- [src/components/social/ForumApp/Page.tsx](/e:/小手机/Bloom/src/components/social/ForumApp/Page.tsx)
  - 论坛模块
- [src/components/monitor/MonitorApp/Page.tsx](/e:/小手机/Bloom/src/components/monitor/MonitorApp/Page.tsx)
  - 监控模块
- [src/components/monitor/PhoneInterface.tsx](/e:/小手机/Bloom/src/components/monitor/PhoneInterface.tsx)
  - 监控模块中的手机界面视图
- [src/components/customization/CustomizationApp/Page.tsx](/e:/小手机/Bloom/src/components/customization/CustomizationApp/Page.tsx)
  - 桌面与视觉自定义、数据导入导出
- [src/components/games/GameCenter.tsx](/e:/小手机/Bloom/src/components/games/GameCenter.tsx)
  - 游戏中心容器
- [src/components/games](/e:/小手机/Bloom/src/components/games)
  - 内含五子棋、贪吃蛇、真心话大冒险、石头剪刀布、连连看、卡牌对决、情侣问答等游戏实现

### 4.2 `src/services`

#### AI 运行时与 Prompt

- [src/services/ai/runtimeClient.ts](/e:/小手机/Bloom/src/services/ai/runtimeClient.ts)
  - 统一 AI 调用层
  - 支持 Gemini 与 OpenAI 兼容接口
  - 提供 `generateTextWithConfig` 和 `streamTextWithConfig`
- [src/services/ai/prompts/builders/buildChatPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildChatPrompt.ts)
  - 主聊天 prompt builder
- [src/services/ai/prompts/builders/buildDatingPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildDatingPrompt.ts)
  - 约会 prompt builder
- [src/services/ai/prompts/builders/buildSummaryPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildSummaryPrompt.ts)
  - 聊天摘要 prompt builder
- [src/services/ai/prompts/builders/buildMomentsPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildMomentsPrompt.ts)
  - 动态生成 prompt builder
- [src/services/ai/prompts/builders/buildMomentCommentReplyPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildMomentCommentReplyPrompt.ts)
  - 动态评论回复 prompt builder
- [src/services/ai/prompts/index.ts](/e:/小手机/Bloom/src/services/ai/prompts/index.ts)
  - Prompt 导出中心

#### 聊天消息操作

- [src/services/chat/messageActions.ts](/e:/小手机/Bloom/src/services/chat/messageActions.ts)
  - 复制、引用、转发、收藏、删除、分享、回复预览、布局辅助

#### 动态相关

- [src/services/moments/orchestrator.ts](/e:/小手机/Bloom/src/services/moments/orchestrator.ts)
  - 动态发布与自动触发编排
- [src/services/moments/generators.ts](/e:/小手机/Bloom/src/services/moments/generators.ts)
  - 动态、评论回复、fallback 内容生成
- [src/services/moments/triggers.ts](/e:/小手机/Bloom/src/services/moments/triggers.ts)
  - 动态触发条件与上下文提取

### 4.3 `src/features`

#### 浏览器持久化

- [src/features/persistence](/e:/小手机/Bloom/src/features/persistence)
  - 当前浏览器持久化基础设施与业务数据 store / bridge
  - 包括：
    - `storageKeys`
    - `localConfigStore`
    - `browserDb`
    - `persistentAssetService`
    - `useResolvedPersistentValue`
    - `usePersistentFieldActions`
    - `visualSettingsStore`
    - `userProfile / moments / forumData / coupleSpace / chatHistory / callHistory / datingRecords` 等 store 与 bridge

#### 聊天域

- [src/features/chat-session](/e:/小手机/Bloom/src/features/chat-session)
  - 聊天挂载层与页面容器层
  - 目前包括：
    - `ChatSessionMount`
    - `ChatSessionPersistenceBridge`
    - `DirectChatSessionContainer`
    - `GroupChatSessionContainer`
    - `ChatSessionScreen`
    - `GroupChatSessionScreen`

- [src/features/chat-runtime](/e:/小手机/Bloom/src/features/chat-runtime)
  - 聊天运行时层
  - 目前包括：
    - `useDirectChatRuntime`
    - `useGroupChatRuntime`
    - `useSessionRuntimeCore`
    - `types`

#### 角色域

- [src/features/character-domain](/e:/小手机/Bloom/src/features/character-domain)
  - 角色读取边界第一刀
  - 当前以 `createCharacterDirectory(...)` 为主，负责角色按 id / name / group member 的只读查询

## 5. 顶层状态与核心数据

### 5.1 `App.tsx` 仍然是主状态中心

[src/App.tsx](/e:/小手机/Bloom/src/App.tsx) 当前仍掌握这些顶层状态：

- 当前应用页：`activeApp`
- 主应用内 tab：`activeTab`
- 当前角色：`selectedCharacterId`
- 当前群聊：`selectedGroupId`
- 当前论坛帖子：`selectedForumPostId`
- 设置中心：`settings`
- 顶层业务数据：`appData`
- 应用内对话框状态与事件接管

### 5.2 `appData` 的主要内容

当前 `appData` 主要包含：

- `characters`
- `chatHistory`
- `userProfile`
- `masks`
- `favorites`
- `visualSettings`
- `groups`
- `moments`
- `worldBooks`
- `coupleSpace`
- `friendRequests`
- `chatGroups`
- `callHistory`
- `savedDates`
- `collectedDates`
- `musicData`
- `walletData`

### 5.3 关键类型

[src/types.ts](/e:/小手机/Bloom/src/types.ts) 中的重点类型包括：

- `Character`
- `ChatMessage`
- `ChatHistory`
- `ApiConfig`
- `AppSettings`
- `VisualSettings`
- `WidgetConfig`
- `DesktopIconConfig`
- `DateSession`
- `CallRecord`
- `MusicData`
- `WalletData`
- `FriendRequest`
- `ChatGroup`

其中 `VisualSettings` 已经成为首页、桌面布局、聊天视觉、动态卡片样式的统一承载对象。

---

## 6. 页面流转与主链路

### 6.1 首页到应用页

入口：

- [src/components/home/HomeScreen/Page.tsx](/e:/小手机/Bloom/src/components/home/HomeScreen/Page.tsx)

链路：

1. 用户点击桌面图标。
2. `HomeScreen` 通过 `onOpenApp(appId)` 把事件抛给 `App.tsx`。
3. `App.tsx` 更新 `activeApp`。
4. 渲染对应的主壳页面或独立模块页面。

### 6.2 主应用壳内流转

入口：

- [src/components/main/MainAppShell/Page.tsx](/e:/小手机/Bloom/src/components/main/MainAppShell/Page.tsx)

当前主壳内包含：

- `chat`
- `contacts`
- `moments`
- `me`

这四个区域本身已拆为页面组件，但数据与回调仍然主要从 `App.tsx` 注入。

### 6.3 联系人与群聊流转

入口：

- [src/components/main/ContactsShell/Page.tsx](/e:/小手机/Bloom/src/components/main/ContactsShell/Page.tsx)

当前支持：

- 联系人搜索与分组过滤
- 新朋友页
- 群聊管理页
- 从联系人打开单聊
- 从主聊天列表打开群聊会话

### 6.4 约会入口

当前约会入口仍在聊天会话链路中：

1. 用户在聊天页触发约会。
2. `App.tsx` 控制 `showDatingModal = true`。
3. 渲染 [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)。
4. `DatingModal` 决定进入“规划页”还是恢复已保存 session。
5. 再进入 [src/components/dating/DatingScene.tsx](/e:/小手机/Bloom/src/components/dating/DatingScene.tsx)。

---

## 7. AI 调用架构

### 7.1 当前统一点

统一配置来源已经基本收口到 `settings.configs + settings.activeConfigId`。

- provider
- model
- baseUrl
- apiKey
- temperature

### 7.2 已服务化并接入统一调用层的部分

- 普通聊天与群聊都已经接到 [src/services/ai/runtimeClient.ts](/e:/小手机/Bloom/src/services/ai/runtimeClient.ts)
- 摘要生成使用 `buildSummaryPrompt`
- 动态与评论回复使用 `services/moments/*`
- 情侣空间中的多条 AI 文本生成入口也已统一走 `runtimeClient`
- 聊天设置中的记忆总结也已统一走 `runtimeClient`

### 7.3 当前仍保留差异化组织的部分

虽然调用层已经基本统一，但聊天域仍不是最终形态：

- direct / group runtime 已拆出，但尚未完全抽成更高一层 shared session runtime
- prompt builder 的内容仍按直聊、群聊、动态、约会分开维护
- `characters` 域目前只完成了读取边界第一刀，尚未进入持久化与写入边界阶段

这也是当前最真实的架构状态。

---

## 8. 聊天、摘要与消息操作

### 8.1 普通聊天链路

普通聊天链路已经从 `App.tsx` 里抽出到聊天域：

- [src/features/chat-session/ChatSessionMount.tsx](/e:/小手机/Bloom/src/features/chat-session/ChatSessionMount.tsx)
- [src/features/chat-session/DirectChatSessionContainer.tsx](/e:/小手机/Bloom/src/features/chat-session/DirectChatSessionContainer.tsx)
- [src/features/chat-session/ChatSessionScreen.tsx](/e:/小手机/Bloom/src/features/chat-session/ChatSessionScreen.tsx)
- [src/features/chat-runtime/useDirectChatRuntime.ts](/e:/小手机/Bloom/src/features/chat-runtime/useDirectChatRuntime.ts)
- [src/features/chat-runtime/useSessionRuntimeCore.ts](/e:/小手机/Bloom/src/features/chat-runtime/useSessionRuntimeCore.ts)

当前核心包括：

- 构建聊天 prompt
- 走统一 `runtimeClient`
- 流式接收文本
- 按句拆分为多气泡消息
- 写回 `chatHistory`
- 承接图片、位置、语音、转账、收藏、删除、转发、引用等主要会话动作

### 8.2 摘要链路

摘要能力已经显式拆分：

- [src/services/ai/prompts/builders/buildSummaryPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildSummaryPrompt.ts)
- [src/components/chat/ChatSettingsPanel.tsx](/e:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)

当前用于：

- 最近聊天总结
- 角色记忆摘要整理
- 设置面板中的摘要相关操作

### 8.3 消息操作链路

消息操作已从 `App.tsx` 收口到：

- [src/services/chat/messageActions.ts](/e:/小手机/Bloom/src/services/chat/messageActions.ts)

当前集中处理：

- `copy`
- `quote`
- `favorite`
- `delete`
- `share`
- `forward`
- reply payload
- 文本提取与预览
- 会话头部状态与已读标签辅助

当前消息动作调用点已经主要转移到 direct runtime，由 screen 负责触发 UI，runtime 负责改动 history / favorites / share payload。

---

## 9. 动态模块架构

动态相关已经具备较明确的三层结构：

- 触发层： [src/services/moments/triggers.ts](/e:/小手机/Bloom/src/services/moments/triggers.ts)
- 生成层： [src/services/moments/generators.ts](/e:/小手机/Bloom/src/services/moments/generators.ts)
- 编排层： [src/services/moments/orchestrator.ts](/e:/小手机/Bloom/src/services/moments/orchestrator.ts)

当前作用包括：

- 自动发布动态
- 根据上下文生成评论回复
- 命令触发动态发布
- 动态回退内容生成

这一块相比普通聊天主链路，已经更接近“服务层先行”的结构。

---

## 10. 约会模块架构

### 10.1 当前分层

规划层：

- [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)

场景层：

- [src/components/dating/DatingScene.tsx](/e:/小手机/Bloom/src/components/dating/DatingScene.tsx)

辅助层：

- [src/components/dating/sessionUtils.ts](/e:/小手机/Bloom/src/components/dating/sessionUtils.ts)

Prompt 与规则层：

- [src/services/ai/prompts/builders/buildDatingPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildDatingPrompt.ts)
- [src/services/ai/prompts/scenarios/dating.ts](/e:/小手机/Bloom/src/services/ai/prompts/scenarios/dating.ts)

### 10.2 当前特征

- 正式约会页已是“消息流驱动”而不是单块面板驱动。
- 角色剧情消息可携带 `narrative / status / playlist` 等结构化内容。
- `savedDates` 与 `collectedDates` 分别承载继续会话与收藏记录。
- 背景图优先级已从 session 配置与工具函数统一处理。

### 10.3 当前恢复规则

- 明确保存过的约会才会进入可恢复记录。
- 未保存直接退出，不会自动恢复现场。

---

## 11. 首页桌面与视觉自定义

### 11.1 首页桌面

首页桌面的布局重心已经从固定 360 宽设计，演进为“容器尺寸驱动”的布局计算：

- 宽度档位：`compact / regular / large`
- 高屏修正：`isTallPhone`
- 布局输出：slot、dock、navbar、widget、usable 区域

关键文件：

- [src/components/home/HomeScreen/Page.tsx](/e:/小手机/Bloom/src/components/home/HomeScreen/Page.tsx)
- [src/components/home/HomeScreen/layout.ts](/e:/小手机/Bloom/src/components/home/HomeScreen/layout.ts)
- [src/components/home/HomeScreen/HomeScreen.css](/e:/小手机/Bloom/src/components/home/HomeScreen/HomeScreen.css)

### 11.2 桌面自定义

- [src/components/customization/CustomizationApp/Page.tsx](/e:/小手机/Bloom/src/components/customization/CustomizationApp/Page.tsx)

当前直接修改：

- `visualSettings.desktop`
- `visualSettings.desktopIcons`
- `visualSettings.widgets`
- `visualSettings.navBar`
- 全局视觉配置与数据导入导出

`visualSettings` 已经是桌面与视觉系统的核心配置中心，而不是分散在多个主题对象里。

---

## 12. 应用内弹层与手机容器约束

这是近期已经明确收口的一条架构线。

### 12.1 统一入口

- [src/utils.ts](/e:/小手机/Bloom/src/utils.ts)
  - `APP_DIALOG_EVENT`
  - `showInAppAlert`
  - `showInAppConfirm`
  - `showInAppPrompt`
- [src/App.tsx](/e:/小手机/Bloom/src/App.tsx)
  - 统一监听应用内 dialog 事件并渲染

### 12.2 当前目标

- 尽量把弹窗、确认框、输入框收敛到手机容器内部
- 避免浏览器原生 `alert / confirm / prompt` 破坏手机壳体验
- 让 forum、group chat 等内页在 flex 链路中正确滚动
- 减少 header、状态栏、浮层相互覆盖

### 12.3 相关文件

- [src/index.css](/e:/小手机/Bloom/src/index.css)
- [src/components/chat/GameCard.tsx](/e:/小手机/Bloom/src/components/chat/GameCard.tsx)
- [src/components/social/ForumApp/Page.tsx](/e:/小手机/Bloom/src/components/social/ForumApp/Page.tsx)
- [src/components/main/MainAppShell/Page.tsx](/e:/小手机/Bloom/src/components/main/MainAppShell/Page.tsx)

---

## 13. 当前最重要的真实主链路

### 13.1 聊天主链

- `ChatSessionMount`
- `DirectChatSessionContainer` / `GroupChatSessionContainer`
- `ChatSessionPersistenceBridge`
- `useDirectChatRuntime` / `useGroupChatRuntime`
- `useSessionRuntimeCore`
- `buildChatPrompt` / `buildGroupChatPrompt`
- `runtimeClient`
- 写回 `chatHistory` / `chatGroups[].history`

### 13.2 约会主链

- 聊天会话触发 `DatingModal`
- `DatingModal` 规划或恢复 session
- `DatingScene` 承载正式消息流
- `buildDatingPrompt`
- `runtimeClient`
- 写回 `DateSession.messages`

### 13.3 动态主链

- `App.tsx` 中的动态数据状态
- `services/moments/*`
- 动态发布、自动触发、评论回复

### 13.4 首页主链

- `HomeScreen`
- `layout.ts`
- `visualSettings`
- `CustomizationApp`

---

## 14. 当前架构风险与维护建议

### 14.1 现状风险

1. [src/App.tsx](/e:/小手机/Bloom/src/App.tsx) 仍然过大。
   - 仍然承担顶层状态、页面切换、应用内弹窗、默认数据拼装。
   - 虽然聊天 screen 已迁出，但顶层状态中心仍集中在这里。

2. 会话运行时尚未彻底统一。
   - 目前已经有 `direct/group runtime + runtime core`，但尚未形成更高一层 shared session runtime 抽象。

3. 类型与文档存在历史包袱。
   - [src/types.ts](/e:/小手机/Bloom/src/types.ts) 和 [README.md](/e:/小手机/Bloom/README.md) 中仍能看到中文乱码痕迹。

4. 前端状态体量持续增大。
   - `appData` 已同时承载角色、动态、情侣空间、音乐、钱包、约会、通话、群聊等多类数据，后续维护成本会上升。

### 14.2 建议的整理顺序

1. 先决定 `character-domain` 第二刀：是进入角色持久化，还是继续扩大角色读取边界。
2. 再评估是否需要把 direct / group runtime 再抽一层 shared session runtime。
3. 最后继续拆分 `App.tsx` 中剩余的顶层业务状态与回调。

不建议先做大规模 UI 拆分而不处理聊天主链，因为那样对复杂度下降帮助有限。

---

## 15. 当前阶段判断

当前项目已经不再是“铺基础设施”的阶段，而是“主线阶段性收官”状态。

### 15.1 当前完成度

- 整体主线完成度：约 `97%`
- 聊天拆分主线完成度：约 `93% ~ 95%`

### 15.2 已阶段性完成的主线

- 浏览器持久化基础设施
- 视觉资源持久化主线
- 业务 JSON 持久化主线
- `callHistory / savedDates / collectedDates / chatHistory` bridge
- `chat-session` 分层
- `chat-runtime` 分层
- `character-domain` 读取边界第一刀
- 普通聊天 / 群聊 / 动态 / 情侣空间 / 聊天设置的主要 AI 调用链统一到 `runtimeClient`

### 15.3 当前剩余项

严格来说，当前剩余已经主要是“后续优化项”，而不是主线 blocker：

1. `character-domain` 第二刀
2. 是否继续抽更高一层 shared session runtime
3. `App.tsx` 顶层状态进一步拆分

### 15.4 `character-domain` 第二刀

这是当前主线之后最值得进入的下一阶段之一。

#### 为什么要做

虽然当前已经通过 `createCharacterDirectory(...)` 建立了角色读取边界第一刀，但 `characters` 仍然是一个被多个模块共同读取和写回的顶层共享数组：

- 聊天
- 通讯录
- 群聊成员
- 动态作者
- 论坛分享目标
- 情侣空间 partner
- 面具 / 世界书 / 角色资源

这意味着如果不继续推进第二刀，后面会越来越容易出现：

- 角色对象在不同页面以不同方式写回
- 持久化边界不清楚
- 头像 / 背景 / 气泡 / 表情包等资源处理继续散落
- 顶层 `appData.characters` 成为新的维护瓶颈

#### 必要性判断

- 短期必要性：中高
- 中长期必要性：高

如果后续还会继续推进：

- 角色设置
- 群聊成员能力
- 角色资料编辑
- 角色资源持久化
- 聊天域进一步拆分

那么 `character-domain` 第二刀基本是必做项。

#### 第二刀建议分成 3 部分

##### 第一部分：持久化边界

目标：

- 给 `characters` 建立独立 store / bridge
- 让角色数据不再只是整包 `appData` 的顺带保存对象

建议新增：

- `charactersStore.ts`
- `usePersistedCharactersBridge.ts`

预期职责：

- `loadCharacters`
- `saveCharacters`
- `patchCharacters`
- `resetCharacters`
- 首屏 hydrate
- 后续自动保存
- 防止首帧空值覆盖

这是第二刀里最稳、最值得先做的一步。

##### 第二部分：写入边界

目标：

- 让角色更新开始通过角色域入口走
- 逐步减少业务页直接修改 `appData.characters`

后续会涉及：

- `updateCharacterById`
- `patchCharacter`
- `removeCharacter`
- `replaceCharacters`

这一部分的意义在于：

- 降低旧角色快照覆盖新字段的风险
- 避免不同页面各自维护一套更新语义

##### 第三部分：资源与复杂联动边界

目标：

- 把角色资源和复杂关系联动从散落页面中继续往角色域收

重点对象包括：

- `character.avatar`
- `character.background`
- `character.bubbleImage`
- `character.userBubbleImage`
- `character.stickers`

以及与这些对象相关的联动：

- `masks`
- `worldBooks`
- `chatGroups`
- `moments`
- `forum`

这一部分最重，因此应放在第二刀最后处理。

#### 第二刀建议顺序

1. 先做角色持久化边界
2. 再做角色写入边界
3. 最后处理角色资源与复杂联动

---

## 16. 后续阶段路线

当前主线已经阶段性收官。后续更合理的推进方式不是继续零散补功能，而是按域分阶段推进。

### 16.1 近期优先级

1. `character-domain` 第二刀第一部分
   - `charactersStore + usePersistedCharactersBridge`
2. 评估是否需要更高一层 `shared session runtime`
3. 继续减少 `App.tsx` 顶层装配负担

### 16.2 中期方向

1. 角色资源统一持久化与写入边界
2. 群聊 prompt 和行为策略继续优化
3. 角色域与聊天域、动态域、论坛域、情侣空间域的联动收口

### 16.3 长期方向

1. 进一步拆分 `App.tsx`
2. 形成更明确的领域层次：
   - persistence
   - character-domain
   - chat-session
   - chat-runtime
   - moments
   - forum
   - couple-space
3. 逐步减少“整包 `appData` 中央汇总”的依赖

---

## 17. 建议阅读顺序

如果要快速理解当前项目，建议按这个顺序阅读：

1. [src/types.ts](/e:/小手机/Bloom/src/types.ts)
2. [src/App.tsx](/e:/小手机/Bloom/src/App.tsx)
3. [src/components/main/MainAppShell/Page.tsx](/e:/小手机/Bloom/src/components/main/MainAppShell/Page.tsx)
4. [src/components/home/HomeScreen/Page.tsx](/e:/小手机/Bloom/src/components/home/HomeScreen/Page.tsx)
5. [src/services/chat/messageActions.ts](/e:/小手机/Bloom/src/services/chat/messageActions.ts)
6. [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)
7. [src/components/dating/DatingScene.tsx](/e:/小手机/Bloom/src/components/dating/DatingScene.tsx)
8. [src/services/ai/runtimeClient.ts](/e:/小手机/Bloom/src/services/ai/runtimeClient.ts)
9. [src/services/ai/prompts/builders/buildChatPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildChatPrompt.ts)
10. [src/services/moments/orchestrator.ts](/e:/小手机/Bloom/src/services/moments/orchestrator.ts)

这样能最快串起：

- 顶层状态
- 页面切换
- 聊天链路
- 约会链路
- 动态链路
- 首页与视觉配置链路

