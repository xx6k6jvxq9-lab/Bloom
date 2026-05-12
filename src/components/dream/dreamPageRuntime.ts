import { useEffect, useState } from 'react';

import { buildWorldBookChunkCache } from '../../services/world-book/worldBookBudget';
import { getWorldBookPriorityWeight, normalizeWorldBookCategory } from '../../services/world-book/worldBookMeta';
import { applyDerivedWorldBookMetadata } from '../../services/world-book/worldBookDerived';
import { getWorldBookAutoMergeReasonLabel, mergeImportedWorldBooksIntoLibrary } from '../../services/world-book/worldBookMerge';
import type {
  DreamCustomTag,
  DreamDecisionRecord,
  DreamGeneratedChoice,
  DreamRuntimeAct,
  DreamRuntimeScenario,
} from '../../services/dream/dreamRuntimeTypes';
import type { DreamNarrativeBlock } from '../../services/dream/dreamNarrativeSchema';
import type { Character, WorldBookEntry } from '../../types';
import { defaultTagSelection, dreamTagGroups } from './dreamContent';
import type { DreamConfirmPreview, DreamRole } from './dreamPageTypes';
import type { DreamWorldBookImportDraft } from './DreamWorldBookImportReviewSheet';
import type { DreamDepth, DreamDomainId, DreamEntryMode, DreamScenario, DreamTagCategory } from './types';

export type ActiveDreamChoice = DreamGeneratedChoice & {
  reaction: string;
  fromCustom?: boolean;
};

export type DreamEndingView = {
  title: string;
  body: string;
  excerpt: string;
  signature: string;
  chapter: string;
};

export type DreamAftermathView = {
  summary: string;
  detail: string;
  previewMessages: [string, string];
};

export function buildDreamWorldBookImportDrafts(
  entries: WorldBookEntry[],
  existingEntries: WorldBookEntry[] = [],
): DreamWorldBookImportDraft[] {
  const mergePreview = mergeImportedWorldBooksIntoLibrary(existingEntries, entries).stats.decisions;

  return entries.map((entry, index) => ({
    ...entry,
    draftId: `${entry.id || 'dream-import'}-${index}-${Math.random().toString(16).slice(2)}`,
    include: true,
    mergeGroup: '',
    autoMergeAction: mergePreview[index]?.action,
    autoMergeReasonLabel: getWorldBookAutoMergeReasonLabel(mergePreview[index]?.reason || 'new_entry'),
    autoMergeTargetTitle: mergePreview[index]?.targetTitle,
  }));
}

function toDreamImportedWorldBookEntry(draft: DreamWorldBookImportDraft): WorldBookEntry {
  const nextId = draft.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const content = draft.content.trim();

  return applyDerivedWorldBookMetadata({
    id: nextId,
    title: draft.title.trim(),
    content,
    category: normalizeWorldBookCategory(draft.category),
    priorityLevel: draft.priorityLevel || 'normal',
    isActive: draft.isActive !== false,
    isGlobal: draft.isGlobal !== false,
    characterIds: Array.from(new Set(
      (draft.characterIds || []).filter((characterId): characterId is string => Boolean(characterId?.trim())),
    )),
    pinMode: draft.pinMode === 'always' ? 'always' : 'none',
    chunkCache: buildWorldBookChunkCache({
      id: nextId,
      title: draft.title.trim(),
      content,
      category: normalizeWorldBookCategory(draft.category),
    }),
  });
}

