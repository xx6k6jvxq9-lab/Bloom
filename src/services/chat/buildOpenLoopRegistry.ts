import type { CharacterOpenLoopEntry, ChatMessage } from '../../types';
import { getMessageMainText } from '../../utils';
import {
  analyzeShortTermState,
  type OpenLoopKind,
  type OpenLoopStatus,
} from '../memory/analyzeShortTermState';
import type { TaskResidueItem, TopicAnchorItem } from '../relationship-context/types';
import { isTopicRelevantToUserText } from './topicRecall';

export type RuntimeOpenLoopEntry = {
  id: string;
  kind: OpenLoopKind;
  status: Exclude<OpenLoopStatus, 'unknown'>;
  content: string;
  source: 'short_term_summary' | 'recent_history';
  lastTouchedAt?: number;
  resumeHint: string;
};

type BuildRuntimeOpenLoopRegistryInput = {
  existingEntries?: CharacterOpenLoopEntry[];
  shortTermSummary?: string;
  recentMessages?: ChatMessage[];
  latestUserText?: string;
  taskResidue?: TaskResidueItem[];
  topicAnchors?: TopicAnchorItem[];
};

const SCENE_LOOP_MARKERS = /(门口|楼下|车里|路上|刚到|马上到|快到了|过来|过去|来找|站着|坐着|等着|还在)/;
const RELATIONSHIP_LOOP_MARKERS = /(和好|别扭|冷战|吵架|误会|吃醋|心软|想你|想见|喜欢|暧昧|关系|靠近|疏远|委屈|生气|没说开|没聊开)/;
const TASK_LOOP_MARKERS = /(答应|约定|确认|回复|处理|完成|安排|计划|改天|下次|补上|兑现|去做|办完)/;
const TOPIC_LOOP_MARKERS = /(烂梗|老梗|老样子|经典|还是那个|你又提|每次都|又开始了|这回合|惯例)/;

function classifyKind(content: string): OpenLoopKind {
  if (SCENE_LOOP_MARKERS.test(content)) return 'scene';
  if (RELATIONSHIP_LOOP_MARKERS.test(content)) return 'relationship';
  if (TASK_LOOP_MARKERS.test(content)) return 'task';
  if (TOPIC_LOOP_MARKERS.test(content)) return 'topic';
  return 'unknown';
}

function buildResumeHint(kind: OpenLoopKind, status: OpenLoopStatus): string {
  if (kind === 'scene') {
    return status === 'active'
      ? '只有当前仍然是同一段现场连续聊天时才可自然续写。'
      : '默认只作背景参考，等用户当前明确重提时再恢复。';
  }

  if (kind === 'relationship') {
    return '可轻量保留在语气和距离感里，不要一上来整段硬续旧情绪。';
  }

  if (kind === 'task') {
    return '除非用户当前明确提这个待办，否则先回应眼前，再视情况补一句进度。';
  }

  if (kind === 'topic') {
    return '这是旧梗或旧话题锚点，默认只作熟悉感背景；除非用户当前主动碰到或高度相关，否则不要自己起这个梗。';
  }

  return '先当背景条件，不要机械把旧节点继续演成当前现场。';
}

