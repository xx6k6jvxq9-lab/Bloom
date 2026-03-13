# 项目架构说明

## 1. 项目总览

### 项目定位

这个项目是一个“虚拟社交 / 恋爱向 AI 手机应用”。它不是单一聊天机器人页面，而是把 AI 角色互动包装成一个手机壳式应用：用户从桌面首页进入聊天、朋友圈、联系人、世界书、情侣空间、音乐、钱包、论坛、监控与感知等多个子应用，AI 角色在这些子应用里以“联系人 / 恋人 / 群成员 / 朋友圈发布者 / 约会对象 / 一起听歌对象”的形式出现。

项目的产品目标不是“问答型 AI”，而是“具有长期陪伴感、关系连续性、生活化互动感的角色型 AI 应用”。因此，项目的核心价值不只是模型调用本身，而是：

- 角色设定是否稳定
- 多场景互动是否连贯
- 长短期记忆是否可持续
- UI 是否能支撑“手机里真的住着一个人”的错觉

### 核心功能模块

当前已经形成的核心模块有：

1. 聊天主链路
- 私聊对话
- 群聊对话
- AI 回复、流式响应、自动回复
- 语音通话
- 图片 / 位置 / 转账 / 游戏卡片消息

2. AI 角色与记忆系统
- 角色设定
- 世界书
- Mask 身份面具
- 感知设置
- 长期记忆总结 `memorySummary`
- 自动翻译

3. 手机壳与页面系统
- 桌面首页
- 应用切换
- 底部 Tab
- 顶层状态持久化

4. 社交系统
- 联系人 / 好友请求
- 群聊管理
- 朋友圈
- 论坛

5. 情感与陪伴扩展
- 约会弹窗
- 情侣空间
- 一起听歌 / 音乐聊天
- 感知监控

6. 资产与娱乐系统
- 钱包
- 音乐
- 游戏中心与小游戏
- 短信模拟

### 当前整体架构

当前项目还是典型的“单一总装入口 + 若干已拆页面壳”的结构：

- [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) 仍是总控中心
- 根状态、默认数据、持久化、聊天主逻辑仍集中在 `App.tsx`
- 一些相对稳定的 UI 区块已经拆出到 `src/components/`

已经拆分出来的部分：

- 首页桌面：[src/components/home/HomeScreen.tsx](/E:/小手机/Bloom/src/components/home/HomeScreen.tsx)
- 联系人域：[src/components/main/ContactsShell.tsx](/E:/小手机/Bloom/src/components/main/ContactsShell.tsx)
- 主聊天壳层：[src/components/main/MainAppShell.tsx](/E:/小手机/Bloom/src/components/main/MainAppShell.tsx)
- 聊天设置页：[src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)

仍然集中在 `App.tsx` 的大块：

- 顶层 `App` 状态与持久化
- `MomentsApp`
- `ChatSession`
- `AddCharacter`
- `SMSApp`
- `SettingsApp`
- 大多数 AI 主逻辑

### 当前最重要的认知结论

- 这个项目的 UI 已经开始模块化，但 AI 核心仍然集中。
- 真正决定“活人感”和角色一致性的，不是拆出来的页面壳，而是 `App.tsx` 里的 `ChatSession.handleSend` 及其周边链路。
- 后续维护时，应该把“页面结构”和“AI 主逻辑”视作两条不同的整理路线：
  - 页面结构已经开始变得可控
  - AI 主逻辑仍然是最大风险源

---

## 2. 目录结构说明

### 根目录

- [package.json](/E:/小手机/Bloom/package.json)
  - 项目依赖和脚本入口
  - `dev` / `start` 实际通过 [server.ts](/E:/小手机/Bloom/server.ts) 启动
  - `build` 通过 Vite 打包

- [server.ts](/E:/小手机/Bloom/server.ts)
  - Express 开发服务器
  - 提供 Vite middleware
  - 提供 `/api/netease/*` 代理接口

- [vite.config.ts](/E:/小手机/Bloom/vite.config.ts)
  - Vite 配置
  - 注入 `process.env.GEMINI_API_KEY`
  - host/port/HMR 配置

- [index.html](/E:/小手机/Bloom/index.html)
  - Vite 前端入口模板

- [tsconfig.json](/E:/小手机/Bloom/tsconfig.json)
  - TypeScript 配置

- [README.md](/E:/小手机/Bloom/README.md)
  - 基础说明，当前不如本文件完整

- [metadata.json](/E:/小手机/Bloom/metadata.json)
  - 项目元数据，不在主运行逻辑中

### src/

- [src/main.tsx](/E:/小手机/Bloom/src/main.tsx)
  - React 挂载入口

- [src/App.tsx](/E:/小手机/Bloom/src/App.tsx)
  - 当前总装核心

- [src/types.ts](/E:/小手机/Bloom/src/types.ts)
  - 全局类型中心

- [src/utils.ts](/E:/小手机/Bloom/src/utils.ts)
  - 共享工具函数

- [src/index.css](/E:/小手机/Bloom/src/index.css)
  - 全局样式

### src/components/

这个目录是当前大多数子应用和拆分组件所在位置。可以按业务域进一步分：

- `home/`：桌面首页
- `main/`：聊天域壳层、联系人壳层
- `chat/`：聊天设置与游戏卡片
- `games/`：游戏中心与小游戏
- `dating/`：约会弹窗
- 根级组件：音乐、钱包、论坛、情侣空间、监控、自定义、群聊、我的页等

### src/components/chat/

- [src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)
- [src/components/chat/GameCard.tsx](/E:/小手机/Bloom/src/components/chat/GameCard.tsx)

这组文件是聊天域中已经拆出来、边界相对稳定的部分。

### src/components/main/

- [src/components/main/MainAppShell.tsx](/E:/小手机/Bloom/src/components/main/MainAppShell.tsx)
- [src/components/main/ContactsShell.tsx](/E:/小手机/Bloom/src/components/main/ContactsShell.tsx)

这组文件把“聊天主壳层”和“联系人域 UI”从 `App.tsx` 里拆了出来。

### src/components/home/

- [src/components/home/HomeScreen.tsx](/E:/小手机/Bloom/src/components/home/HomeScreen.tsx)

这是第一刀拆分后的桌面首页文件，承接桌面图标、Dock、小组件与头像/心情菜单。

### src/components/games/

- [src/components/games/GameCenter.tsx](/E:/小手机/Bloom/src/components/games/GameCenter.tsx)
- [src/components/games/CardDuel.tsx](/E:/小手机/Bloom/src/components/games/CardDuel.tsx)
- [src/components/games/CouplesQnA.tsx](/E:/小手机/Bloom/src/components/games/CouplesQnA.tsx)
- [src/components/games/RockPaperScissors.tsx](/E:/小手机/Bloom/src/components/games/RockPaperScissors.tsx)
- [src/components/games/Gomoku.tsx](/E:/小手机/Bloom/src/components/games/Gomoku.tsx)
- [src/components/games/TruthOrDare.tsx](/E:/小手机/Bloom/src/components/games/TruthOrDare.tsx)
- [src/components/games/LinkUpGame.tsx](/E:/小手机/Bloom/src/components/games/LinkUpGame.tsx)
- [src/components/games/SnakeGame.tsx](/E:/小手机/Bloom/src/components/games/SnakeGame.tsx)

### 其他重要目录

- [src/components/dating](/E:/小手机/Bloom/src/components/dating)
  - 约会弹窗
- [app](/E:/小手机/Bloom/app)
  - 当前不是前端主链路重点目录

---

## 3. 文件级详细说明

> 本节尽量覆盖当前主链路的重要文件，并说明“如果我要读它，重点看哪里”。

### 3.1 核心入口与基础设施

