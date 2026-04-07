# Bloom 项目架构说明

更新时间：2026-04-04
文档定位：描述当前仓库真实架构，不描述理想态，只描述已经落在代码里的结构与主链。

## 1. 项目概览

Bloom 是一个以“手机桌面容器 + AI 角色互动 + 长期关系经营”为核心的前端主导型应用。它不是单聊天页，而是一个把聊天、通讯录、动态、约会、情侣空间、音乐、论坛、钱包、自定义和小游戏组织进同一手机容器中的多模块产品。

从架构上看，当前项目处于典型的“主应用已成型、领域边界逐步拆出”的阶段：

- 顶层装配仍集中在 `src/App.tsx`
- 会话、运行时、角色域、持久化、关系上下文、记忆层、动态编排、情侣空间主动内容等已经拆出独立模块
- 项目已经明显脱离单文件 demo，但还没有完全进入彻底平台化阶段

## 2. 技术栈与运行方式

### 2.1 前端

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `motion`
- `lucide-react`

### 2.2 服务与依赖

- Express
- `@google/genai`
- OpenAI 兼容接口
- `better-sqlite3`

说明：

- `better-sqlite3` 已安装，但当前主数据层仍以浏览器本地持久化为主
- AI 调用统一走 runtime，而不是各业务模块各自直连 provider

### 2.3 运行入口

- `package.json`
  - `npm run dev` -> `tsx server.ts`
  - `npm run build` -> `vite build`
  - `npm run preview` -> `vite preview`
  - `npm run lint` -> `tsc --noEmit`
- `server.ts`
  - Express 本地服务入口
  - 开发模式挂载 Vite middleware
  - 生产模式托管 `dist`
  - 提供网易云音乐代理接口
- `src/main.tsx`
  - React 挂载入口
- `src/App.tsx`
  - 当前应用总装配入口

## 3. 根目录结构

```text
Bloom/
├─ src/
├─ docs/
├─ app/
├─ dist/
├─ server.ts
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
└─ metadata.json
```

关键文件：

- `src/App.tsx`：应用级状态、页面切换和模块装配中心
- `src/types.ts`：全局核心类型中心
- `server.ts`：开发服务与音乐代理入口
- `README.md`：项目入口说明

## 4. 当前分层

当前代码可以理解为六层：

1. 页面与 UI 层
2. 页面装配层
3. 业务运行时层
4. 业务服务层
5. 持久化层
6. 本地代理服务层

对应目录心智：

- `components`
  - 页面、面板、可视交互
- `features`
  - 会话装配、运行时、角色域、持久化等领域边界
- `services`
  - AI 调用、prompt、内容生成、规则与编排
- `server.ts`
  - 本地开发 BFF / 代理层

## 5. `src/components`：页面与交互层

### 5.1 首页与手机桌面

核心文件：

- `src/components/home/HomeScreen/Page.tsx`
- `src/components/home/HomeScreen/layout.ts`
- `src/components/home/HomeScreen/HomeScreen.css`
- `src/components/shared/DesktopWidgets.tsx`

职责：

- 手机桌面入口
- 图标、Dock、导航栏、组件布局
- 桌面拖拽与摆放
- 桌面视觉自定义

### 5.2 主应用壳

核心文件：

- `src/components/main/MainAppShell/Page.tsx`
- `src/components/main/ContactsShell/Page.tsx`
- `src/components/main/NewFriendsPage.tsx`
- `src/components/main/GroupChatManagerPage.tsx`
- `src/components/main/MePage.tsx`

职责：

- 四大主 Tab 组织：`chat / contacts / moments / me`
- 聊天列表、角色入口、通讯录入口、个人页入口
- 群聊管理和新朋友入口

### 5.3 聊天相关 UI

核心文件：

- `src/components/chat/ChatSettingsPanel.tsx`
- `src/components/chat/GameCard.tsx`

职责：

- 聊天设置
- 角色资料编辑
- 记忆字段编辑
- 游戏卡片展示

### 5.4 约会模块 UI

核心文件：

- `src/components/dating/DatingModal.tsx`
- `src/components/dating/DatingScene.tsx`
- `src/components/dating/sessionUtils.ts`

职责：

- 约会发起
- 约会场景渲染
- 约会 session 管理

### 5.5 情侣空间 UI

核心文件：

- `src/components/couple-space/CoupleSpaceApp/Page.tsx`
- `src/components/couple-space/calendar/*`
- `src/components/couple-space/loveletters/*`
- `src/components/couple-space/archive/*`
- `src/components/couple-space/interaction/*`
- `src/components/couple-space/settings/*`

职责：

- 情侣空间主页面
- 情书、留言板、共笔、小账本、情侣动态、纪念日、归档
- 主动内容设置与检查
- 心动胶囊机等互动玩法入口

### 5.6 其他业务页面

核心文件：

- `src/components/media/MusicApp.tsx`
- `src/components/wallet/WalletApp/Page.tsx`
- `src/components/social/ForumApp/Page.tsx`
- `src/components/monitor/MonitorApp/Page.tsx`
- `src/components/customization/CustomizationApp/Page.tsx`
- `src/components/games/*`

