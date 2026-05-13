import type { Character, MomentItem } from '../../types';
import {
  buildSceneSettlementResult,
  type SceneSettlementResult,
} from '../memory/sceneSettlement';

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\r/g, '').replace(/\s+/g, ' ').trim();
  return normalized ? normalized : undefined;
}

function trimPreview(value: string, maxChars = 72): string {
  return value.length > maxChars ? `${value.slice(0, maxChars).trim()}...` : value;
}

const MOMENT_RELATIONSHIP_VIBE_REGEX = /吃醋|偏心|护短|站位|主权|嘴硬|别扭|回温|被记住|被安抚|惦记|想起|偏爱|立场/i;

function buildMomentSceneSummary(momentContent: string) {
  return `刚刚发了一条公开动态：${trimPreview(momentContent)}`;
}

function buildMomentRelationshipSummary(momentContent: string): string | undefined {
  if (!MOMENT_RELATIONSHIP_VIBE_REGEX.test(momentContent)) {
    return undefined;
  }

  return `刚刚把一点公开可见的关系余波发成了动态：${trimPreview(momentContent)}`;
}

export function buildMomentPublishedSettlement(input: {
  character: Character;
  moment: Pick<MomentItem, 'content' | 'timestamp'>;
}): SceneSettlementResult {
  const normalizedContent = normalizeOptionalText(input.moment.content) || '刚刚发了一条动态。';
  const sceneSummary = buildMomentSceneSummary(normalizedContent);
  const relationshipSummary = buildMomentRelationshipSummary(normalizedContent);
  const timestamp = input.moment.timestamp;

  return buildSceneSettlementResult({
    character: input.character,
    sourceScene: 'moments',
    timestamp,
    items: {
      sceneResidue: [{
        type: 'scene_residue',
        summary: sceneSummary,
        sourceScene: 'moments',
        timestamp,
        decay: 'short',
        visibility: 'cross_scene_readable',
      }],
      ...(relationshipSummary
        ? {
            relationshipResidue: [{
              type: 'relationship_residue',
              summary: relationshipSummary,
              sourceScene: 'moments',
              timestamp,
              decay: 'short',
              visibility: 'cross_scene_readable',
            }],
          }
        : {}),
    },
    openLoop: {
      idPrefix: 'moments',
      taskResumeHint: 'moments task resume',
      topicResumeHint: 'moments topic resume',
      limit: 8,
    },
    sharedState: {
      publicSummaries: [
        sceneSummary,
        ...(relationshipSummary ? [relationshipSummary] : []),
      ],
    },
  });
}