#### [src/main.tsx](/E:/小手机/Bloom/src/main.tsx)
- 文件用途：React 入口。
- 是否属于主链路：是。
- 主要负责什么：挂载 `App`，加载 `index.css`。
- 依赖哪些文件 / 被哪些文件依赖：依赖 `App.tsx`，没有复杂反向依赖。
- 阅读重点：几乎不需要深入，确认入口即可。

#### [server.ts](/E:/小手机/Bloom/server.ts)
- 文件用途：开发服务器与音乐代理服务。
- 是否属于主链路：是。
- 主要负责什么：
  - 开发模式下启动 Vite middleware
  - 生产模式下托管 `dist`
  - 提供网易云代理接口：
    - `/api/health`
    - `/api/netease/song`
    - `/api/netease/lyric`
    - `/api/netease/song/detail`
    - `/api/netease/playlist`
- 依赖哪些文件 / 被哪些文件依赖：
  - 被 `package.json` 脚本直接使用
  - 被 [MusicApp.tsx](/E:/小手机/Bloom/src/components/MusicApp.tsx) 间接依赖
- 重点看什么：
  - 歌曲 URL 代理逻辑
  - 歌词接口
  - 歌单详情和批量 track 获取逻辑
  - `startServer()` 启动流程

#### [vite.config.ts](/E:/小手机/Bloom/vite.config.ts)
- 文件用途：构建与开发配置。
- 是否属于主链路：是。
- 主要负责什么：
  - React 插件
  - Tailwind Vite 插件
  - 注入 `process.env.GEMINI_API_KEY`
  - 本地开发端口、host、HMR 控制
- 重点看什么：
  - `define.process.env.GEMINI_API_KEY`
  - `server.host/port/strictPort`

#### [src/types.ts](/E:/小手机/Bloom/src/types.ts)
- 文件用途：全局类型中心。
- 是否属于主链路：是。
- 主要负责什么：定义所有关键业务结构。
- 依赖哪些文件 / 被哪些文件依赖：几乎被整个 `src/` 使用。
- 重点看什么：
  - `Character`
  - `ChatMessage`
  - `VisualSettings`
  - `WorldBookEntry`
  - `MusicData`
  - `ChatGroup`
  - `FriendRequest`
  - `WalletData`
  - `DateSession`
- 维护建议：这个文件是理解状态结构的第一入口，后续如果继续拆 `AppData` 或聊天逻辑，应该优先回到这里做类型收束。

#### [src/utils.ts](/E:/小手机/Bloom/src/utils.ts)
- 文件用途：共享工具。
- 是否属于主链路：是。
- 主要负责什么：当前最关键的是图片 URL 提取相关能力。
- 被依赖：`App.tsx`、`ChatSettingsPanel.tsx`、部分视觉/图片输入场景。
- 重点看什么：
  - 图片 URL 提取函数
  - 是否还有和 Markdown / HTML `img` 解析相关的工具

### 3.2 总装层与顶层状态

#### [src/App.tsx](/E:/小手机/Bloom/src/App.tsx)
- 文件用途：项目总装层。
- 是否属于主链路：绝对是。
- 主要负责什么：
  - 顶层状态定义
  - 默认数据与 `localStorage` 迁移/保存
  - 应用页面切换
  - 仍未拆出的页面和聊天主逻辑
- 依赖哪些文件：
  - `types.ts`
  - 已拆出的 `HomeScreen / MainApp / ContactsShell / ChatSettingsPanel`
  - `MusicApp / ForumApp / WalletApp / GroupChatSession / CoupleSpaceApp / CustomizationApp / MonitorApp / DatingModal / GameCenter / GameCard`
- 被哪些文件依赖：`main.tsx`
- 阅读重点：
  1. 顶部默认数据区：`DEFAULT_CHARACTERS`、`DEFAULT_USER`、`DEFAULT_CONFIG`、`DEFAULT_SETTINGS`、`DEFAULT_MOMENTS`
  2. `App` 根组件：加载、持久化、页面切换
  3. `MomentsApp`
  4. `ChatSession`
  5. `AddCharacter`
  6. `SMSApp`
  7. `SettingsApp`

##### App.tsx 顶层默认数据区
- 定义了应用冷启动时的角色、用户、配置、朋友圈内容。
- 这是高风险区，很多中文设定、默认文案、角色开场白都在这里。
- 如果你要理解“这个项目默认打开后是什么状态”，要先看这里。

##### App.tsx 根组件 `App`
- 负责：
  - `activeApp / activeTab / selectedCharacterId / selectedGroupId / selectedForumPostId`
  - `settings` 和 `appData` 的初始化
  - 旧数据迁移
  - `localStorage` 持久化
- 关键 `useEffect`：
  - 时间更新
  - 启动时读取和迁移设置
  - `settings` 保存
  - `appData` 保存
- 这是整个应用真正的状态根。

##### App.tsx 内 `MomentsApp`
- 用途：朋友圈页面。
- 是否主链路：是。
- 负责：
  - 列表显示
  - 发布动态
  - 点赞 / 收藏 / 删除 / 评论
  - 自动生成 AI 动态
  - 评论后 AI 角色回复
- AI 使用点：
  - `handleRefresh`
  - `handleComment`
- 重点看：
  - `handleRefresh`
  - `handlePublish`
  - `handleLike`
  - `handleComment`
- 当前状态：仍在 `App.tsx` 内，尚未独立拆出。

##### App.tsx 内 `AddCharacter`
- 用途：新建角色 / 导入角色。
- 是否主链路：是。
- 负责：
  - 新建角色基础资料
  - 设定和开场白录入
  - 分组归属
  - JSON 导入
- 重点看：
  - `handleSave`
  - `handleImport`
- 特点：
  - 边界相对清晰
  - 是后续很适合继续独立拆出的低风险模块

##### App.tsx 内 `SMSApp`
- 用途：短信模拟页面。
- 是否主链路：是，但相对独立。
- 负责：
  - thread 列表
  - 进入单个短信线程
  - 发送短信消息
- 重点看：
  - `view`
  - `selectedThread`
  - `threads` / `messages`
  - `handleSend`
- 特点：
  - 相对独立，不强依赖 AI 主链路
  - 更像手机壳世界观补充页

##### App.tsx 内 `SettingsApp`
- 用途：API 设置中心。
- 是否主链路：是。
- 负责：
  - API 配置列表
  - 新增 / 编辑 / 删除配置
  - 拉取模型列表
  - 测试连接
- 重点看：
  - `localSettings`
  - `handleSaveConfig`
  - `handleFetchModels`
  - `handleTestConnection`
- AI 相关：
  - 这是 provider 配置入口，不是角色行为控制核心
  - 会直接决定 `handleSend` 用什么 provider / model / temperature

##### App.tsx 内 `ChatSession`
- 用途：聊天详情页和 AI 主控制器。
- 是否主链路：绝对是。
- 负责：
  - 输入和发送
  - 消息渲染
  - prompt 构造
  - AI 请求
  - 自动翻译 / 自动总结
  - 语音通话
  - 转账 / 游戏卡片 / 位置 / 图片等特殊协议
  - 设置页切换
  - 约会、游戏中心、转账弹层等入口
- 重点看：
  - `handleSend`
  - `useEffect(needsReply)`
  - `useEffect(autoTranslate)`
  - `handleVoiceCallAIResponse`
  - 消息列表渲染
  - 协议消息渲染（转账、`[GAME_CARD]`、翻译块）
- 说明：
  - 这是当前全项目最重要也最不适合随意改的区域

### 3.3 已拆分页面壳

