# 项目架构说明

## 1. 项目定位

这是一个“手机桌面壳 + 角色陪伴式 AI 交互”的 React 项目。

它不是单一聊天页，而是把聊天、动态、约会、情侣空间、音乐、钱包、论坛、监控、桌面自定义等功能包装成一套手机界面。项目核心价值不只是“能调模型”，而是：

- 角色设定是否稳定
- 角色在不同页面里的表现是否连续
- 聊天、动态、约会等场景是否共享同一套用户与角色上下文
- UI 是否足够像“一个住着角色的手机”

当前架构仍然是“`App.tsx` 为主控制器 + 多个业务页面组件拆出”的形态：

- 页面和样式已经拆出不少
- 但主聊天链路、顶层状态、页面切换仍主要集中在 `src/App.tsx`

---

## 2. 当前代码结构总览

### 根目录

- [README.md](/e:/小手机/Bloom/README.md)
  - 项目运行方式与文档入口
- [docs/project-architecture.md](/e:/小手机/Bloom/docs/project-architecture.md)
  - 当前这份架构文档
- [src/main.tsx](/e:/小手机/Bloom/src/main.tsx)
  - React 挂载入口
- [src/App.tsx](/e:/小手机/Bloom/src/App.tsx)
  - 顶层应用状态、主聊天链路、页面切换、主要业务编排
- [src/types.ts](/e:/小手机/Bloom/src/types.ts)
  - 全局类型中心
- [src/index.css](/e:/小手机/Bloom/src/index.css)
  - 全局样式
- [src/utils.ts](/e:/小手机/Bloom/src/utils.ts)
  - 通用工具函数，含图片 URL 提取等逻辑

### 主要目录

- [src/components](/e:/小手机/Bloom/src/components)
  - 页面组件与业务 UI
- [src/services](/e:/小手机/Bloom/src/services)
  - AI prompt、消息操作、动态生成等服务层

---

## 3. 目录分层

### 3.1 `src/components`

#### 主屏与手机壳

- [src/components/home/HomeScreen/Page.tsx](/e:/小手机/Bloom/src/components/home/HomeScreen/Page.tsx)
  - 主屏桌面
  - 图标、Dock、小组件、顶部导航卡片、主屏交互
- [src/components/home/HomeScreen/HomeScreen.css](/e:/小手机/Bloom/src/components/home/HomeScreen/HomeScreen.css)
  - 主屏样式
- [src/components/home/HomeScreen/layout.ts](/e:/小手机/Bloom/src/components/home/HomeScreen/layout.ts)
  - 主屏网格/布局辅助逻辑

#### 主应用壳与联系人域

- [src/components/main/MainAppShell/Page.tsx](/e:/小手机/Bloom/src/components/main/MainAppShell/Page.tsx)
  - 聊天域主壳
  - `chat / contacts / moments / me` 四个 tab 切换
- [src/components/main/ContactsShell/Page.tsx](/e:/小手机/Bloom/src/components/main/ContactsShell/Page.tsx)
  - 联系人列表、角色资料、角色动态主页入口
- [src/components/main/MePage.tsx](/e:/小手机/Bloom/src/components/main/MePage.tsx)
  - 我的页、收藏、约会记录等入口

#### 聊天相关

- [src/components/chat/ChatSettingsPanel.tsx](/e:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)
  - 聊天设置、角色资料、记忆摘要等
- [src/components/chat/GroupChatSession.tsx](/e:/小手机/Bloom/src/components/chat/GroupChatSession.tsx)
  - 群聊页
- [src/components/chat/GameCard.tsx](/e:/小手机/Bloom/src/components/chat/GameCard.tsx)
  - 聊天消息里的游戏卡片

#### 约会模块

- [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)
  - 约会入口容器
  - 负责“策划约会页 / 正式约会页”的切换
  - 负责地点、情景、氛围、背景图配置
  - 负责决定是否恢复已保存约会
- [src/components/dating/DatingScene.tsx](/e:/小手机/Bloom/src/components/dating/DatingScene.tsx)
  - 正式约会页
  - 负责消息流、剧情卡片、用户气泡、回溯、保存、收藏
- [src/components/dating/DatingScene.css](/e:/小手机/Bloom/src/components/dating/DatingScene.css)
  - 正式约会页样式
- [src/components/dating/sessionUtils.ts](/e:/小手机/Bloom/src/components/dating/sessionUtils.ts)
  - 约会 session 背景图、消息规范化、旧数据兼容

#### 其他业务页面

- [src/components/customization/CustomizationApp/Page.tsx](/e:/小手机/Bloom/src/components/customization/CustomizationApp/Page.tsx)
  - 桌面自定义
