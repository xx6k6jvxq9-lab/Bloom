# Phase B2 兼容边界

更新时间：2026-05-06
适用范围：`setting / memorySummary` 旧字段退位后的第一批阶段性收口

---

## 1. 这份清单解决什么问题

当前仓库已经把大部分活跃业务链从旧字段读取中拆出来，但还保留少量旧兼容职责：

- 旧角色字段迁移
- 旧导入结构映射
- 旧 schema 保留
- 少量创建/桥接路径上的双写

这份文档的目标不是继续解释蓝图，而是把 **“允许保留旧兼容的边界”** 固定下来，避免旧字段再次回流主链。

---

## 2. 当前允许保留兼容的文件

以下文件属于 **批准保留的兼容边界**：

- `src/services/character/characterCompat.ts`
  - 负责 `corePersona <- setting`
  - 负责 `longTermMemoryProfile <- memorySummary`

- `src/features/persistence/migrateCharacterShape.ts`
  - 负责旧角色字段迁移到新结构

- `src/features/import/importCompat.ts`
  - 负责旧导入数据映射到新字段

- `src/components/main/AddCharacterSheet.tsx`
  - 负责创建/导入角色时同时写入 `setting` 与 `corePersona`

- `src/components/main/MainAppShell/Page.tsx`
  - 负责新好友桥接时保留外部输入的旧字段值

- `src/types.ts`
  - 保留旧字段 schema 定义

- `src/services/dream/dreamRuntimeTypes.ts`
  - 保留梦境 runtime 的旧 schema 字段

除以上边界外，**不允许业务主链继续新增 `character.setting` / `.memorySummary` 直读。**

---

## 3. 自动审计

仓库已提供自动审计脚本：

```bash
npm run audit:legacy-character-fields
```

这条命令会扫描 `src/` 下的源文件：

- 找出新的 `.setting` 旧字段直读
- 找出新的 `.memorySummary` 旧字段直读
- 只允许命中上面列出的兼容边界文件

如果有新的旧字段读取回流到主链，这条命令会直接失败。

---

## 4. 第一批收口完成标准

满足以下条件，就可以认定 `Phase B2` 第一批达到阶段性收口：

1. `npm run audit:legacy-character-fields` 通过
2. `npm run build` 通过
3. forum 主业务链已不再散落直读 `setting / memorySummary`
4. shared use / moments / shell / 轻量 runtime 已切到 `corePersona` 或统一 context
5. 活跃业务链中的旧兼容已集中到固定 compat / migration / import / schema 边界

---

## 5. 手动验收

建议至少做以下人工验证：

1. 论坛：
   - forum runtime profile
   - forum 普通楼回帖
   - 镜间发帖
   - 镜间回帖

2. 壳层与展示：
   - 通讯录角色简介
   - 主聊天列表角色预览

3. 轻互动：
   - moments 自动评论
   - DrawBlocks 小游戏角色风格

4. 角色创建：
   - 手动创建角色
   - PNG 角色卡导入

验收重点不是“有没有新页面”，而是：

- 角色仍然像自己
- 没有因为 `setting` 退位而出现空白人设
- 旧字段没有重新回流业务主链

---

## 6. 下一阶段不要做什么

在这份边界稳定前，不要：

- 新增业务代码直接读取 `character.setting`
- 新增业务代码直接读取 `character.memorySummary`
- 把 compat helper 里的兜底逻辑再扩散回业务 prompt

---

## 7. 下一批候选

第一批收口稳定后，再决定是否进入：

- runtime 硬收口批
  - 评估去掉 `buildCharacterContext` 对 `setting` 的 compat 兜底

- schema / 存储硬清理批
  - 评估删除 `types.ts` 里的旧字段
  - 评估进一步下线 legacy schema / legacy backup 副本
