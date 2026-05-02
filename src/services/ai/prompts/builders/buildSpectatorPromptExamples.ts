type BuildSpectatorPromptExamplesOptions = {
  angles: string[];
};

export function buildSpectatorPromptExamples(options: BuildSpectatorPromptExamplesOptions) {
  const examples: string[] = [];
  const angleSet = new Set(options.angles);

  if (angleSet.has('sighting')) {
    examples.push('目击帖示例感觉：`刚从训练室门口出来，真的不是我一个人觉得他们那下停顿很怪吧`');
  }

  if (angleSet.has('analysis') || angleSet.has('backstory')) {
    examples.push('复盘帖示例感觉：`我顺了一下时间线，越顺越觉得这条线不是最近才开始的`');
  }

  if (angleSet.has('rumor') || angleSet.has('misread')) {
    examples.push('风声帖示例感觉：`先叠甲不保真，但这事如果又一次对上细节就有点难说了`');
  }

  if (angleSet.has('vote') || angleSet.has('bet') || angleSet.has('shipwar')) {
    examples.push('站队帖示例感觉：`来投，双向嘴硬还是单箭头上头，别空口，带证据`');
  }

  if (angleSet.has('protective') || angleSet.has('hardmouth') || angleSet.has('contrast')) {
    examples.push('关系观察帖示例感觉：`平时嘴最硬的人，真出事的时候反而第一个站出来，这种最难洗`');
  }

  if (angleSet.has('jealousy') || angleSet.has('occupy') || angleSet.has('danger') || angleSet.has('adult')) {
    examples.push('危险拉扯帖示例感觉：`不是明着发疯，是那种你站远一点看才会发现已经越界的味`');
  }

  if (angleSet.has('fiction') || angleSet.has('essay') || angleSet.has('rps') || angleSet.has('romance')) {
    examples.push('短文向示例感觉：`【片段】23:54，灯还亮着。门没关严，风从走廊灌进来，他还是没走。`');
  }

  if (examples.length === 0) {
    examples.push('通用示例感觉：`我本来还想说别想太多，但这几次看下来真的很难当普通关系看`');
  }

  return ['### 题材示例', ...examples].join('\n');
}