function mergeDreamImportedDraftGroup(groupName: string, drafts: DreamWorldBookImportDraft[]): WorldBookEntry {
  const normalizedGroupName = groupName.trim();
  const categories = Array.from(new Set(drafts.map((draft) => normalizeWorldBookCategory(draft.category))));
  const mergedPriority = drafts.reduce<WorldBookEntry['priorityLevel']>((best, current) => {
    const currentWeight = getWorldBookPriorityWeight(current.priorityLevel);
    const bestWeight = getWorldBookPriorityWeight(best);
    return currentWeight >= bestWeight ? current.priorityLevel : best;
  }, 'normal');
  const mergedCharacterIds = Array.from(new Set(drafts.flatMap((draft) => draft.characterIds || [])));
  const mergedContent = drafts
    .map((draft) => [drafts.length > 1 ? `## ${draft.title.trim()}` : '', draft.content.trim()].filter(Boolean).join('\n'))
    .join('\n\n');
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return applyDerivedWorldBookMetadata({
    id: nextId,
    title: normalizedGroupName || drafts[0].title.trim(),
    content: mergedContent,
    category: categories.length === 1 ? categories[0] : '其他',
    priorityLevel: mergedPriority,
    isActive: drafts.some((draft) => draft.isActive !== false),
    isGlobal: mergedCharacterIds.length === 0,
    characterIds: mergedCharacterIds,
    pinMode: drafts.some((draft) => draft.pinMode === 'always') ? 'always' : 'none',
    chunkCache: buildWorldBookChunkCache({
      id: nextId,
      title: normalizedGroupName || drafts[0].title.trim(),
      content: mergedContent,
      category: categories.length === 1 ? categories[0] : '其他',
    }),
  });
}

export function buildDreamImportedWorldBooksFromDrafts(drafts: DreamWorldBookImportDraft[]): WorldBookEntry[] {
  const selectedDrafts = drafts.filter((draft) => draft.include);
  const groupedDrafts = new Map<string, DreamWorldBookImportDraft[]>();
  const standaloneEntries: WorldBookEntry[] = [];

  selectedDrafts.forEach((draft) => {
    const groupName = draft.mergeGroup.trim();
    if (!groupName) {
      standaloneEntries.push(toDreamImportedWorldBookEntry(draft));
      return;
    }

    const bucket = groupedDrafts.get(groupName) || [];
    bucket.push(draft);
    groupedDrafts.set(groupName, bucket);
  });

  const mergedEntries = Array.from(groupedDrafts.entries()).map(([groupName, grouped]) => (
    mergeDreamImportedDraftGroup(groupName, grouped)
  ));

  return [...mergedEntries, ...standaloneEntries];
}

export function formatDreamTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function debugDreamStagePayload(label: string, payload: unknown) {
  try {
    console.info(label, payload);
  } catch {
    console.info(label);
  }
}

export function buildRoles(characters: Character[]): DreamRole[] {
  return characters.slice(0, 12).map((character) => ({
    id: character.id,
    name: character.remarkName?.trim() || character.name || '未命名角色',
    avatar: character.avatar || '',
    mood: character.signature?.trim() || character.motto?.trim() || character.openingRemark?.trim() || '今夜在等你',
    glyph: (character.remarkName?.trim() || character.name || '梦').trim().charAt(0) || '梦',
  }));
}

function hasCustomTagInCategories(customTags: DreamCustomTag[], categories: DreamTagCategory[]) {
  return customTags.some((tag) => categories.includes(tag.category));
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomIds(category: DreamTagCategory, count: number) {
  const group = dreamTagGroups.find((item) => item.category === category);
  if (!group) return [];
  const pool = [...group.options];
  const picked: string[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool[index].id);
    pool.splice(index, 1);
  }
  return picked;
}