职责：

- 承载生活化模块页面
- 丰富设备感和世界感

## 6. `src/features`：领域边界层

### 6.1 `features/chat-session`

核心文件：

- `ChatSessionMount.tsx`
- `DirectChatSessionContainer.tsx`
- `GroupChatSessionContainer.tsx`
- `ChatSessionScreen.tsx`
- `GroupChatSessionScreen.tsx`

职责：

- 根据 `activeApp` 挂载单聊或群聊会话
- 装配会话需要的依赖与状态
- 将会话 UI 与运行时连接起来

### 6.2 `features/chat-runtime`

核心文件：

- `useDirectChatRuntime.ts`
- `useGroupChatRuntime.ts`
- `useSessionRuntimeCore.ts`
- `types.ts`

职责：

- 统一处理生成中的 loading、error、generationId
- 防止旧请求覆盖新请求
- 为单聊和群聊提供共享运行时内核

这层是聊天链路从“页面直接调模型”走向“统一运行时”的关键一步。

### 6.3 `features/persistence`

核心文件包括：

- `browserDb.ts`
- `localConfigStore.ts`
- `storageKeys.ts`
- `persistentAssetService.ts`
- `persistentAssetRef.ts`
- `objectUrlRegistry.ts`
- `sanitizeTransientAssetValue.ts`
- `useResolvedPersistentValue.ts`

业务 store / bridge 包括：

- `charactersStore.ts`
- `chatHistoryStore.ts`
- `datingRecordsStore.ts`
- `callHistoryStore.ts`
- `friendRequestsStore.ts`
- `walletDataStore.ts`
- `musicDataStore.ts`
- `meDataStore.ts`
- `chatOrganizationStore.ts`
- `forumDataStore.ts`
- `momentsStore.ts`
- `userProfileStore.ts`
- `coupleSpaceStore.ts`
- 各类 `usePersisted*Bridge.ts`

职责：

- 本地持久化
- hydrate 与回写
- 普通 JSON 与资源类字段分离处理
- 旧结构迁移与兼容

### 6.4 `features/character-domain`

核心文件：

- `useCharacterDirectory.ts`
- `characterMutations.ts`

职责：

- 角色读取边界
- 角色 mutation 收口
- 降低页面直接 `map/filter` 全量角色数组的耦合

已形成的统一 mutation 包括：

- `replaceCharacters`
- `updateCharacterById`
- `patchCharacterById`
- `removeCharacterById`
- `upsertCharacter`

### 6.5 `features/couple-space-interactions`

当前重点为 `heart-capsule-machine` 子域。

职责：

- 心动胶囊机页面
- 胶囊类型定义
- prompt 与生成逻辑
- 每日抽取与历史记录

这说明情侣空间已经不只是内容展示页，而是在长出独立互动玩法域。

## 7. `src/services`：业务服务与 AI 编排层

### 7.1 `services/ai/runtimeClient.ts`

职责：

- 统一 Gemini 与 OpenAI 兼容接口调用
- 提供普通生成和流式生成
- 清洗 provider 输出
- 处理 SSE 与非标准响应兜底

这是整个项目的 AI 调用公共入口之一。

### 7.2 Prompt 体系

目录：

- `services/ai/prompts/base`
- `services/ai/prompts/builders`
- `services/ai/prompts/scenarios`
- `services/ai/prompts/character`
- `services/ai/prompts/coupleSpace`

当前已明确拆分的场景包括：

- chat
- groupChat
- dating
- moments
- momentCommentReply
- coupleSpace
- summary

### 7.3 `services/chat`

核心文件：

- `messageActions.ts`
- `messageText.ts`
- `decideTransferOutcome.ts`

职责：

- 消息收藏、转发、引用、删除、分享等操作规则
- 聊天文案与消息行为辅助

### 7.4 `services/moments`

核心文件：

- `triggers.ts`
- `generators.ts`
- `orchestrator.ts`

职责：

- 判断何时触发动态
- 生成动态正文与评论回复
- 串联触发与生成流程

这层已经形成比较清晰的 `trigger -> generator -> orchestrator` 结构。

### 7.5 `services/relationship-context`

核心文件：

- `buildCharacterContext.ts`
- `buildRelationshipProjection.ts`
- `types.ts`

职责：

- 统一角色资料读取
- 构建关系投影
- 为聊天、群聊、约会等场景提供共享输入基线

### 7.6 `services/memory`

核心文件：

- `buildResolvedMemoryLayers.ts`
- `buildShortTermSummary.ts`
- `buildLongTermMemoryProfile.ts`
- `types.ts`

职责：

- 最小双层记忆构建
- 把短期关系余波与长期关系画像区分开

### 7.7 `services/scene-inputs`

核心文件：

- `buildChatSceneInput.ts`
- `buildGroupChatSceneInput.ts`
- `buildDatingSceneInput.ts`
- `buildChatPromptBudget.ts`

职责：

- 把共享关系上下文裁剪为具体场景输入
- 控制 prompt 预算与上下文拼装

### 7.8 `services/ai/couple-space`

