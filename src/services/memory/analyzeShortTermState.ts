export type OpenLoopStatus = 'active' | 'waiting_user' | 'dormant' | 'unknown';

export type OpenLoopKind = 'scene' | 'relationship' | 'task' | 'topic' | 'unknown';

export type ShortTermOpenLoop = {
  status: OpenLoopStatus;
  kind: OpenLoopKind;
  content: string;
};

export type ShortTermStateAnalysis = {
  currentAtmosphere?: string;
  residualEffect?: string;
  temporaryConstraint?: string;
  openLoops: ShortTermOpenLoop[];
  primaryOpenLoop?: ShortTermOpenLoop;
};

const OPEN_LOOP_LINE_REGEX = /^开放回路(?:（(active|waiting_user|dormant)）)?[:：]\s*(.+)$/u;
const CURRENT_ATMOSPHERE_REGEX = /^(当前气氛|气氛|氛围|当前状态|状态)[:：]\s*(.+)$/u;
const RESIDUAL_EFFECT_REGEX = /^(短期余波|余波|残留余波|残留情绪|当前余波|余留氛围)[:：]\s*(.+)$/u;
const TEMPORARY_CONSTRAINT_REGEX = /^(临时限制|当前限制|短期限制|注意事项)[:：]\s*(.+)$/u;

const SCENE_LOOP_MARKERS = /(门口|楼下|车里|路上|电梯里|刚到|马上到|快到了|过来|过去|来找|端着|腾不开手|刚煮|煮了粉|站在|坐在|等在|还在)/;
const RELATIONSHIP_LOOP_MARKERS = /(和好|别扭|冷战|吵架|误会|吃醋|心软|想你|想见|喜欢|暧昧|关系|靠近|疏远|不高兴|委屈|生气|没说开|没聊开)/;
const TASK_LOOP_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完)/;
const TOPIC_LOOP_MARKERS = /(薯条|梗|笑死|又来了|老样子|经典|还是那个|你又提|每次都|又开始了|这回合|老梗|老毛病|惯例)/;

function normalizeLine(value: string): string {
  return value.trim();
}

function classifyOpenLoopKind(content: string): OpenLoopKind {
  if (SCENE_LOOP_MARKERS.test(content)) {
    return 'scene';
  }

  if (RELATIONSHIP_LOOP_MARKERS.test(content)) {
    return 'relationship';
  }

  if (TASK_LOOP_MARKERS.test(content)) {
    return 'task';
  }

  if (TOPIC_LOOP_MARKERS.test(content)) {
    return 'topic';
  }

  return 'unknown';
}

function rankOpenLoop(loop: ShortTermOpenLoop): number {
  const statusScore = loop.status === 'active'
    ? 300
    : loop.status === 'waiting_user'
      ? 200
      : loop.status === 'dormant'
        ? 100
        : 0;
  const kindScore = loop.kind === 'relationship'
    ? 30
    : loop.kind === 'task'
      ? 20
      : loop.kind === 'topic'
        ? 15
      : loop.kind === 'scene'
        ? 10
        : 0;

  return statusScore + kindScore;
}

export function analyzeShortTermState(summary?: string | null): ShortTermStateAnalysis {
  const normalized = summary?.trim();
  if (!normalized) {
    return { openLoops: [] };
  }

  let currentAtmosphere = '';
  let residualEffect = '';
  let temporaryConstraint = '';
  const openLoops: ShortTermOpenLoop[] = [];

  for (const rawLine of normalized.split(/\r?\n+/)) {
    const line = normalizeLine(rawLine);
    if (!line) {
      continue;
    }

    const currentAtmosphereMatch = line.match(CURRENT_ATMOSPHERE_REGEX);
    if (currentAtmosphereMatch?.[2]) {
      currentAtmosphere = currentAtmosphereMatch[2].trim();
      continue;
    }

    const residualEffectMatch = line.match(RESIDUAL_EFFECT_REGEX);
    if (residualEffectMatch?.[2]) {
      residualEffect = residualEffectMatch[2].trim();
      continue;
    }

    const temporaryConstraintMatch = line.match(TEMPORARY_CONSTRAINT_REGEX);
    if (temporaryConstraintMatch?.[2]) {
      temporaryConstraint = temporaryConstraintMatch[2].trim();
      continue;
    }

    const openLoopMatch = line.match(OPEN_LOOP_LINE_REGEX);
    if (openLoopMatch?.[2]) {
      const content = openLoopMatch[2].trim();
      openLoops.push({
        status: (openLoopMatch[1] as OpenLoopStatus | undefined) || 'unknown',
        kind: classifyOpenLoopKind(content),
        content,
      });
    }
  }

  const primaryOpenLoop = [...openLoops].sort((left, right) => rankOpenLoop(right) - rankOpenLoop(left))[0];

  return {
    ...(currentAtmosphere ? { currentAtmosphere } : {}),
    ...(residualEffect ? { residualEffect } : {}),
    ...(temporaryConstraint ? { temporaryConstraint } : {}),
    openLoops,
    ...(primaryOpenLoop ? { primaryOpenLoop } : {}),
  };
}