function dedupeEntries(entries: RuntimeOpenLoopEntry[]): RuntimeOpenLoopEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.kind}:${entry.content.trim().toLowerCase()}`;
    if (!entry.content.trim() || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deriveTypedEntries(input: BuildRuntimeOpenLoopRegistryInput): RuntimeOpenLoopEntry[] {
  const topicEntries = (input.topicAnchors || [])
    .filter((item) => isTopicRelevantToUserText(item.summary, input.latestUserText))
    .map((item, index): RuntimeOpenLoopEntry => ({
      id: `typed-topic-${index + 1}`,
      kind: 'topic',
      status: 'dormant',
      content: item.summary,
      source: 'short_term_summary',
      lastTouchedAt: item.timestamp,
      resumeHint: buildResumeHint('topic', 'dormant'),
    }));

  const taskEntries = (input.taskResidue || [])
    .map((item, index): RuntimeOpenLoopEntry => ({
      id: `typed-task-${index + 1}`,
      kind: 'task',
      status: 'waiting_user',
      content: item.summary,
      source: 'short_term_summary',
      lastTouchedAt: item.timestamp,
      resumeHint: buildResumeHint('task', 'waiting_user'),
    }));

  return dedupeEntries([...taskEntries, ...topicEntries]).slice(0, 4);
}

function deriveRecentHistoryLoops(messages: ChatMessage[]): RuntimeOpenLoopEntry[] {
  return messages
    .filter((message) => message.role === 'model' && !message.isSystem)
    .slice(-6)
    .map((message): RuntimeOpenLoopEntry | null => {
      const content = getMessageMainText(message).trim();
      if (!content) {
        return null;
      }

      const kind = classifyKind(content);
      if (kind === 'unknown') {
        return null;
      }

      const status: RuntimeOpenLoopEntry['status'] = kind === 'relationship'
        ? 'waiting_user'
        : 'dormant';

      return {
        id: `recent-${message.timestamp}`,
        kind,
        status,
        content: content.replace(/\s+/g, ' ').slice(0, 72),
        source: 'recent_history',
        lastTouchedAt: message.timestamp,
        resumeHint: buildResumeHint(kind, status),
      };
    })
    .filter((entry): entry is RuntimeOpenLoopEntry => Boolean(entry));
}

export function buildRuntimeOpenLoopRegistry(
  input: BuildRuntimeOpenLoopRegistryInput,
): RuntimeOpenLoopEntry[] {
  const typedEntries = deriveTypedEntries(input);

  if (Array.isArray(input.existingEntries) && input.existingEntries.length > 0) {
    const existingEntries = input.existingEntries
      .filter((entry) => entry.status !== 'resolved')
      .filter((entry) => entry.kind !== 'topic' || isTopicRelevantToUserText(entry.content, input.latestUserText))
      .slice(0, 8)
      .map((entry): RuntimeOpenLoopEntry => ({
        id: entry.id,
        kind: entry.kind,
        status: entry.status === 'resolved' ? 'dormant' : entry.status,
        content: entry.content,
        source: entry.source === 'manual' ? 'short_term_summary' : entry.source,
        lastTouchedAt: entry.lastTouchedAt,
        resumeHint: entry.resumeHint || buildResumeHint(entry.kind, entry.status === 'resolved' ? 'dormant' : entry.status),
      }));

    return dedupeEntries([...existingEntries, ...typedEntries]).slice(0, 8);
  }

  const analysis = analyzeShortTermState(input.shortTermSummary);
  const summaryEntries: RuntimeOpenLoopEntry[] = analysis.openLoops.map((loop, index) => ({
    id: `summary-${index + 1}`,
    kind: loop.kind,
    status: loop.status === 'unknown' ? 'waiting_user' : loop.status,
    content: loop.content,
    source: 'short_term_summary',
    resumeHint: buildResumeHint(loop.kind, loop.status === 'unknown' ? 'waiting_user' : loop.status),
  }));

  const filteredSummaryEntries = summaryEntries.filter((entry) => (
    entry.kind !== 'topic' || isTopicRelevantToUserText(entry.content, input.latestUserText)
  ));

  if (filteredSummaryEntries.length > 0 || typedEntries.length > 0) {
    return dedupeEntries([...typedEntries, ...filteredSummaryEntries]).slice(0, 8);
  }

  return deriveRecentHistoryLoops(input.recentMessages || []).filter((entry) => (
    entry.kind !== 'topic' || isTopicRelevantToUserText(entry.content, input.latestUserText)
  ));
}

export function buildOpenLoopRegistryPrompt(
  input: BuildRuntimeOpenLoopRegistryInput,
): string {
  const registry = buildRuntimeOpenLoopRegistry(input);
  if (registry.length === 0) {
    return [
      '## Open Loop Registry',
      '[当前结论] 这一轮没有必须立刻续写的旧节点，默认先按当前在线状态和当前用户输入接话。',
    ].join('\n');
  }

  return [
    '## Open Loop Registry',
    '[说明] 以下是当前仍可能影响回复方式的未完节点。它们是背景决策参考，不等于必须主动续写。',
    ...registry.slice(0, 3).map((entry) => {
      const touchedText = typeof entry.lastTouchedAt === 'number'
        ? ` / lastTouchedAt=${entry.lastTouchedAt}`
        : '';
      return `- ${entry.id} | kind=${entry.kind} | status=${entry.status} | source=${entry.source}${touchedText} | content=${entry.content} | hint=${entry.resumeHint}`;
    }),
  ].join('\n');
}