- [src/components/couple-space/CoupleSpaceApp/Page.tsx](/e:/小手机/Bloom/src/components/couple-space/CoupleSpaceApp/Page.tsx)
  - 情侣空间
- [src/components/couple-space/PerceptionView.tsx](/e:/小手机/Bloom/src/components/couple-space/PerceptionView.tsx)
  - 感知页
- [src/components/media/MusicApp.tsx](/e:/小手机/Bloom/src/components/media/MusicApp.tsx)
  - 音乐页
- [src/components/wallet/WalletApp/Page.tsx](/e:/小手机/Bloom/src/components/wallet/WalletApp/Page.tsx)
  - 钱包页
- [src/components/social/ForumApp/Page.tsx](/e:/小手机/Bloom/src/components/social/ForumApp/Page.tsx)
  - 论坛页
- [src/components/monitor/MonitorApp/Page.tsx](/e:/小手机/Bloom/src/components/monitor/MonitorApp/Page.tsx)
  - 监控页
- [src/components/shared/DesktopWidgets.tsx](/e:/小手机/Bloom/src/components/shared/DesktopWidgets.tsx)
  - 主屏小组件渲染

### 3.2 `src/services`

#### AI 运行时与 Prompt

- [src/services/ai/runtimeClient.ts](/e:/小手机/Bloom/src/services/ai/runtimeClient.ts)
  - 当前项目里已拆出的统一 AI 请求层之一
  - 目前约会模块已改为通过它发请求
  - 它会根据 `ApiConfig` 决定走 Gemini 还是 OpenAI 兼容接口
- [src/services/ai/prompts/builders/buildChatPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildChatPrompt.ts)
  - 主聊天 prompt builder
- [src/services/ai/prompts/builders/buildDatingPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildDatingPrompt.ts)
  - 约会 prompt builder
- [src/services/ai/prompts/scenarios/dating.ts](/e:/小手机/Bloom/src/services/ai/prompts/scenarios/dating.ts)
  - 约会场景规则
- [src/services/ai/prompts/index.ts](/e:/小手机/Bloom/src/services/ai/prompts/index.ts)
  - prompt 导出汇总

#### 消息操作

- [src/services/chat/messageActions.ts](/e:/小手机/Bloom/src/services/chat/messageActions.ts)
  - 聊天消息复制、引用、转发、分享、收藏、删除
  - reply payload、文本提取、剪贴板 fallback、消息状态辅助逻辑

#### 动态相关

- [src/services/moments/orchestrator.ts](/e:/小手机/Bloom/src/services/moments/orchestrator.ts)
  - 动态发布与触发编排
- [src/services/moments/generators.ts](/e:/小手机/Bloom/src/services/moments/generators.ts)
  - 动态与评论回复生成
- [src/services/moments/triggers.ts](/e:/小手机/Bloom/src/services/moments/triggers.ts)
  - 动态触发条件与上下文提取

---

## 4. 顶层状态与核心数据

### 4.1 `App.tsx` 仍然是主状态中心

[src/App.tsx](/e:/小手机/Bloom/src/App.tsx) 当前依然掌握这些顶层状态：

- 当前页面：`activeApp`
- 当前聊天域 tab：`activeTab`
- 当前角色：`selectedCharacterId`
- 当前群聊：`selectedGroupId`
- 当前论坛帖子：`selectedForumPostId`
- 设置中心：`settings`
- 主业务数据：`appData`

`appData` 里主要包含：

- `characters`
- `chatHistory`
- `userProfile`
- `masks`
- `favorites`
- `visualSettings`
- `groups`
- `moments`
- `worldBooks`
- `friendRequests`
- `chatGroups`
- `callHistory`
- `savedDates`
- `collectedDates`
- `musicData`
- `walletData`

### 4.2 关键类型

[src/types.ts](/e:/小手机/Bloom/src/types.ts) 里的重点类型：

- `Character`
- `ChatMessage`
- `ChatHistory`
- `ApiConfig`
- `AppSettings`
- `VisualSettings`
- `MusicData`
- `WalletData`
- `DateSession`
- `DateMessage`
- `DatingGeneratedContent`

其中 `DateSession` 当前已经用于：

- 策划约会配置
- 正式约会消息流
- 背景图来源
- 收藏 / 保存记录

---

## 5. 主页面流转

### 5.1 主屏到聊天域

入口：

- [src/components/home/HomeScreen/Page.tsx](/e:/小手机/Bloom/src/components/home/HomeScreen/Page.tsx)

方式：