#### [src/components/home/HomeScreen.tsx](/E:/小手机/Bloom/src/components/home/HomeScreen.tsx)
- 文件用途：首页桌面。
- 是否属于主链路：是。
- 主要负责什么：
  - 壁纸显示
  - 顶部头像 / 昵称 / 心情条
  - 桌面图标显示与拖拽
  - 小组件显示与拖拽
  - 底部 Dock
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 [src/components/DesktopWidgets.tsx](/E:/小手机/Bloom/src/components/DesktopWidgets.tsx)
  - 被 [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) 依赖
- 重点看：
  - `HomeScreen`
  - `DraggableWidget`
  - `DraggableAppIcon`
  - `AppIcon`
  - `appOrder`、`showAvatarMenu`、`showMoodMenu`
- 当前状态：第一刀已拆出，边界较清晰。

#### [src/components/main/ContactsShell.tsx](/E:/小手机/Bloom/src/components/main/ContactsShell.tsx)
- 文件用途：联系人域与相关弹窗。
- 是否属于主链路：是。
- 主要负责什么：
  - `ContactsApp`
  - `CharacterProfile`
  - `AddFriendModal`
  - `GroupManagementModal`
  - `NavTab`
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `NewFriendsPage.tsx`、`GroupChatManagerPage.tsx`
  - 被 `MainAppShell.tsx` 和 `App.tsx` 依赖
- 重点看：
  - `ContactsApp`：联系人页主体
  - `CharacterProfile`：资料页与发消息/加好友动作
  - 两个 modal 的增删逻辑
- 当前状态：第二刀拆分结果。

#### [src/components/main/MainAppShell.tsx](/E:/小手机/Bloom/src/components/main/MainAppShell.tsx)
- 文件用途：聊天域主壳层。
- 是否属于主链路：是。
- 主要负责什么：
  - `chat / contacts / moments / me` 四个 tab 的壳层切换
  - 聊天列表壳
  - 联系人入口
  - 朋友圈入口
  - 我的页入口
  - 加好友 / 管理分组弹窗开关
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `ContactsShell.tsx`、`MePage.tsx`
  - 通过 prop 注入 `MomentsAppComponent` 和 `formatMessagePreview`
  - 被 `App.tsx` 依赖
- 重点看：
  - `activeTab`
  - `showAddFriend`
  - `showManageGroups`
  - 聊天列表排序和显示逻辑
- 当前状态：第三刀拆分结果。

#### [src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)
- 文件用途：聊天设置页。
- 是否属于主链路：是。
- 主要负责什么：
  - 角色基础资料设置
  - 分组设置
  - 记忆轮数与 token 估算
  - 世界书选择
  - 手动总结
  - 导入导出
  - 贴纸管理
  - 通话记录管理
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `@google/genai`、`extractImageUrls`、`types.ts`
  - 被 `ChatSession` 依赖
- 重点看：
  - token 估算 `useEffect`
  - `handleSummarize`
  - `handleImport`
  - `handleExport`
  - 通话记录批量管理区
- 当前状态：第四刀拆分结果。

### 3.4 关键独立业务页

#### [src/components/MusicApp.tsx](/E:/小手机/Bloom/src/components/MusicApp.tsx)
- 文件用途：当前主链路音乐系统。
- 是否属于主链路：是。
- 主要负责什么：
  - 播放器
  - 歌单页
  - 我的音乐页
  - 一起听 / 邀请角色一起听
  - 音乐聊天
  - 导入网易云歌曲 / 歌单
  - 歌词拉取与展示
  - 队列管理
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `types.ts`
  - 间接依赖 `server.ts` 提供的 `/api/netease/*`
  - 被 `App.tsx` 依赖
- 重点看：
  - `currentMusicData`
  - 播放同步 `useEffect`
  - `handleImportNeteasePlaylist`
  - `sendChatMessage`
  - `renderPlayer / renderPlaylists / renderMe / renderTogetherChat`
- 说明：
  - 这是一个独立复杂域，复杂度不比联系人域低
  - 以后要继续整理时，它值得单独做第二轮文档和边界梳理

#### [src/components/WalletApp.tsx](/E:/小手机/Bloom/src/components/WalletApp.tsx)
- 文件用途：钱包页。
- 是否属于主链路：是。
- 主要负责什么：
  - 银行卡展示
  - 余额与余额宝
  - 交易记录
  - 亲密卡 / 支付密码等钱包附属功能
  - 提供 mock 卡片和交易数据
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `types.ts`
  - 被 `App.tsx` 依赖
  - `MOCK_CARDS` / `MOCK_TRANSACTIONS` 被 `App.tsx` 引用
- 重点看：
  - `MOCK_CARDS`
  - `MOCK_TRANSACTIONS`
  - `updateWalletData`
  - 各类弹层开关 state
- 说明：
  - 聊天转账链路和钱包数据存在间接耦合
  - 即使它是独立页面，也不要把它当作完全无关文件

#### [src/components/ForumApp.tsx](/E:/小手机/Bloom/src/components/ForumApp.tsx)
- 文件用途：论坛页。
- 是否属于主链路：是。
- 主要负责什么：
  - 帖子流
  - 评论
  - 通知
  - 收藏 / 点赞 / 回复
  - 论坛帖子分享到聊天
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `types.ts`
  - 被 `App.tsx` 依赖
- 重点看：
  - 帖子数据组织方式
  - 分享快照如何进入聊天
  - 通知与帖子交互逻辑

#### [src/components/GroupChatSession.tsx](/E:/小手机/Bloom/src/components/GroupChatSession.tsx)
- 文件用途：群聊详情页。
- 是否属于主链路：是。
- 主要负责什么：
  - 群聊消息列表
  - 群成员 AI 回复
  - `@某人` 触发指定角色发言
  - AI 连续接话
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `types.ts`
  - 使用 `GoogleGenAI`
  - 被 `App.tsx` 依赖
- 重点看：
  - `handleSend`
  - `triggerAISpeaker`
  - `systemPrompt`
  - `formatMessagePreview`
- 说明：
  - 这是群聊域单独的一套 AI 对话链路
  - 虽然不像 `ChatSession` 那么复杂，但也不是纯 UI

#### [src/components/CustomizationApp.tsx](/E:/小手机/Bloom/src/components/CustomizationApp.tsx)
- 文件用途：视觉自定义中心。
- 是否属于主链路：是。
- 主要负责什么：
  - 桌面视觉自定义
  - 聊天视觉自定义
  - 主题自定义
  - 数据管理入口
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `DesktopWidgets.tsx`、`extractSingleImageUrl`、`types.ts`
  - 被 `App.tsx` 依赖
- 重点看：
  - `activeTab`
  - `DesktopSettings`
  - `ChatSettings`
  - `ThemeSettings`
  - `DataSettings`
- 说明：
  - 它是视觉设置的主要编辑入口
  - 和 `HomeScreen`、聊天气泡、动态卡片等显示层紧密耦合

#### [src/components/MonitorApp.tsx](/E:/小手机/Bloom/src/components/MonitorApp.tsx)
- 文件用途：监控 / 角色观察页。
- 是否属于主链路：是。
- 主要负责什么：
  - 选择监控对象
  - 查看日记、日程、手机、房间、动态、健康、物品等“观察视图”
  - 角色分类管理
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `PhoneInterface.tsx`
  - 被 `App.tsx` 依赖
- 重点看：
  - `localCharacters`
  - `selectedCharId`
  - `activeTab`
  - `monitorData`
- 说明：
  - 这是世界观强化页，不是 AI 主链路，但会增强“角色真实存在”的感觉

#### [src/components/PhoneInterface.tsx](/E:/小手机/Bloom/src/components/PhoneInterface.tsx)
- 文件用途：监控里的手机界面展示。
- 是否属于主链路：间接是。
- 主要负责什么：承接 `MonitorApp` 里的手机标签视图。
- 重点看：如果监控页展示异常，优先检查它和 `MonitorApp` 的 props 配合。

