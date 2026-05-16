import type { CharacterActiveDatingState, DateSession } from '../../types';
import { buildDatingSceneProgress, buildDatingSceneProgressSummary } from './buildDatingSceneProgress';
import { shouldWriteDatingMemoryBackToDirectChat } from './datingWritebackPolicy';

function getLatestGeneratedStatus(session: DateSession) {
  return session.generatedContent?.status;
}

function getLatestNarrativeSnippet(session: DateSession): string {
  const segments = session.generatedContent?.narrative?.segments || [];
  const text = segments.map((segment) => segment.text).join(' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 72);
}

export function buildActiveDatingSharedState(session: DateSession): CharacterActiveDatingState | undefined {
  if (!shouldWriteDatingMemoryBackToDirectChat(session)) {
    return undefined;
  }

  const status = getLatestGeneratedStatus(session);
  const narrativeSnippet = getLatestNarrativeSnippet(session);
  const sceneProgress = buildDatingSceneProgress(session);
  const sceneProgressSummary = buildDatingSceneProgressSummary(sceneProgress);
  const location = status?.location?.trim() || session.location || '当前约会场景中';
  const mood = status?.mood?.trim() || session.mood || '有一些约会余温';

  return {
    sessionId: session.id,
    startedAt: session.timestamp || Date.now(),
    updatedAt: Date.now(),
    status: 'active',
    summary: `当前仍有一场未结束的线下约会在进行。地点参考：${location}；整体氛围：${mood}。线上聊天只能吃到这场约会带来的关系余波与状态，不直接续写线下现场动作。`,
    relationshipResidue: narrativeSnippet
      ? `这场约会最近留下了一点关系余波：${narrativeSnippet}`
      : '这场约会仍在持续影响角色此刻的关系语气与在线状态。',
    ...(sceneProgressSummary ? { sceneProgressSummary } : {}),
    boundaryNote: '线下约会仍在进行时，线上聊天不要把约会现场动作直接搬进来续写；只能把它当作共享关系语境。',
  };
}