export function buildQuickDreamPreset(): {
  domainId: DreamDomainId;
  depth: DreamDepth;
  selectedTags: Record<DreamTagCategory, string[]>;
  preview: DreamConfirmPreview;
} {
  const domainId = pickRandom(['crowd', 'threshold', 'shared', 'rift'] as const);
  const genre = pickRandomIds('genre', 1);
  const tension = pickRandomIds('tension', 1);
  const drive = pickRandomIds('drive', 1);
  const mood = pickRandomIds('mood', 1);
  const climate = pickRandomIds('climate', 1);
  const participants = pickRandomIds('participants', 1);
  const faction = pickRandomIds('faction', 1);
  const camp = pickRandomIds('camp', 1);
  const identity = pickRandomIds('identity', 1);
  const lead = pickRandomIds('lead', 1);
  const intensity = pickRandomIds('intensity', 1);
  const interaction = pickRandomIds('interaction', 1);
  const ending = pickRandomIds('ending', 1);

  const selectedTags: Record<DreamTagCategory, string[]> = {
    ...defaultTagSelection,
    world: [domainId],
    genre,
    tension,
    drive,
    mood,
    climate,
    participants,
    faction,
    camp,
    identity,
    lead,
    intensity,
    interaction,
    ending,
  };

  const subtitle = `${pickRandom(['今夜的门先开了一条缝', '这一次梦会先把你拖进节点里', '有人已经在梦里等你', '这一局从失衡的瞬间开始'])}`;
  const confirmHint = `${pickRandom(['这场梦不会先解释规则，你要先活过第一幕。', '你们的关系已经被梦改写，进入后再确认谁站在哪一边。', '这一局会先给你一个世界，再逼你做选择。', '梦已经把身份和冲突排好，只等你落进去。'])}`;

  return {
    domainId,
    depth: 'shallow',
    selectedTags,
    preview: {
      coverSubtitle: subtitle,
      confirmHint,
    },
  };
}

export function buildCharacterDreamPreset(): {
  domainId: DreamDomainId;
  depth: DreamDepth;
  selectedTags: Record<DreamTagCategory, string[]>;
} {
  const maybePick = (category: DreamTagCategory, probability: number, count = 1) => (
    Math.random() < probability ? pickRandomIds(category, count) : []
  );

  return {
    domainId: 'rift',
    depth: 'deep',
    selectedTags: {
      ...defaultTagSelection,
      world: ['rift'],
      lead: ['character-lead'],
      tension: maybePick('tension', 0.5),
      drive: maybePick('drive', 0.65),
      mood: maybePick('mood', 0.55),
      climate: maybePick('climate', 0.35),
      participants: maybePick('participants', 0.3),
      faction: maybePick('faction', 0.35),
      camp: maybePick('camp', 0.25),
      identity: maybePick('identity', 0.45),
      intensity: maybePick('intensity', 0.4),
      interaction: maybePick('interaction', 0.4),
      ending: maybePick('ending', 0.3),
    },
  };
}