1. 用户点击主屏图标
2. `HomeScreen` 通过 `onOpenApp(appId)` 把事件抛给 `App.tsx`
3. [src/App.tsx](/e:/小手机/Bloom/src/App.tsx) 更新 `activeApp`
4. 渲染对应页面壳或独立页面

### 5.2 聊天域内部

入口：

- [src/components/main/MainAppShell/Page.tsx](/e:/小手机/Bloom/src/components/main/MainAppShell/Page.tsx)

内部切换：

- `chat`
- `contacts`
- `moments`
- `me`

聊天列表、联系人、动态、我的页都仍然是由 `App.tsx` 注入数据与回调。

### 5.3 约会入口

当前约会入口在 [src/App.tsx](/e:/小手机/Bloom/src/App.tsx) 的 `ChatSession` 中：

1. 用户在聊天页点击“约会”
2. `showDatingModal = true`
3. 渲染 [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)
4. `DatingModal` 根据是否存在“明确保存过的 session”决定：
   - 直接进入正式约会页
   - 或先进入策划约会页

---

## 6. 正常聊天链路

### 6.1 真实入口

正常聊天主链仍在 [src/App.tsx](/e:/小手机/Bloom/src/App.tsx) 的 `ChatSession` 内，核心入口是：

- `handleSend(...)`

### 6.2 当前真实调用链

大致链路：

1. 用户在聊天页发送消息
2. `ChatSession.handleSend(...)`
3. 从 `settings.configs + settings.activeConfigId` 读取当前 `activeConfig`
4. 构建 prompt：
   - [src/services/ai/prompts/builders/buildChatPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildChatPrompt.ts)
5. 根据 `activeConfig` 选择请求出口
   - Gemini：`GoogleGenAI`
   - OpenAI 兼容：`fetch(baseUrl/chat/completions)`
6. 把结果写回 `history`

### 6.3 当前现状说明

目前“正常聊天”与“约会”并没有完全共用同一个函数入口：

- 正常聊天主链仍主要在 `App.tsx` 里
- 约会模块已经改成通过 [src/services/ai/runtimeClient.ts](/e:/小手机/Bloom/src/services/ai/runtimeClient.ts) 发请求

这意味着：

- provider / model / baseURL / apiKey 来源已经统一到 `activeConfig`
- 但“主聊天请求逻辑”本身还没完全抽成共享 service

这属于当前架构的一个真实现状，而不是文档里的理想态。

---

## 7. 约会模块架构

### 7.1 当前分层

#### 策划层

- [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)

负责：

- 是否显示约会模块
- 策划约会页
- 地点、情景、氛围选择
- 自定义氛围输入
- 背景图设置（本地 / URL）
- 是否恢复已保存约会

#### 场景层

- [src/components/dating/DatingScene.tsx](/e:/小手机/Bloom/src/components/dating/DatingScene.tsx)

负责：

- 正式约会页
- 消息流
- 用户右侧气泡
- 角色沉浸式剧情卡片
- 状态区 / 歌单区折叠
- 回溯
- 保存 / 收藏 / 退出

#### 约会辅助层

- [src/components/dating/sessionUtils.ts](/e:/小手机/Bloom/src/components/dating/sessionUtils.ts)

负责：

- 约会背景图来源规整
- 约会消息规范化
- 旧 session 兼容
- 从消息流提取最新 generatedContent

#### Prompt 层

- [src/services/ai/prompts/builders/buildDatingPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildDatingPrompt.ts)
- [src/services/ai/prompts/scenarios/dating.ts](/e:/小手机/Bloom/src/services/ai/prompts/scenarios/dating.ts)

负责：

- 约会上下文组织
- 结构化输出要求
- narrative / status / playlist / background 规则

### 7.2 约会消息结构

正式约会页当前已经改成“消息流驱动”：

- 用户消息：右侧气泡
- 角色消息：左侧沉浸式剧情卡片

每条角色剧情消息内部可以包含：

- `generatedContent.narrative`
- `generatedContent.status`
- `generatedContent.playlist`

而不是整个页面共享唯一一个大块 `generatedContent` 面板。

### 7.3 背景图优先级

当前约会背景图规则是：

1. 本地上传图优先
2. 其次图片 URL
3. 都没有时回退角色头像

处理位置：

- 策划页创建 session 时在 [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)
- 展示时在 [src/components/dating/sessionUtils.ts](/e:/小手机/Bloom/src/components/dating/sessionUtils.ts)

### 7.4 保存与恢复规则

当前约会恢复逻辑已经收紧为：

- 只有明确点过“保存”的约会，才会成为可恢复会话
- 未保存直接退出，视为丢弃本次现场