#### [src/components/CoupleSpaceApp.tsx](/E:/小手机/Bloom/src/components/CoupleSpaceApp.tsx)
- 文件用途：情侣空间。
- 是否属于主链路：是。
- 主要负责什么：
  - 纪念日
  - 留言 / 爱的信件 / 共同日历 / 共笔 / 账本 / 帖子等情侣域内容
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖 `types.ts`
  - 被 `App.tsx` 依赖
- 重点看：
  - `CoupleSpaceData` 对应的各个子区块
  - 资料、帖子、纪念日、共同空间的内部组织
- 说明：
  - 这是另外一个大域，复杂度高，但与聊天主发送链路不是同一核心风险面

#### [src/components/MePage.tsx](/E:/小手机/Bloom/src/components/MePage.tsx)
- 文件用途：我的页。
- 是否属于主链路：是。
- 主要负责什么：
  - 用户资料
  - 收藏消息
  - 角色管理
  - 世界书管理
  - 其他“我的”页聚合功能
- 依赖哪些文件 / 被哪些文件依赖：
  - 被 `MainAppShell.tsx` 使用
  - 还导出 `WorldBookManager` 给 `App.tsx`
- 重点看：
  - 页面分区
  - 世界书管理逻辑
  - 角色增删改入口

### 3.5 约会与游戏

#### [src/components/dating/DatingModal.tsx](/E:/小手机/Bloom/src/components/dating/DatingModal.tsx)
- 文件用途：约会弹窗。
- 是否属于主链路：是。
- 主要负责什么：
  - 设定约会地点、场景、氛围
  - 用 AI 生成约会场景背景和开场白
  - 进入约会聊天模式
  - 保存约会、收藏约会、发送约会内容回聊天
- 依赖哪些文件 / 被哪些文件依赖：
  - 使用 `GoogleGenAI`
  - 被 `App.tsx` 中 `ChatSession` 调起
- 重点看：
  - `handleStartDate`
  - 场景 prompt
  - `messages` 与 `backgroundScene`
  - `onSaveDate` / `onCollectDate`
- 说明：
  - 这是情感域里直接调用 AI 的模块
  - 它有自己的 prompt，但不属于聊天主 prompt 核心

#### [src/components/games/GameCenter.tsx](/E:/小手机/Bloom/src/components/games/GameCenter.tsx)
- 文件用途：游戏中心。
- 是否属于主链路：是。
- 主要负责什么：
  - 展示可玩的小游戏列表
  - 打开具体游戏组件
  - 把游戏结果或互动内容送回聊天
- 依赖哪些文件 / 被哪些文件依赖：
  - 依赖各个 `games/*` 文件
  - 被 `ChatSession` 使用
- 重点看：
  - `GAMES` 配置数组
  - `selectedGame`
  - 各游戏组件切换
- 说明：
  - 游戏中心本身更像路由壳，真正逻辑在子游戏文件里

#### 各个 `games` 文件

- [src/components/games/RockPaperScissors.tsx](/E:/小手机/Bloom/src/components/games/RockPaperScissors.tsx)
  - 用途：猜拳游戏
  - 重点：游戏结果如何通过 `onSendToChat` 回传到聊天

- [src/components/games/TruthOrDare.tsx](/E:/小手机/Bloom/src/components/games/TruthOrDare.tsx)
  - 用途：真心话大冒险
  - 重点：它和聊天里的 `GAME_CARD` 指令格式关联最强

- [src/components/games/CouplesQnA.tsx](/E:/小手机/Bloom/src/components/games/CouplesQnA.tsx)
  - 用途：情侣快问快答
  - 重点：情感域问答和聊天回传

- [src/components/games/Gomoku.tsx](/E:/小手机/Bloom/src/components/games/Gomoku.tsx)
  - 用途：五子棋
  - 重点：棋盘状态和退出回调

- [src/components/games/CardDuel.tsx](/E:/小手机/Bloom/src/components/games/CardDuel.tsx)
  - 用途：卡牌对决
  - 重点：回合结果和聊天回传

- [src/components/games/LinkUpGame.tsx](/E:/小手机/Bloom/src/components/games/LinkUpGame.tsx)
  - 用途：连连看
  - 重点：完成状态和对聊天的反馈

- [src/components/games/SnakeGame.tsx](/E:/小手机/Bloom/src/components/games/SnakeGame.tsx)
  - 用途：贪吃蛇
  - 重点：分数和结束逻辑

这些游戏文件大多不是 AI 核心，但会通过聊天消息、`GAME_CARD` 或 `onSendToChat` 与主链路耦合。

---

## 4. AI 相关专项说明

### 当前项目中哪些地方使用了 AI

#### [src/App.tsx](/E:/小手机/Bloom/src/App.tsx)
1. `MomentsApp.handleRefresh`
- 基于角色设定生成新的朋友圈动态

2. `MomentsApp.handleComment`
- 用户评论朋友圈后，AI 角色自动回复评论

3. `ChatSession.handleSend`
- 主聊天 AI 请求入口
- 整个项目最关键的模型调用链

4. `ChatSession.useEffect(needsReply)`
- 第二套“自动回复”链路

5. `ChatSession.useEffect(autoTranslate)`
- AI 后置翻译链路

6. `ChatSession.handleVoiceCallAIResponse`
- 语音通话场景下的独立 AI 回复链路

7. `SettingsApp.handleFetchModels / handleTestConnection`
- 配置 provider 和模型，不控制角色人格，但控制可用模型来源

#### [src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)
1. `handleSummarize`
- 使用模型对聊天记录做总结
- 写回 `character.memorySummary`

#### [src/components/dating/DatingModal.tsx](/E:/小手机/Bloom/src/components/dating/DatingModal.tsx)
1. `handleStartDate`
- 生成约会背景场景与开场白

#### [src/components/GroupChatSession.tsx](/E:/小手机/Bloom/src/components/GroupChatSession.tsx)
1. `handleSend`
2. `triggerAISpeaker`
- 群聊场景的 AI 发言链路

### 哪些地方是真正控制 AI 行为的核心

只有少数位置真正决定“角色会怎么说话”：

1. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `ChatSession.handleSend`
2. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `ChatSession.useEffect(needsReply)`
3. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `ChatSession.useEffect(autoTranslate)`
4. [src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx) `handleSummarize`

其中真正的“主人格控制器”只有一个：`handleSend`。

### 当前项目里已经写好的 AI 提示词在哪里

1. `ChatSession.handleSend`
- 角色设定 prompt
- mask prompt
- world book prompt
- perception prompt
- memorySummary prompt
- 自动翻译输出格式要求
- 转账协议要求
- `GAME_CARD` 输出格式要求

2. `ChatSession.useEffect(needsReply)`
- 简化版角色回复 prompt

3. `ChatSession.handleVoiceCallAIResponse`
- 语音通话 prompt

4. `MomentsApp.handleRefresh`
- AI 动态生成 prompt

5. `MomentsApp.handleComment`
- AI 朋友圈评论回复 prompt

6. `ChatSettingsPanel.handleSummarize`
- 长期记忆总结 prompt

7. `DatingModal.handleStartDate`
- 约会背景与开场白生成 prompt

### 活人感、角色一致性、记忆、自动翻译、自动总结之间的关系

- 活人感主要取决于：
  - `handleSend` 的 prompt 分层是否清晰
  - 最近对话历史切片是否合理
  - 角色信息、记忆信息、感知信息是否顺序稳定

- 角色一致性主要取决于：
  - `character.setting`
  - `mask`
  - `worldBooks`
  - `memorySummary`
  - `needsReply` 是否和主链路保持一致