export function useNarrativeTypewriter(
  blocks: Array<{
    id: string;
    type: string;
    text: string;
    speakerName?: string;
    align?: 'left' | 'center' | 'right';
    emphasis?: 'low' | 'medium' | 'high';
  }>,
  active: boolean,
  scopeKey: string,
) {
  const [visibleBlocks, setVisibleBlocks] = useState<typeof blocks>([]);

  useEffect(() => {
    if (!active || blocks.length === 0) {
      setVisibleBlocks((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    let cancelled = false;
    let blockIndex = 0;
    let charIndex = 0;

    setVisibleBlocks(
      blocks.map((block) => ({
        ...block,
        text: '',
      })),
    );

    const step = () => {
      if (cancelled || blockIndex >= blocks.length) return;
      const sourceBlock = blocks[blockIndex];
      const char = sourceBlock.text[charIndex];
      if (!char) {
        blockIndex += 1;
        charIndex = 0;
        window.setTimeout(step, 120);
        return;
      }

      setVisibleBlocks((prev) =>
        prev.map((block, index) =>
          index === blockIndex
            ? {
                ...block,
                text: `${block.text}${char}`,
              }
            : block,
        ),
      );

      charIndex += 1;
      window.setTimeout(step, /[，。！？；：]/.test(char) ? 180 : 26);
    };

    window.setTimeout(step, 120);
    return () => {
      cancelled = true;
    };
  }, [active, blocks, scopeKey]);

  return visibleBlocks;
}

export function buildSimpleTypewriterBlocks(items: Array<{ id: string; text: string }>) {
  return items.map((item) => ({
    id: item.id,
    type: 'narration',
    text: item.text,
    align: 'left' as const,
    emphasis: 'medium' as const,
  }));
}

export function buildRuntimeEndingView(scenario: DreamRuntimeScenario, roleName: string, userName: string): DreamEndingView {
  const { storyFrame, endingInput, endingOutput } = scenario;
  const resolvedUserName = userName.trim() || '你';
  if (endingOutput) {
    return {
      title: endingOutput.title,
      body: endingOutput.body,
      excerpt: endingOutput.excerpt,
      signature: roleName,
      chapter: endingOutput.chapter,
    };
  }
  const normalizedSummary = (endingInput.keyActionSummary || '').replaceAll('用户', resolvedUserName);
  return {
    title: storyFrame.worldTitle || scenario.coverTitle || '今夜',
    body:
      normalizedSummary ||
      `${storyFrame.characterDreamIdentity || roleName} 与 ${storyFrame.userDreamIdentity || resolvedUserName} 的这场梦，终于停在 ${storyFrame.coreConflict || '尚未说破的冲突'} 前。`,
    excerpt:
      normalizedSummary ||
      `${storyFrame.characterDreamIdentity || roleName} 与 ${storyFrame.userDreamIdentity || resolvedUserName} 的这场梦，最终停在 ${storyFrame.coreConflict || '尚未说破的冲突'} 前。`,
    signature: roleName,
    chapter: `《${endingInput.endingDirection || storyFrame.dreamRelationship || '梦局未竟'}》`,
  };
}

export function buildPresetEndingView(scenario: DreamScenario): DreamEndingView {
  return {
    title: scenario.ending.title,
    body: scenario.ending.excerpt,
    excerpt: scenario.ending.excerpt,
    signature: scenario.ending.signature,
    chapter: scenario.ending.chapter,
  };
}

export function buildRuntimeAftermathView(scenario: DreamRuntimeScenario): DreamAftermathView {
  if (scenario.aftermathOutput) {
    return {
      summary: scenario.aftermathOutput.summary,
      detail: scenario.aftermathOutput.detail,
      previewMessages: scenario.aftermathOutput.previewMessages,
    };
  }
  return {
    summary: scenario.aftermathInput.relationshipShift || '这场梦会在醒来后留下轻微的关系回响。',
    detail:
      scenario.aftermathInput.toneDrift || scenario.aftermathInput.messagePreviewDirection || '明日的聊天语气会沿着这场梦发生偏移。',
    previewMessages: [
      scenario.aftermathInput.messagePreviewDirection || '我还记得昨晚梦里的那一段。',
      scenario.storyFrame.openingNode || '你醒来之后，会先想起哪个瞬间？',
    ],
  };
}

export function buildReactionBlocks(
  choice: ActiveDreamChoice | null,
  act: DreamRuntimeAct | null,
): DreamNarrativeBlock[] {
  if (!choice) return [];

  const blocks: DreamNarrativeBlock[] = [];
  const reactionText = choice.reaction?.trim() || '';
  const storyPushText = choice.storyPush?.trim() || '';
  const reactionParagraphs = reactionText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  reactionParagraphs.forEach((paragraph, index) => {
    const hasQuote = /“[^”]+”|"[^"]+"/.test(paragraph);
    blocks.push({
      id: `reaction-block-${index + 1}`,
      type: hasQuote ? 'dialogue' : index === 0 ? 'highlight-dialogue' : 'narration',
      text: paragraph,
      emphasis: hasQuote ? 'medium' : index === 0 ? 'high' : 'medium',
      align: hasQuote ? 'left' : index === 0 ? 'center' : 'left',
    });
  });

  if (storyPushText) {
    blocks.push({
      id: 'reaction-story-push',
      type: 'aside',
      text: `主线正在偏向：${storyPushText}`,
      emphasis: 'low',
      align: 'left',
    });
  }

  if (act?.progression.tensionShift) {
    blocks.push({
      id: 'reaction-tension-shift',
      type: 'prompt',
      text: `张力变化：${act.progression.tensionShift}`,
      emphasis: 'low',
      align: 'center',
    });
  }

  return blocks;
}

export function hasStoryFrameContent(storyFrame: DreamRuntimeScenario['storyFrame'] | null) {
  if (!storyFrame) return false;
  return [
    storyFrame.worldTitle,
    storyFrame.worldSummary,
    storyFrame.userDreamIdentity,
    storyFrame.characterDreamIdentity,
    storyFrame.dreamRelationship,
    storyFrame.openingNode,
    storyFrame.storyObjective,
    storyFrame.coreConflict,
    storyFrame.realityAnchor,
    storyFrame.timeNode,
    storyFrame.currentCrisis,
    storyFrame.forbiddenRule,
    storyFrame.immediateGoal,
  ].some((value) => value?.trim());
}

export function buildCustomVisibleStoryFrame(
  storyFrame: DreamRuntimeScenario['storyFrame'] | null,
  selectedTags: Record<DreamTagCategory, string[]>,
  customTags: DreamCustomTag[],
) {
  if (!storyFrame) return null;
  const backgroundSelected =
    ['world', 'genre', 'climate', 'camp', 'faction'].some((category) => (selectedTags[category as DreamTagCategory] ?? []).length > 0)
    || hasCustomTagInCategories(customTags, ['genre', 'climate', 'camp', 'faction']);
  const identitySelected =
    ['identity', 'participants'].some((category) => (selectedTags[category as DreamTagCategory] ?? []).length > 0)
    || hasCustomTagInCategories(customTags, ['identity', 'participants']);
  const relationshipSelected =
    ['tension', 'lead'].some((category) => (selectedTags[category as DreamTagCategory] ?? []).length > 0)
    || hasCustomTagInCategories(customTags, ['tension', 'lead']);
  const driveSelected =
    ['drive', 'interaction', 'intensity'].some((category) => (selectedTags[category as DreamTagCategory] ?? []).length > 0)
    || hasCustomTagInCategories(customTags, ['drive', 'interaction', 'intensity']);

  return {
    worldTitle: backgroundSelected ? storyFrame.worldTitle : '',
    worldSummary: backgroundSelected ? storyFrame.worldSummary : '',
    userDreamIdentity: identitySelected ? storyFrame.userDreamIdentity : '',
    characterDreamIdentity: identitySelected ? storyFrame.characterDreamIdentity : '',
    dreamRelationship: relationshipSelected ? storyFrame.dreamRelationship : '',
    openingNode: driveSelected ? storyFrame.openingNode : '',
    storyObjective: driveSelected ? storyFrame.storyObjective : '',
    immediateGoal: driveSelected ? storyFrame.immediateGoal : '',
  };
}

export function createDecisionRecord(act: DreamRuntimeAct, choice: ActiveDreamChoice): DreamDecisionRecord {
  return {
    actId: act.id,
    actLabel: act.label,
    choiceId: choice.id,
    title: choice.title,
    direction: choice.direction,
    detail: choice.detail,
    reaction: choice.reaction,
    storyPush: choice.storyPush,
    emotion: choice.emotion,
    fromCustom: choice.fromCustom,
  };
}

export function appendDecisionRecord(trail: DreamDecisionRecord[], nextRecord: DreamDecisionRecord | null) {
  if (!nextRecord) return trail;
  const existingIndex = trail.findIndex((record) => record.actId === nextRecord.actId);
  if (existingIndex === -1) return [...trail, nextRecord];
  const cloned = [...trail];
  cloned[existingIndex] = nextRecord;
  return cloned;
}

export function upsertDreamAct(acts: DreamRuntimeAct[], nextAct: DreamRuntimeAct, index: number) {
  const cloned = [...acts];
  cloned[index] = nextAct;
  return cloned;
}
