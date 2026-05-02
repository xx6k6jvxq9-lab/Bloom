import type { TopicAnchorItem } from '../relationship-context/types';

const TOPIC_LOOP_MARKERS = /(烂梗|老梗|老样子|经典|还是那个|你又提|每次都|又开始了|这回合|惯例)/i;

function normalizeText(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function looksLikeTopicText(text: string | null | undefined): boolean {
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }

  return TOPIC_LOOP_MARKERS.test(normalized);
}

export function isTopicRelevantToUserText(topicText: string, latestUserText?: string): boolean {
  const normalizedTopic = normalizeText(topicText);
  const normalizedUser = normalizeText(latestUserText);
  if (!normalizedTopic || !normalizedUser) {
    return false;
  }

  if (normalizedTopic.includes(normalizedUser) || normalizedUser.includes(normalizedTopic)) {
    return true;
  }

  const topicTokens = normalizedTopic.split(/[，。！？?.!\s]+/).filter(Boolean);
  const hitCount = topicTokens.filter((token) => token.length >= 2 && normalizedUser.includes(token)).length;
  if (hitCount >= 1) {
    return true;
  }

  return looksLikeTopicText(normalizedUser);
}

export function suppressTopicResidualsForPrompt(
  summary: string | undefined,
  continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap',
  latestUserText?: string,
): string | undefined {
  const normalized = summary?.trim();
  if (!normalized) {
    return normalized;
  }

  if (continuityMode === 'continuous_scene') {
    return normalized;
  }

  const allowTopicRecall = isTopicRelevantToUserText(normalized, latestUserText);
  if (allowTopicRecall) {
    return normalized;
  }

  const filteredLines = normalized
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !looksLikeTopicText(line));

  return filteredLines.join('\n').trim() || undefined;
}

export function filterTopicAnchorsForPrompt(
  anchors: TopicAnchorItem[] | undefined,
  continuityMode: 'continuous_scene' | 'same_day_resume' | 'resume_after_gap',
  latestUserText?: string,
): TopicAnchorItem[] {
  const typedAnchors = Array.isArray(anchors) ? anchors : [];
  if (typedAnchors.length === 0) {
    return [];
  }

  if (continuityMode === 'continuous_scene') {
    return typedAnchors;
  }

  return typedAnchors.filter((anchor) => isTopicRelevantToUserText(anchor.summary, latestUserText));
}