- 自动翻译会直接影响最终显示内容：
  - 如果模型本身输出了翻译块，再被 `autoTranslate` 后处理，角色语言风格可能被二次加工
  - 这会削弱“真人说话感”

- 自动总结会影响后续长期人格：
  - `memorySummary` 一旦写差，后续 prompt 就会持续带着错误记忆
  - 所以总结链路对“长期角色稳定性”影响很大，但它的回归不容易立刻被发现

### 如果以后要优化“活人感”，最先应该看哪里

按优先级：

1. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `handleSend`
- 这里决定角色核心人格、近期状态和特殊功能指令如何叠加

2. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `useEffect(needsReply)`
- 它是第二套回复人格来源
- 如果和主链路不一致，角色就容易“分裂”

3. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `useEffect(autoTranslate)`
- 它会修改模型原始输出
- 直接影响语气和角色风格

4. [src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx) `handleSummarize`
- 它定义了长期记忆写回质量

5. [src/types.ts](/E:/小手机/Bloom/src/types.ts)
- `Character / WorldBookEntry / PerceptionSettings / ChatMessage`
- 类型层定义了系统能表达哪些稳定角色信息

---

## 5. AI 调用链与提示词主链路说明

### 用户发送消息后，主调用链如何流转

标准私聊链路大致是：

1. 用户在 `ChatSession` 输入内容
2. `handleSend` 触发
3. 先构造用户消息并写入历史
4. 从当前角色、世界书、Mask、感知设置、长期记忆中收集上下文
5. 组装 system prompt / 历史上下文 / 特殊功能指令
6. 根据当前 provider 分支选择 Gemini 或自定义接口逻辑
7. 发起模型请求
8. 流式或完整读取模型返回
9. 解析输出中的普通文本、翻译块、`GAME_CARD`、转账等协议内容
10. 把模型消息写入历史
11. 如果满足条件，触发自动总结并写回 `memorySummary`
12. 之后 `autoTranslate` 可能再次扫描并修改 model 消息文本

### handleSend 如何拼装 prompt

`handleSend` 是当前最核心的 prompt 构造器。它实际会组合这些层：

1. 角色核心设定
- `character.setting`
- 这是角色人格基础

2. Mask
- 如果角色挂了激活中的 mask，会附加“用户身份面具 / 世界背景 / 关系设定”

3. World Book
- 会把生效的世界书条目拼进 prompt
- 包括全局世界书和角色绑定世界书

4. Perception
- 如果开启感知，会把时间 / 地点 / 天气 / 气候等虚拟现实条件写进 prompt
- 这块会强烈影响角色当前说话方式

5. 长期记忆
- 如果有 `memorySummary`，会作为历史压缩记忆注入

6. 最近聊天历史
- 使用 `history.slice(...)` 取近期消息作为短期上下文

7. 特殊功能指令
- 自动翻译输出格式要求
- 转账格式要求
- 游戏卡片输出格式要求

### needsReply 为什么是第二套链路

`needsReply` 不是简单地“调用 `handleSend`”。
它是单独的 `useEffect`，内部又重新拼了一次 AI 请求上下文。

这意味着：

- 它和 `handleSend` 不是同一个单一事实来源
- 一旦一边 prompt 更新、一边没更新，就会出现角色行为不一致
- 某些消息走“主人格”，某些消息走“简化人格”

这就是为什么它被视为当前项目最重要的耦合风险之一。

### autoTranslate 如何影响最终输出

自动翻译目前是双轨存在：

1. `handleSend` 中可以要求模型直接输出带 `---TRANSLATION---` 的结果
2. `useEffect(autoTranslate)` 会对历史里的 model 消息做后置翻译

后置翻译的影响是：

- 它会修改已经生成好的模型消息文本
- 可能把角色原本的语言风格再加工一遍
- 还要绕开转账消息、`GAME_CARD` 消息等特殊协议

因此它虽然不是“发送入口”，但它直接影响用户最终看到的内容，也是活人感的重要变量。

### handleSummarize 和自动总结如何写回 memorySummary

有两条总结链路：

1. 手动总结
- 在 [ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx) 的 `handleSummarize`
- 用户主动触发后，模型总结历史聊天并把结果写到 `character.memorySummary`

2. 自动总结
- 在 `ChatSession.handleSend` 尾部
- 当达到一定条件时自动生成总结并写回同一个字段

这意味着：

- `memorySummary` 是聊天主链路和设置页共同写入的共享长期记忆
- 如果自动总结质量差，会污染后续 prompt
- 如果手动总结和自动总结风格不一致，也会让角色记忆变得不稳定

### 哪些地方最影响活人感和角色一致性

真正影响最大的不是 UI，而是这 5 个点：

1. `handleSend` 的 prompt 层级顺序
2. `needsReply` 是否和 `handleSend` 保持一致
3. `autoTranslate` 是否改变了角色原话风格
4. `memorySummary` 的质量
5. 最近历史切片是否保留了足够的短期连续性

结论很明确：

- 如果以后只做一处 AI 优化，最值得先动的是 `handleSend` 里的 system prompt 结构，而不是更多 UI 或更多功能开关。

---

## 6. 重点文件阅读建议

如果是第一次接手，建议按下面顺序阅读：

1. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx)
- 原因：它是总地图，也是 AI 主链路所在。

2. [src/types.ts](/E:/小手机/Bloom/src/types.ts)
- 原因：先理解数据结构，后面读 UI 和 AI 才不会混乱。

3. [src/components/main/MainAppShell.tsx](/E:/小手机/Bloom/src/components/main/MainAppShell.tsx)
- 原因：理解聊天域外壳和 tab 切换。

4. [src/components/main/ContactsShell.tsx](/E:/小手机/Bloom/src/components/main/ContactsShell.tsx)
- 原因：理解联系人、资料页、好友和群聊管理。

5. [src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)
- 原因：理解记忆设置、世界书、总结、导入导出。

6. [src/components/home/HomeScreen.tsx](/E:/小手机/Bloom/src/components/home/HomeScreen.tsx)
- 原因：理解首页、视觉与拖拽布局。

7. [src/components/MePage.tsx](/E:/小手机/Bloom/src/components/MePage.tsx)
- 原因：世界书和“我的”页聚合很重要。

8. [src/components/MusicApp.tsx](/E:/小手机/Bloom/src/components/MusicApp.tsx)
- 原因：这是一个复杂的独立业务域。

9. [src/components/ForumApp.tsx](/E:/小手机/Bloom/src/components/ForumApp.tsx)
- 原因：论坛与聊天分享存在跨域耦合。

10. [server.ts](/E:/小手机/Bloom/server.ts)
- 原因：音乐导入和代理接口问题都要回到它。

---

## 7. 高风险区域 / 不建议乱动的区域

### 最关键、最容易改坏的文件或函数

1. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `ChatSession.handleSend`
2. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `ChatSession.useEffect(needsReply)`
3. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `ChatSession.useEffect(autoTranslate)`
4. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) 聊天消息渲染区
5. [src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx) `handleSummarize`
6. [src/components/MusicApp.tsx](/E:/小手机/Bloom/src/components/MusicApp.tsx) 播放和网易云导入链路
7. [src/components/GroupChatSession.tsx](/E:/小手机/Bloom/src/components/GroupChatSession.tsx) 群聊 AI 对话链路

### 当前耦合度高的地方

- `App.tsx`：根状态、页面切换、默认数据、旧数据迁移、主聊天逻辑都在一起
- `ChatSession`：UI、AI、翻译、总结、协议、语音、转账、游戏、图片、位置混合
- `MusicApp.tsx`：播放器、队列、一起听、聊天、导入、歌词等混合
- `CustomizationApp.tsx`：桌面、聊天、主题、数据管理混合在一页

### 哪些地方已经拆出来了，哪些地方还没拆

