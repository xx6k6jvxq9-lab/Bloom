# Bloom 角色场景读取矩阵（当前阶段版）

更新时间：2026-04-03
适用阶段：Phase B -> Phase C 过渡阶段
定位：不同场景默认读取哪些角色层、哪些内容常驻、哪些内容按需进入本轮快照

边界说明：

- 这份文档只定义“不同场景默认读什么”
- 本矩阵定义的是当前阶段默认读取规则，不是唯一读取矩阵
- 特殊任务、特殊触发、强相关话题可在不打破优先级前提下额外召回内容
- 不替代完整角色输入 contract
- 不替代活人感迁移规则
- 不直接定义重型召回系统和最终 snapshot 拼装实现细节

---

## 1. 总目标

这份矩阵要解决的是：

- 单聊、群聊、约会、`couple-space` 不再长期读取同一坨大设定
- 各场景知道自己默认该读哪些层
- 角色完整性和场景适配能同时成立

当前阶段原则：

- 关键内容常驻
- 扩展内容按需读取
- 不同场景读取不同“表达版”
- 角色本体优先级高于场景补充

---

## 2. 默认读取层说明

当前矩阵基于以下角色层：

- `Core Persona`
- `Expression Style`
- `Boundary Pack`
- `Extended Lore`
- `User Mask`
- `shortTermSummary`
- `longTermMemoryProfile`
- `sceneHints`
- `World Book`

其中：

- `Core Persona` 负责“这个人是谁”
- `Expression Style` 负责“这个人怎么说话”
- `Boundary Pack` 负责“这个人不能越什么线”
- `Memory` 负责“这段关系现在延续到哪了”

---

## 3. 场景读取矩阵

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
- `sceneHints.chat`
- `World Book`

当前阶段要求：

- 单聊优先保证角色稳定和关系连续
- 单聊允许保留最完整的人味
- 单聊中 `shortTermSummary` 权重高于 `longTermMemoryProfile`
- 当预算有限时，先保 `Core Persona`、`Expression Style`、`Boundary Pack`

### 3.2 群聊

默认常驻：

- `Core Persona`
- `Expression Style` 群聊版
- `Boundary Pack`
- `shortTermSummary`
- `longTermMemoryProfile`

按需读取：

- 与“用户身份理解”直接相关的 `User Mask`
- `sceneHints.groupChat`
- 与群聊相关的 `Extended Lore`

当前阶段要求：

- 群聊保留角色差异，但弱化过度私密表达
- 群聊不应直接照搬单聊里的高亲密质地
- 群聊优先群聊相关短期关系态，弱化单聊私密余波
- 群聊中的 `User Mask` 只谨慎读取，不应用来压过当前群场语境
- 群聊更强调角色区分、反应差异和轮次调度

### 3.3 约会

默认常驻：

- `Core Persona`
- `Expression Style`
- `Boundary Pack`
- `User Mask`
- `shortTermSummary`
- `longTermMemoryProfile`

按需读取：

- `Extended Lore`
- `sceneHints.dating`
- 最近关系余波
- 与约会相关的关系事件
- 必要时读取 `World Book`

当前阶段要求：

- 约会可提高关系姿态和表达质地权重
- 约会比群聊更允许带入亲密表达
- 约会中 `shortTermSummary` 和近期关系事件权重明显提高
- 约会中 `User Mask` 可提高权重，但不改写角色本体
- 约会要比单聊更重场景气氛和连续推进

### 3.4 Couple-space

默认常驻：

- `Core Persona`
- `Expression Style`
- `Boundary Pack`
- `longTermMemoryProfile`

按需读取：

- `User Mask`
- 最近聊天余波
- 最近情侣空间事件
- 当前子场景相关的 `Extended Lore`
- `sceneHints` 中与情侣空间相关的补充

当前阶段要求：

- `couple-space` 读取必须受角色边界约束
- 只能读取属于当前 partner 的关系痕迹
- `couple-space` 中 `longTermMemoryProfile` 和当前 partner 的关系沉淀权重更高
- `User Mask` 可读取，但不能压过当前 partner 的真实关系事实
- `couple-space` 可以提高熟悉感、共同生活感和沉淀感，但不能因此绕过 `Boundary Pack` 或自动提升到不符合当前关系阶段的表达强度
- 要更强调关系沉淀，而不是普通聊天延长版

---

## 4. Expression Style 的场景差异

### 4.1 单聊

- 保留最完整的表达质地
- 允许保留别扭、温柔、黏人、克制等细腻变化

### 4.2 群聊

- 保留角色差异
- 但要弱化过度私密、专属用户向表达

### 4.3 约会

- 强化关系姿态
- 强化亲密表达、氛围表达和推进感

### 4.4 Couple-space

- 强化长期关系质地
- 强化共同生活感、熟悉感和沉淀感

---

## 5. 当前阶段默认优先级

当本轮预算有限时，当前阶段默认优先保留顺序为：

1. `Boundary Pack`
2. `Core Persona`
3. `Expression Style`
4. `Memory`
5. `User Mask`
6. `sceneHints`
7. `World Book`
8. `Extended Lore`

说明：

- 先保不能错的
- 再保角色是谁
- 再保角色说话的味道
- 再保关系连续性
- 用户身份滤镜默认排在关系连续性之后
- 背景和扩展补充放后面

---

## 6. 当前阶段不做的事

1. 不要求所有场景一次性接完整矩阵
2. 不要求现在就做复杂自动召回器
3. 不要求现在就做最终版 snapshot 引擎
4. 不要求 UI 先一步全部结构化

当前阶段只要求：

- 先把默认读取规则定下来
- 后续主链按这个矩阵逐步接入

---

## 7. 当前阶段的通俗意思

同一个角色，去不同场景，不应该永远背同一个大包。

更合理的做法是：

- 单聊带最常用、最贴身的东西
- 群聊带适合公开说话的那一版
- 约会带更重氛围和关系推进的那一版
- `couple-space` 带更重沉淀和共同生活感的那一版

这样既不会把角色削薄，也不会把所有场景都搞成一个味道。