目录包括：

- `context/*`
- `prompt/*`
- `actions/*`
- `initiative/*`
- `execution/*`

职责：

- 情侣空间上下文准备
- 主动内容规则、候选、执行桥与写回
- Draft / Confirm / Auto 路由

这是当前仓库里最接近“Agent 产品化”的部分。

## 8. 顶层状态与页面切换

### 8.1 `App.tsx` 当前维护的主要页面状态

- `activeApp`
  - `home`
  - `chat`
  - `settings`
  - `chat-session`
  - `add-character`
  - `sms`
  - `character-profile`
  - `character-moments`
  - `worldbook`
  - `monitor`
  - `customization`
  - `couple-space`
  - `perception`
  - `music`
  - `forum`
  - `wallet`
  - `group-chat-session`
- `activeTab`
  - `chat / contacts / moments / me`
- `selectedCharacterId`
- `selectedGroupId`
- 其他页面级选择状态

### 8.2 `AppData` 当前仍是核心聚合对象

主要包括：

- `characters`
- `chatHistory`
- `userProfile`
- `masks`
- `favorites`
- `visualSettings`
- `moments`
- `worldBooks`
- `coupleSpaceState`
- `friendRequests`
- `chatGroups`
- `callHistory`
- `savedDates`
- `collectedDates`
- `musicData`
- `walletData`
- `forumData`

这意味着虽然很多子域已经拆出，但最终装配仍大量回到顶层完成。

## 9. 当前关键数据模型

### 9.1 Character

当前角色模型已具备明显分层：

- 基础身份：`id / name / gender / avatar`
- 旧核心字段：`setting`
- 新主线字段：`corePersona / expressionStyle / boundaryPack`
- 关系显示字段：`remarkName / signature`
- 记忆字段：`shortTermSummary / longTermMemoryProfile`
- 聊天设置与行为偏好字段

### 9.2 CoupleSpaceState

当前情侣空间关键结构：

- `currentPartnerId`
- `spacesByPartnerId`

这是情侣空间能按角色独立建空间的基础。

### 9.3 VisualSettings

视觉配置已经不是简单主题色，而是一套较重的配置对象，覆盖：

- 全局壁纸
- 桌面图标
- 组件
- 导航栏
- 桌面布局
- 聊天外观
- 动态卡片
- 全局 CSS

## 10. 当前主要数据流

### 10.1 启动与 hydrate

1. `server.ts` 启动开发服务
2. `main.tsx` 挂载 `App`
3. `App.tsx` 先以默认状态启动
4. 各 `usePersisted*Bridge` 读取本地数据
5. hydrate 后回填顶层状态
6. 页面进入真实本地状态

### 10.2 聊天生成链路

1. 用户在会话界面输入内容
2. session container 组织当前上下文
3. runtime hook 开始一次 generation
4. scene input / prompt builder 生成输入
5. `runtimeClient` 发起模型请求
6. 流式结果逐步回写消息列表
7. 最终写回聊天历史
8. persistence bridge 观察变化并落盘

### 10.3 动态发布链路

1. 聊天行为或页面行为触发机会判断
2. `triggers.ts` 判断是否发动态
3. `generators.ts` 生成动态正文或评论回复
4. `orchestrator.ts` 返回标准结果
5. 顶层状态更新 `moments`
6. 持久化层落盘

### 10.4 情侣空间主动内容链路

1. 页面进入当前 partner 空间
2. 用户手动检查或系统触发自动检查
3. 上下文层收集角色、关系、聊天和空间痕迹
4. candidate 生成与打分
5. execution bridge 决定提交方式
6. 写回对应内容或生成草稿/确认项
7. 持久化层落盘

## 11. 当前架构判断

### 11.1 已经做对的部分

- 聊天 runtime 已经抽出公共内核
- 持久化层已经形成清晰边界
- 角色 mutation 已开始收口
- 关系上下文、记忆层和场景输入开始形成主线
- 情侣空间主动内容链路已经有产品化结构

### 11.2 当前主要瓶颈

- `App.tsx` 仍然过大
- 顶层聚合状态仍偏重
- 各主线虽已拆域，但最终仍通过顶层强装配耦合
- 部分旧字段与新骨架仍处于过渡并行阶段

## 12. 后续最合理的演进方向

1. 继续削薄 `App.tsx` 的装配责任
2. 继续把角色读取和写入收口到 `character-domain`
3. 继续推进 chat / group / dating / couple-space 统一 scene input
4. 继续做记忆分层与关系上下文稳定输出
5. 继续让页面层退回到“展示 + 触发 + 收参”角色

## 13. 结论

Bloom 当前的真实架构，可以概括为：

**一个以 `App.tsx` 为总装配入口、以 `features` 和 `services` 逐步拆出领域边界、正在从多模块前端应用演进为关系型 AI 平台的仓库。**

它最重要的不是“已经完全平台化”，而是已经长出了平台化最关键的几根骨架：

- 统一 runtime
- 持久化边界
- 角色域
- 关系上下文
- 记忆分层雏形
- scene input
- 情侣空间主动内容执行链