已经拆出来：
- 首页桌面
- 联系人域
- 主聊天壳层
- 聊天设置页

还没拆出来：
- `MomentsApp`
- `AddCharacter`
- `SMSApp`
- `SettingsApp`
- `ChatSession`
- 大部分 AI service / parser / prompt builder

### 哪些地方属于历史残留或过渡结构

- `App.tsx` 里仍然保留大量集中式旧逻辑
- 自动翻译存在双策略并存
- `needsReply` 仍是第二套回复链路
- `Moment.isLiked` 仍是 deprecated 兼容字段
- 一些 props 目前更像预留接口
- 部分视觉和数据结构已拆页面，但类型和根状态还没完全收束

---

## 8. 当前项目剩余耦合点与历史包袱

### App.tsx 还剩哪些大块没拆

1. `MomentsApp`
2. `ChatSession`
3. `AddCharacter`
4. `SMSApp`
5. `SettingsApp`
6. 顶层默认数据与持久化迁移

其中真正的大块风险只有两个：

- `App` 根状态与持久化
- `ChatSession`

### 哪些结构是过渡状态

1. `MainAppShell` 已拆，但 `MomentsApp` 还在 `App.tsx`
- 现在通过 prop 注入或根层调用保持连接
- 这是过渡态，不是最终结构

2. `ChatSettingsPanel` 已拆，但聊天主发送逻辑还在 `App.tsx`
- 设置层和发送层已经分开
- 但 AI 逻辑仍然集中在原文件

3. `ContactsShell` 已拆，但部分 props 是预留接口态
- 例如 `onOpenChat` / `onAddFriend`
- 不是错误，但还没完全收边界

4. 自动翻译和自动回复仍是双轨
- 这不是理想架构，更像演进中的保留结构

### 哪些地方后续最适合继续重构

优先级建议：

1. `ChatSession` 的 prompt / request / parse 层
- 这是收益最高的重构方向
- 不一定先拆 UI，而是先抽逻辑层

2. `MomentsApp`
- 它边界比较清楚，适合继续拆成独立文件

3. `AddCharacter`、`SMSApp`、`SettingsApp`
- 这几个都属于可控的页面块
- 从 `App.tsx` 中继续拆出风险不高

4. `AppData` / 顶层状态类型的全局化
- 当前很多地方还在用最小本地类型补丁
- 后续要提升维护性，这一步迟早要做

---

## 9. 当前项目维护建议

### 现阶段最适合继续整理哪里

按收益排序：

1. 优先整理 AI 主逻辑
- 不是继续切小 UI，而是整理 `handleSend`、`needsReply`、`autoTranslate`、`memorySummary`

2. 再补文档 / 注释 / 边界说明
- 当前最缺的是“哪里是真正主链路，哪里只是入口壳”的文档

3. 再继续拆剩余稳定页面块
- `MomentsApp`
- `AddCharacter`
- `SMSApp`
- `SettingsApp`

### 继续拆文件、清理残留，还是先优化 AI 主逻辑

当前建议是：

- 不要再优先拆 `ChatSession` 的细碎 UI
- 也不要先大面积清理中风险残留
- 最值得优先投入的是：AI 主逻辑整理

原因：

- 页面壳层已经有一定拆分成果
- 最大复杂度仍在 `ChatSession`
- 用户体验里“活人感 / 不 OOC / 不重复翻译 / 记忆稳定”比“再多拆一个弹窗文件”更重要

### 哪些文件应该优先补文档、补注释、补边界说明

1. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx)
- 需要补：模块边界、主状态分区、AI 主链路说明

2. [src/components/chat/ChatSettingsPanel.tsx](/E:/小手机/Bloom/src/components/chat/ChatSettingsPanel.tsx)
- 需要补：哪些是记忆功能，哪些是资料功能，哪些是通话记录管理

3. [src/components/MusicApp.tsx](/E:/小手机/Bloom/src/components/MusicApp.tsx)
- 需要补：播放 / 导入 / 一起听 / 音乐聊天的边界

4. [src/components/CoupleSpaceApp.tsx](/E:/小手机/Bloom/src/components/CoupleSpaceApp.tsx)
- 需要补：内部子模块和数据结构说明

5. [server.ts](/E:/小手机/Bloom/server.ts)
- 需要补：网易云代理接口的用途与调用来源

---

## 10. 后续维护的实操建议

如果以后继续维护，建议按下面节奏做：

### 第一阶段：稳住 AI 主链路
- 只分析并整理 `handleSend` 的 prompt 分层
- 明确 `needsReply` 和主链路的关系
- 明确自动翻译双策略到底保留哪一套

### 第二阶段：继续拆稳定页面块
- 拆 `MomentsApp`
- 拆 `AddCharacter`
- 拆 `SMSApp`
- 拆 `SettingsApp`

### 第三阶段：收拢共享类型和逻辑服务
- 抽 `AppData` 全局类型
- 抽 prompt builder
- 抽 provider adapter
- 抽 response parser
- 抽 translation / summary service

### 第四阶段：清理中风险残留
- 预留 props
- 历史兼容字段
- 旧式注释
- 弱使用 state

在这四步里，真正最有产品收益的是第一步。
因为这个项目最终不是一个“拆文件比赛”，而是一个角色型 AI 应用；只要角色一致性和活人感没有稳定下来，结构再干净也只是代码层收益。

---

## 11. 页面切换与顶层状态流说明

这一节的目标是把“这个项目到底怎么切页面、怎么记住当前上下文对象”讲清楚。  
如果第一次接手项目，建议把这一节和 [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) 一起看，把它当作整个应用的阅读路线图。

### 顶层页面切换是如何工作的

当前项目没有引入独立路由系统，页面切换主要由 [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) 里的顶层 state 手动控制。

最核心的顶层状态有：

#### `activeApp`
- 用途：控制“当前打开的是哪一个一级页面或子应用”。
- 这是整个手机应用的一级路由状态。
- 典型值对应的页面包括：
  - `home`
  - `chat`
  - `settings`
  - `sms`
  - `worldbook`
  - `monitor`
  - `customization`
  - `couple-space`
  - `perception`
  - `music`
  - `forum`
  - `wallet`
  - 以及聊天详情、群聊详情、论坛详情等需要上下文对象的页面状态

理解方式：
- `activeApp` 决定“当前显示哪一个页面组件”
- 它是项目最外层的页面开关

#### `activeTab`
- 用途：控制聊天主壳层内部的 tab 切换。
- 它只在聊天主壳层里有意义，不是整个 App 的总路由。
- 当前主要对应：
  - `chat`
  - `contacts`
  - `moments`
  - `me`

理解方式：
- `activeApp` 负责“我现在是在首页、聊天、论坛还是钱包”
- `activeTab` 负责“我已经进入主聊天壳层后，当前看的是聊天列表、联系人、动态还是我的”

#### `selectedCharacterId`
- 用途：记录当前选中的角色。
- 当用户从聊天列表或联系人页进入某个角色时，这个 state 会决定 `ChatSession` 或资料页当前绑定的是谁。
- 它属于“当前上下文对象”状态，而不是页面本身。

#### `selectedGroupId`
- 用途：记录当前选中的群聊。
- 当用户进入群聊详情页时，这个 state 决定当前群聊上下文。
- 同样属于“上下文对象状态”。

#### `selectedForumPostId`
- 用途：记录当前选中的论坛帖子。
- 用来让论坛页或帖子详情页知道现在要展示哪一篇帖子。
- 这类状态通常只在某些跳转路径下起作用，所以容易被误判为弱使用状态。

#### 其他关键顶层状态

- `settings`
  - AI provider、模型、温度等配置中心
  - 会直接影响聊天主链路调用哪个模型