也就是说：

- 已保存退出：下次点约会，直接恢复正式约会页
- 未保存退出：下次点约会，重新进入策划页

---

## 8. 主屏与桌面自定义

### 8.1 主屏

- [src/components/home/HomeScreen/Page.tsx](/e:/小手机/Bloom/src/components/home/HomeScreen/Page.tsx)
- [src/components/home/HomeScreen/HomeScreen.css](/e:/小手机/Bloom/src/components/home/HomeScreen/HomeScreen.css)
- [src/components/home/HomeScreen/layout.ts](/e:/小手机/Bloom/src/components/home/HomeScreen/layout.ts)

当前主屏重点：

- iOS 风格四列网格
- Dock
- 顶部导航卡片
- 可拖动图标与小组件
- 桌面自定义结果回写到 `visualSettings`

### 8.2 桌面自定义

- [src/components/customization/CustomizationApp/Page.tsx](/e:/小手机/Bloom/src/components/customization/CustomizationApp/Page.tsx)

主要负责：

- 壁纸
- 图标
- 摆放
- 小卡片
- 导航栏

这块会直接修改 `visualSettings`，而不是维护一套独立主题配置对象。

---

## 9. 消息操作架构

聊天消息操作已经从 `App.tsx` 收口到：

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
- 剪贴板 fallback
- 已读状态标签
- 顶部会话状态文案

`App.tsx` 在这块主要只负责：

- 获取当前消息
- 调用外部 action
- 写回 state

---

## 10. 当前最重要的几条真实主链

### 10.1 聊天主链

- `App.tsx`
- `ChatSession.handleSend`
- `buildChatPrompt`
- provider 选择
- 写回 `history`

### 10.2 约会主链

- `ChatSession` 打开 `DatingModal`
- `DatingModal` 策划 / 恢复
- `DatingScene` 正式约会消息流
- `buildDatingPrompt`
- `runtimeClient`
- 写回 `DateSession.messages`

### 10.3 动态主链

- `App.tsx` 内的动态域
- `services/moments/*`
- 角色自动发动态 / 评论回复

### 10.4 主屏主链

- `HomeScreen`
- `layout.ts`
- `visualSettings`
- `CustomizationApp`

---

## 11. 当前架构风险与维护建议

### 11.1 当前最大事实风险

1. [src/App.tsx](/e:/小手机/Bloom/src/App.tsx) 仍然过大  
   - 仍然同时承担：
     - 顶层状态
     - 主聊天链路
     - 页面切换
     - 大量默认数据

2. 正常聊天主链与约会请求链尚未彻底统一函数入口  
   - 约会已通过 `runtimeClient`
   - 主聊天仍在 `App.tsx` 内直接处理 provider 分支

3. 项目部分旧中文文案仍有编码损坏残留  
   - 尤其是一些较老的静态字符串和默认数据

### 11.2 后续维护建议

如果后续继续整理，建议顺序是：

1. 先把正常聊天请求链从 `App.tsx` 抽成共享 runtime service  
2. 再继续收束 `App.tsx` 中的页面级业务  
3. 最后再做更大范围的模块化拆分

不要反过来先大量拆 UI，而不处理聊天主链，因为那样对稳定性帮助有限。

---

## 12. 推荐阅读顺序

如果要快速理解当前项目，建议按这个顺序读：

1. [src/types.ts](/e:/小手机/Bloom/src/types.ts)
2. [src/App.tsx](/e:/小手机/Bloom/src/App.tsx)
3. [src/components/main/MainAppShell/Page.tsx](/e:/小手机/Bloom/src/components/main/MainAppShell/Page.tsx)
4. [src/components/home/HomeScreen/Page.tsx](/e:/小手机/Bloom/src/components/home/HomeScreen/Page.tsx)
5. [src/services/chat/messageActions.ts](/e:/小手机/Bloom/src/services/chat/messageActions.ts)
6. [src/components/dating/DatingModal.tsx](/e:/小手机/Bloom/src/components/dating/DatingModal.tsx)
7. [src/components/dating/DatingScene.tsx](/e:/小手机/Bloom/src/components/dating/DatingScene.tsx)
8. [src/services/ai/prompts/builders/buildChatPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildChatPrompt.ts)
9. [src/services/ai/prompts/builders/buildDatingPrompt.ts](/e:/小手机/Bloom/src/services/ai/prompts/builders/buildDatingPrompt.ts)

这条顺序能最快把：

- 顶层状态
- 页面切换
- 聊天主链
- 约会主链
- 消息操作层

串成一条完整认知路径。
