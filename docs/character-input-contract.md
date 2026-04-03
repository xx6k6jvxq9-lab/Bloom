# Bloom 角色输入 Contract（当前阶段版）

更新时间：2026-04-03
适用阶段：平台化收口期 / Phase B -> Phase C 过渡阶段
定位：角色输入分层、读取规则、优先级和覆盖边界清单

---

## 1. 总目标

当前目标不是回退到旧 `setting` 全文直塞，而是：

**原文保留 + 自动拆层 + 分层常驻 + 条件读取 + 本轮快照治理。**

这份 contract 解决的是：

- 用户写进去的完整角色信息是否完整收下
- 新骨架里角色是否还能保持活人感
- 各场景默认该读哪些层
- 预算治理时优先保什么、后压什么

---

## 2. 输入分层

### 2.1 Raw Persona Archive

完整保存用户输入的角色原文，不做损失性裁剪。

作用：

- 保留完整人设资产
- 作为后续拆层、重整、纠错的原始依据
- 不直接作为每轮 prompt 主输入

### 2.2 Structured Persona Layers

正式给系统消费的角色资产层，当前阶段拆为四块。

#### A. Core Persona

角色最稳定、最核心、需要高频常驻的部分。

包含：

- 性格核心
- 对用户的基础态度
- 核心气质
- 基础关系姿态
- 核心边界

#### B. Expression Style

角色“人味层”，当前阶段必须单独治理。

包含：

- 说话节奏
- 语气松紧
- 嘴硬 / 温柔比例
- 常见小动作
- 经典反应方式
- 亲密 / 疏离时的表达差异

#### C. Extended Lore

扩展设定层，不要求每轮完整常驻，但必须保留可读。

包含：

- 背景经历
- 世界观绑定
- 复杂关系背景
- 长设定补充

#### D. Boundary Pack

刚性边界层，优先级高于普通扩展信息。

包含：

- 明确禁忌
- 不该突破的表达边界
- 不该编造的记忆
- 不该违背的角色原则

### 2.3 Recall Layer

不再写一份新角色，而是为角色资产建立场景读取索引。

当前阶段先做轻量读取矩阵，不上复杂召回器。

建议索引维度：

- `core`
- `expression`
- `boundary`
- `backstory`
- `worldview`
- `group_scene`
- `dating_scene`
- `public_expression`

### 2.4 Snapshot Layer

只决定“这一轮真正带什么”，不决定“角色是谁”，也不删除底层资产。

---

## 3. 默认读取规则

### 3.1 单聊

默认常驻：

- `Core Persona`
- `Expression Style` 精简版
- `Boundary Pack`
- `User Mask`
- `shortTermSummary`
- `longTermMemoryProfile`

按需读取：

- `Extended Lore`
- `World Book`
- `sceneHints.chat`

### 3.2 群聊

默认常驻：

- `Core Persona`
- `Expression Style` 群聊版
- `Boundary Pack`
- `shortTermSummary`
- `longTermMemoryProfile`

按需读取：

- `sceneHints.groupChat`
- 与群聊相关的扩展设定

约束：

- 群聊不应直接照搬私密单聊质地
- 群聊表达允许保留角色差异，但应避免过度私密化

### 3.3 约会

默认常驻：

- `Core Persona`
- `Expression Style`
- `Boundary Pack`
- `shortTermSummary`
- `longTermMemoryProfile`

按需读取：

- `Extended Lore`
- `sceneHints.dating`
- 最近关系余波
- 与约会有关的关系事件

### 3.4 Couple-space

默认常驻：

- `Core Persona`
- `Expression Style`
- `Boundary Pack`
- `longTermMemoryProfile`

按需读取：

- 最近聊天余波
- 最近情侣空间事件
- 与当前子场景相关的扩展上下文

约束：

- 只能读取属于当前角色边界内的关系痕迹
- 不允许把别的角色的 couple-space 痕迹串进来

---

## 4. 覆盖规则

### 4.1 不能互相覆盖的部分

- `Core Persona` 不允许被 `User Mask` 改写
- `Memory` 不允许替代角色本体设定
- `World Book` 不允许覆盖角色核心人格
- `sceneHints` 只补充当前场景，不重写角色是谁
- `Extended Lore` 不允许覆盖 `Boundary Pack`

### 4.2 允许影响但不替代的部分

- `User Mask` 可以影响角色怎么看用户，但不改写角色本体
- `shortTermSummary` 可以影响当前轮气氛，但不改写长期人格
- `longTermMemoryProfile` 可以影响关系延续，但不替代原生人设

---

## 5. 当前阶段默认优先级

当前阶段默认优先级从高到低为：

1. `Core Persona`
2. `Expression Style`
3. `Boundary Pack`
4. `User Mask`
5. `Memory`
6. `sceneHints`
7. `World Book`
8. `Extended Lore`

说明：

- 前三层优先保证“这个人是谁、怎么说话、不能越什么线”
- 中间层保证“关系怎么延续、当前怎么看用户”
- 后面层负责补背景和场景，不应挤掉核心人格

---

## 6. 当前阶段实施约束

1. 当前允许保留“大框输入”，但底层必须开始资产化拆层
2. 当前先做轻量读取矩阵，不做重型召回系统
3. 当前不要求 UI 一步到位拆成复杂编辑器
4. 当前不回退到旧 `setting` 全文直塞主链
5. 当前必须优先解决“人味迁移”而不是只做字段迁移

---

## 7. 当前阶段的通俗意思

用户还是可以像现在一样一口气写完整角色。

系统内部要做的，不是把这大段字每轮都硬塞给模型，而是像整理柜子一样：

- 原文完整收着
- 最常用、最关键的放在最顺手的位置
- 特定场景再拿对应那一层
- 但角色的东西不丢，也不乱混