- `appData`
  - 当前应用的主业务数据容器
  - 里面包含：
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
  - 它既是 UI 数据源，也是 AI 上下文来源之一

- `time`
  - 手机壳顶部时间显示
  - 不控制业务页面，但属于全局展示状态

### 从桌面首页进入各个页面的大致流转

桌面首页来自 [src/components/home/HomeScreen.tsx](/E:/小手机/Bloom/src/components/home/HomeScreen.tsx)。  
它本身不持有真正的页面导航状态，而是通过 `onOpenApp` 把动作回传给 [src/App.tsx](/E:/小手机/Bloom/src/App.tsx)。

典型流转路径如下：

#### 首页 → 主聊天壳层
1. 用户点击桌面聊天图标
2. `HomeScreen` 触发 `onOpenApp('chat')`
3. `App.tsx` 更新 `activeApp`
4. 渲染 [src/components/main/MainAppShell.tsx](/E:/小手机/Bloom/src/components/main/MainAppShell.tsx)
5. `MainAppShell` 再根据 `activeTab` 决定显示聊天列表、联系人、动态还是我的

#### 首页 → 设置
1. 点击桌面设置 / API 中心图标
2. `onOpenApp('settings')`
3. `App.tsx` 切到 `SettingsApp`
4. 进入 API 配置列表和编辑页

#### 首页 → 世界书
1. 点击世界书图标
2. `onOpenApp('worldbook')`
3. `App.tsx` 渲染 `WorldBookManager`

#### 首页 → 音乐
1. 点击音乐图标
2. `onOpenApp('music')`
3. 同时 `HomeScreen` 还会对 `appData.musicData.isPlaying` 做一次切换
4. `App.tsx` 渲染 [src/components/MusicApp.tsx](/E:/小手机/Bloom/src/components/MusicApp.tsx)

#### 首页 → 钱包
1. 点击钱包图标或 Dock 中的钱包按钮
2. `onOpenApp('wallet')`
3. `App.tsx` 渲染 [src/components/WalletApp.tsx](/E:/小手机/Bloom/src/components/WalletApp.tsx)

#### 首页 → 论坛
1. 点击论坛图标
2. `onOpenApp('forum')`
3. `App.tsx` 渲染 [src/components/ForumApp.tsx](/E:/小手机/Bloom/src/components/ForumApp.tsx)

#### 首页 → 情侣空间
1. 点击情侣空间图标
2. `onOpenApp('couple-space')`
3. `App.tsx` 渲染 [src/components/CoupleSpaceApp.tsx](/E:/小手机/Bloom/src/components/CoupleSpaceApp.tsx)

#### 首页 → 监控 / 感知

监控：
1. 点击监控图标
2. `onOpenApp('monitor')`
3. `App.tsx` 渲染 [src/components/MonitorApp.tsx](/E:/小手机/Bloom/src/components/MonitorApp.tsx)

感知：
1. 点击感知图标
2. `onOpenApp('perception')`
3. `App.tsx` 渲染 [src/components/PerceptionView.tsx](/E:/小手机/Bloom/src/components/PerceptionView.tsx)

### 聊天域内部页面流转

聊天域是这个项目最容易让人迷路的部分，因为它不是单页，而是“壳层 + 列表 + 详情 + 设置”的组合。

#### MainAppShell 四个 tab 如何切换

[src/components/main/MainAppShell.tsx](/E:/小手机/Bloom/src/components/main/MainAppShell.tsx) 内部通过 `activeTab` 切换四个区域：

- `chat`：聊天列表和群聊列表
- `contacts`：联系人页
- `moments`：朋友圈页
- `me`：我的页

切换方式：
- 顶层 `App.tsx` 把 `activeTab` 和 `setActiveTab` 传入 `MainApp`
- `MainApp` 的底部 `NavTab` 点击后更新 `activeTab`
- 壳层内部重新切换内容区域，但 `activeApp` 仍然保持在聊天域

#### 联系人页如何进入角色资料页

流转路径：
1. 进入 `MainAppShell`
2. 切到 `contacts` tab
3. 渲染 `ContactsApp`
4. 点击联系人卡片
5. 触发 `onOpenProfile(characterId)`
6. `App.tsx` 更新“当前页面 + 当前角色上下文”
7. 渲染 `CharacterProfile`

这里的关键点是：
- 页面切换由 `App.tsx` 控制
- 当前角色对象由 `selectedCharacterId` 控制

#### 聊天列表如何进入 ChatSession

流转路径：
1. 进入 `MainAppShell`
2. 默认或切到 `chat` tab
3. 点击某个角色会话卡片
4. 调用 `onOpenChat(characterId)`
5. `App.tsx` 设置 `selectedCharacterId`
6. 同时把一级页面切到聊天详情态
7. 渲染 `ChatSession`

#### 群聊如何进入 GroupChatSession

流转路径：
1. 在聊天列表中点击群聊项
2. 调用 `onOpenGroupChat(groupId)`
3. `App.tsx` 设置 `selectedGroupId`
4. 切换到群聊详情态
5. 渲染 [src/components/GroupChatSession.tsx](/E:/小手机/Bloom/src/components/GroupChatSession.tsx)

#### ChatSession 如何进入 ChatSettingsPanel

流转路径：
1. 用户在聊天详情页点击设置入口
2. `ChatSession` 内部设置 `showSettings = true`
3. `ChatSession` 并不离开当前角色上下文
4. 它直接在内部 `return <ChatSettingsPanel ... />`
5. 设置页结束后通过 `onBack` 回到聊天详情页

这意味着：
- `ChatSettingsPanel` 不是由 `activeApp` 控制的一级页面
- 它是聊天详情页内部的“局部页面切换”
- 当前聊天对象还是同一个 `character`

### 哪些状态控制“页面切换”，哪些状态控制“当前上下文对象”

这是整个项目最重要的阅读原则之一。

#### 页面级状态

这些状态决定“现在显示哪个页面”：

- `activeApp`
- `activeTab`
- `showSettings`（仅在 `ChatSession` 内部）
- 其他局部 `showXxxModal / showXxxPanel / view`

#### 当前上下文对象状态

这些状态决定“当前页面正在看谁 / 哪个对象 / 哪个帖子”：

- `selectedCharacterId`
- `selectedGroupId`
- `selectedForumPostId`
- `activeConfigId`
- `character.activeWorldBookIds`
- 聊天页当前 `character`
- 群聊页当前 `group`

可以把它理解为：

- 页面级状态回答：我现在在哪一页？
- 上下文状态回答：我现在正在看谁、和谁说话、处理哪个对象？

### 阅读路线图建议

如果你想快速理解页面流转，推荐按这个顺序看：

1. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) 顶层 state 定义
2. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `App` 根组件里的页面分发
3. [src/components/home/HomeScreen.tsx](/E:/小手机/Bloom/src/components/home/HomeScreen.tsx) 的 `onOpenApp`
4. [src/components/main/MainAppShell.tsx](/E:/小手机/Bloom/src/components/main/MainAppShell.tsx) 的 `activeTab`
5. [src/components/main/ContactsShell.tsx](/E:/小手机/Bloom/src/components/main/ContactsShell.tsx) 的 `onOpenProfile`
6. [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) 的 `ChatSession` 和 `GroupChatSession` 调用入口

看完这 6 个点，项目的页面结构基本就不会迷路了。

---

## 12. AI 调用链最短路径说明

这一节只聚焦“从用户发消息到模型回来的最短主链路”，不展开所有 UI 和支线功能。

### 用户发送一条聊天消息后，AI 调用链如何流转

最短路径如下：

#### 第一步：输入进入哪里

用户在 [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) 的 `ChatSession` 底部输入框里输入文本。

相关状态通常包括：
- `input`
- `replyingTo`
- `isLoading`
- `error`

当用户点击发送或某些旁路入口触发发送时，会进入：

- `handleSend`

#### 第二步：进入 `handleSend`

`handleSend` 是当前私聊 AI 主链路的核心入口。

它会先做这些事：

1. 检查输入是否合法、是否正在加载
2. 生成用户消息对象并写入 `history`
3. 处理特殊 overrideText / locationData 之类的旁路输入
4. 清空输入态或重置相关 UI 状态

这一步还没真正调用模型，但已经确定了一次完整对话回合的起点。

#### 第三步：prompt / context 拼装

这是 `handleSend` 最关键的部分。

它会收集和拼装这些信息：

1. 角色核心设定
- `character.setting`

2. mask
- 当前激活且绑定到角色的 mask
- 包含 personality / occupation / relationship / world background

3. world book
- 当前角色可见或激活的世界书条目

4. perception
- 时间、地点、天气、气候等虚拟现实条件

5. memory summary
- `character.memorySummary`

6. 最近聊天历史
- 最近若干轮对话切片

7. 特殊功能指令
- 自动翻译格式要求
- 转账格式要求
- `GAME_CARD` 输出格式要求

这一步实际上决定了：
- 模型会不会 OOC
- 会不会像真人
- 会不会被功能性指令压过人格

#### 第四步：provider 选择

拼好 prompt 之后，`handleSend` 会根据当前配置决定走哪条 provider 路径。

当前大致存在两类：

1. Gemini 路径
- 使用 `GoogleGenAI`
- 直接请求 Gemini 模型

2. 自定义 provider 路径
- 走自定义接口 / OpenAI 风格接口
- 适配 `baseUrl / model / apiKey`

这里的 provider 选择本身不决定人格，但决定：
- 请求格式
- 是否流式
- 某些特殊参数是否可用

#### 第五步：响应解析

模型返回后，`handleSend` 会把结果解析并写入聊天历史。

解析时不只是“拿 text 直接显示”，还要处理：

- 普通文本
- `---TRANSLATION---`
- `[GAME_CARD] ...`
- 转账格式
- 流式增量拼接

也就是说，响应解析本身就是聊天主逻辑的一部分，不只是 UI 层。

#### 第六步：自动翻译

主发送完成后，`useEffect(autoTranslate)` 还可能再介入一次。

它会：
- 扫描 `history`
- 找到需要翻译的 model 消息
- 调用模型生成翻译
- 把翻译结果再写回 `history`

因此它属于：
- 不是前处理
- 是**后处理**

这很重要，因为它说明：
- 用户最终看到的文本，可能不是模型第一次原始输出
- 最终显示结果会被后置逻辑二次加工

#### 第七步：自动总结

在 `handleSend` 末尾，如果达到条件，会触发自动总结。

自动总结做的事是：
- 根据一定轮数 / 记忆阈值
- 把历史消息压缩成总结文本
- 写回 `character.memorySummary`

这一写回不会马上显得“出 bug”，但会影响下一轮 prompt。

#### 第八步：memory 写回

最终长期记忆的核心字段是：

- `character.memorySummary`

它会被：
- 自动总结写入
- 设置页手动总结写入

这意味着长期人格并不是只读设定，而是一个会演化的字段。

### `needsReply` 这条链路和主发送链路的关系

`needsReply` 是第二套回复链。

它的特点是：
- 不是调用 `handleSend`
- 而是一个独立 `useEffect`
- 内部重新做了一次 prompt / AI 请求 / 回复写回

这也是它危险的原因：

1. 它和 `handleSend` 不是同一逻辑源
2. 一处改 prompt，另一处可能不跟
3. 主链路和自动链路可能表现出两种角色人格

所以它非常容易造成：
- 角色行为分叉
- 同一个角色在不同触发条件下像两个人
- 某些消息很“正常”，某些消息突然很工具人

### `autoTranslate` 如何插入到最终显示结果中

`autoTranslate` 是后处理，不是前处理。

它的插入位置是：

1. 模型先按主链路生成消息
2. 消息已经写入 `history`
3. `useEffect(autoTranslate)` 扫描这些历史消息
4. 再次调用模型生成翻译
5. 把翻译结果拼进或覆盖到最终显示文本

为什么它会影响活人感和语言风格一致性：

1. 它会改变模型原本的措辞节奏
2. 它会把“角色原声”变成“角色原声 + 解释层”
3. 它和主 prompt 中的翻译指令并存时，容易出现双重加工

这就是为什么自动翻译不是一个简单附加功能，而是角色表现层的一部分。

### `handleVoiceCallAIResponse` 属于哪条链

它属于语音通话链，不属于普通聊天主发送链。

#### 与主聊天 AI 链路共享的内容

- 共享角色设定 `character.setting`
- 共享当前 provider / model / API key
- 共享同一个角色对象

#### 与主聊天 AI 链路不共享的内容

- 不复用 `handleSend`
- 不复用完整 system prompt 结构
- 不完整共享聊天历史切片
- 不走同样的自动翻译 / 自动总结链

#### 为什么它可能导致“通话里的角色”和“聊天里的角色”不一致

因为它是一条更短、更轻的 prompt 链：

- 主聊天：人格 + world book + memory + perception + 特殊功能
- 语音通话：更像“角色设定 + 最近一句话 + 简短回复”

结果就是：
- 通话角色可能更松散
- 聊天角色可能更受约束
- 两边的说话风格容易分叉

### 朋友圈 AI、总结 AI、聊天 AI 之间的区别

#### 聊天 AI

代表位置：
- `ChatSession.handleSend`
- `needsReply`

作用：
- 真正决定角色人格和陪伴感
- 是“人格型 AI”

#### 总结 AI

代表位置：
- `ChatSettingsPanel.handleSummarize`
- `handleSend` 自动总结

作用：
- 不是直接和用户对话
- 而是写长期记忆
- 是“记忆维护型 AI”

#### 朋友圈 AI

代表位置：
- `MomentsApp.handleRefresh`
- `MomentsApp.handleComment`

作用：
- 生成功能性内容
- 增强生活化氛围
- 更接近“场景型 AI”而不是“主人格控制器”

结论可以这样理解：

- 聊天 AI：真正影响角色人格
- 总结 AI：间接影响角色人格
- 朋友圈 AI：主要影响世界感和生活感

### 《如果以后只优化活人感，最小改动入口在哪里》

#### 第一优先看哪里

第一优先：
- [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `ChatSession.handleSend`

原因：
- 它是主人格 prompt 的唯一主入口
- 改动最集中
- 对角色一致性收益最大

建议优先做的不是“加更多设定”，而是：
- 把已有 prompt 重新分层
- 明确角色核心层、状态层、功能层的顺序

#### 第二优先看哪里

第二优先：
- [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `useEffect(needsReply)`
- [src/App.tsx](/E:/小手机/Bloom/src/App.tsx) `useEffect(autoTranslate)`

原因：
- 一个是第二套回复人格来源
- 一个是最终语言风格后处理来源

#### 哪些地方先不要动

先不要动：

1. 语音通话 UI
- 因为它不是人格核心，先动收益不高

2. 朋友圈 AI
- 它主要是氛围增强，不是主人格控制器

3. 游戏中心和小游戏
- 这些不是活人感的核心来源

4. 先不要通过“继续拆更多 UI 文件”来解决活人感问题
- 结构整理是必要的
- 但它不能替代 prompt 主链路优化

如果以后只允许做一次最小改动，我会建议：

1. 只先整理 `handleSend` 的 prompt 结构
2. 明确 `needsReply` 是否复用同一套 prompt builder
3. 暂时不要先碰 `autoTranslate` 的实现策略，先把它的影响边界标清楚
