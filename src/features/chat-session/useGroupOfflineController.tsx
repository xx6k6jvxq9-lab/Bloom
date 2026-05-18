import { useCallback, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import type {
  ApiConfig,
  Character,
  ChatGroup,
  ChatHistory,
  ChatMessage,
  GroupOfflineRecruitDraft,
  GroupOfflineSession,
  PerceptionSettings,
  WorldBookEntry,
} from '../../types';
import { generateTextFromMessagesWithConfig } from '../../services/ai/runtimeClient';
import { persistSceneSettlementBatch } from '../../services/memory/sceneSettlement';
import { buildGroupOfflineSharedSettlement } from '../../services/group-offline/buildGroupOfflineSharedSettlement';
import { deriveGroupLongTermMemoryFromHistory } from '../../services/group-chat/groupLongTermMemory';
import { buildGroupPublicCharacterPromptCollection } from '../../services/group-chat/buildGroupPublicCharacterPromptContext';
import {
  buildCollectedGroupOfflineSessionRecord,
  isGroupOfflineSessionCollectable,
  removeCollectedGroupOfflineSessionRecord,
  upsertCollectedGroupOfflineSessionRecord,
} from '../../services/group-offline/collectedGroupOfflineSessions';
import {
  buildGroupOfflineWritebackPlan,
  shouldWriteGroupOfflineMemoryBack,
} from '../../services/group-offline/groupOfflineWritebackPlan';
import { buildGroupOfflineUnifiedContextPatch } from '../../services/group-offline/groupOfflineUnifiedContext';
import {
  applyGroupOfflineRecruitResponsesToDraft,
  buildGroupOfflineRecruitStatusSummary,
} from '../../services/group-offline/recruitState';
import { GroupOfflineModal } from '../group-offline/GroupOfflineModal';
import { buildGroupOfflineRecruitCard } from '../group-offline/sessionUtils';
import { parseGroupOfflineRecruitResponses } from './groupOfflineRecruitResponses';

type GroupReplyMessageBuilder = (params: {
  speaker: Character;
  text: string;
  baseTimestamp: number;
}) => ChatMessage[];

type UseGroupOfflineControllerParams = {
  group: ChatGroup;
  members: Character[];
  groupCharacterPool: Character[];
  inviteableCharacters: Character[];
  userName: string;
  activeConfig: ApiConfig | null;
  activeWorldBooks?: WorldBookEntry[];
  history: ChatMessage[];
  directChatHistory?: ChatHistory;
  perception?: PerceptionSettings;
  setHistory: Dispatch<SetStateAction<ChatMessage[]>>;
  onUpdateGroup: (patch: Partial<ChatGroup>) => void;
  patchCharacter: (characterId: string, patch: Partial<Character>) => void;
  buildGeneratedGroupReplyMessages: GroupReplyMessageBuilder;
  onOpen?: () => void;
};

type UseGroupOfflineControllerResult = {
  openGroupOffline: (draft?: GroupOfflineRecruitDraft | null, messageTimestamp?: number | null) => void;
  groupOfflineModal: ReactElement;
};

function extractCandidateJsonObjects(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const seen = new Set<string>();
  const candidates: string[] = [];
  const pushCandidate = (candidate: string | undefined) => {
    const normalized = candidate?.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    pushCandidate(trimmed);
  }

  const fencedBlocks = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const block of fencedBlocks) {
    pushCandidate(block[1]);
  }

  return candidates;
}

function parseGroupOfflineReturnReactions(rawText: string) {
  const candidates = extractCandidateJsonObjects(rawText);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        reactions?: Array<{ characterId?: string; text?: string }>;
      };

      const reactions = Array.isArray(parsed.reactions)
        ? parsed.reactions
            .map((item) => {
              if (!item || typeof item !== 'object') return null;
              const characterId = typeof item.characterId === 'string' ? item.characterId.trim() : '';
              const text = typeof item.text === 'string' ? item.text.trim() : '';
              if (!characterId || !text) return null;
              return { characterId, text };
            })
            .filter((item): item is { characterId: string; text: string } => !!item)
        : [];

      if (reactions.length > 0) {
        return reactions;
      }
    } catch {
      continue;
    }
  }

  return [];
}

function isGroupOfflineRecruitDraftCandidate(value: unknown): value is GroupOfflineRecruitDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<GroupOfflineRecruitDraft>;
  return (
    typeof candidate.createdAt === 'number'
    && typeof candidate.title === 'string'
    && typeof candidate.activityType === 'string'
  );
}

export function useGroupOfflineController(params: UseGroupOfflineControllerParams): UseGroupOfflineControllerResult {
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineModalDraft, setOfflineModalDraft] = useState<GroupOfflineRecruitDraft | null>(null);
  const [offlineModalDraftMessageTimestamp, setOfflineModalDraftMessageTimestamp] = useState<number | null>(null);
  const hasUsableConfig = !!params.activeConfig?.apiKey?.trim();

  const clearOfflineDraftLink = useCallback(() => {
    setOfflineModalDraft(null);
    setOfflineModalDraftMessageTimestamp(null);
  }, []);

  const closeGroupOffline = useCallback(() => {
    setShowOfflineModal(false);
    clearOfflineDraftLink();
  }, [clearOfflineDraftLink]);

  const openGroupOffline = useCallback((draft?: GroupOfflineRecruitDraft | null, messageTimestamp?: number | null) => {
    params.onOpen?.();
    setOfflineModalDraft(isGroupOfflineRecruitDraftCandidate(draft) ? draft : null);
    setOfflineModalDraftMessageTimestamp(typeof messageTimestamp === 'number' ? messageTimestamp : null);
    setShowOfflineModal(true);
  }, [params.onOpen]);

  const buildCollectedOfflineSessionsPatch = useCallback((session: GroupOfflineSession | null | undefined) => {
    if (!session) {
      return undefined;
    }

    if (!session.isCollected || !isGroupOfflineSessionCollectable(session)) {
      return removeCollectedGroupOfflineSessionRecord(params.group.collectedOfflineSessions, session.id);
    }

    return upsertCollectedGroupOfflineSessionRecord(
      params.group.collectedOfflineSessions,
      buildCollectedGroupOfflineSessionRecord({
        session,
        group: {
          id: params.group.id,
          name: params.group.name,
          groupRemark: params.group.groupRemark,
        },
        members: params.groupCharacterPool,
      }),
    );
  }, [
    params.group.collectedOfflineSessions,
    params.group.groupRemark,
    params.group.id,
    params.group.name,
    params.groupCharacterPool,
  ]);

  const runOfflineReturnReactions = useCallback(async (session: GroupOfflineSession) => {
    if (!params.activeConfig || !hasUsableConfig) {
      return;
    }

    const participantMembers = params.members.filter((member) => (
      session.participants.some((participant) => participant.characterId === member.id)
    ));
    if (participantMembers.length === 0) {
      return;
    }

    const roundsSummary = (session.generatedContent?.rounds || [])
      .slice(-2)
      .map((round) => [
        round.sceneText || '',
        ...round.characterEntries.map((entry) => `${entry.speakerLabel}：${entry.text}`),
      ].filter(Boolean).join('\n'))
      .join('\n\n');
    const participantPersonaBlocks = buildGroupPublicCharacterPromptCollection({
      speakers: participantMembers,
      members: params.members,
      group: params.group,
      userName: params.userName,
      history: params.history,
      directChatHistory: params.directChatHistory,
      activeWorldBooks: params.activeWorldBooks,
      perception: params.perception,
    });

    const prompt = [
      '一场群聊线下刚刚结束，所有人现在已经回到原群聊线上聊天。',
      '请生成参与角色回到群聊后的公开反应。',
      '要求：',
      '1. 这不是线下现场续写，不要再写现场动作。',
      '2. 这是回到群聊后的新消息，要像群里真的会发出来的话。',
      '3. 每个角色一条消息，显示为单独的群消息。',
      '4. 不要照搬结束收尾原文，要像回到线上后的新反应。',
      '5. 每条消息都必须优先符合下面给出的角色公开人设摘要，不要把所有人写成同一口气，也不要只按“线下刚结束”这个标签统一写成同一种暧昧或客套口吻。',
      '6. 输出 JSON：{"reactions":[{"characterId":"角色id","text":"消息内容"}]}',
      '',
      `局类型：${session.customActivityType?.trim() || session.activityType}`,
      `地点：${session.location}`,
      `时间：${session.timeLabel}`,
      `在场角色：${participantMembers.map((member) => member.name).join('、')}`,
      '',
      '刚结束的线下内容摘要：',
      roundsSummary || '暂无',
      '',
      '参与角色公开人设摘要：',
      participantPersonaBlocks,
      '',
      '只输出 JSON。',
    ].join('\n');

    try {
      const rawText = await generateTextFromMessagesWithConfig({
        activeConfig: params.activeConfig,
        messages: [{ role: 'user', content: prompt }],
      });
      const reactions = parseGroupOfflineReturnReactions(rawText);
      if (reactions.length === 0) {
        return;
      }

      const reactionMessages: ChatMessage[] = [];
      reactions.forEach((reaction) => {
        const speaker = participantMembers.find((member) => member.id === reaction.characterId);
        if (!speaker) {
          return;
        }

        reactionMessages.push(
          ...params.buildGeneratedGroupReplyMessages({
            speaker,
            text: reaction.text,
            baseTimestamp: Date.now() + reactionMessages.length + 1,
          }),
        );
      });

      if (reactionMessages.length === 0) {
        return;
      }

      params.setHistory((prev) => [
        ...prev,
        ...reactionMessages,
      ]);
    } catch (error) {
      console.error('[group-chat] Failed to generate offline return reactions', error);
    }
  }, [
    params.activeConfig,
    params.activeWorldBooks,
    params.buildGeneratedGroupReplyMessages,
    params.directChatHistory,
    params.group,
    params.history,
    params.members,
    params.perception,
    params.setHistory,
    params.userName,
    hasUsableConfig,
  ]);

  const runOfflineRecruitResponses = useCallback(async (draft: GroupOfflineRecruitDraft, cardTimestamp: number) => {
    if (!params.activeConfig || !hasUsableConfig) {
      return;
    }

    const candidateIds = draft.selectedParticipantIds.length > 0
      ? draft.selectedParticipantIds
      : params.groupCharacterPool.map((member) => member.id);
    const candidateMembers = params.groupCharacterPool.filter((member) => candidateIds.includes(member.id));
    if (candidateMembers.length === 0) {
      return;
    }

    const recruitStatusSummary = buildGroupOfflineRecruitStatusSummary({
      draft,
      fallbackCandidateIds: candidateIds,
      members: candidateMembers,
    });
    const pendingCandidateIds = recruitStatusSummary.pendingIds;
    const pendingCandidateMembers = candidateMembers.filter((member) => pendingCandidateIds.includes(member.id));
    if (pendingCandidateMembers.length === 0) {
      return;
    }

    const candidatePersonaBlocks = buildGroupPublicCharacterPromptCollection({
      speakers: pendingCandidateMembers,
      members: params.members,
      group: params.group,
      userName: params.userName,
      history: params.history,
      directChatHistory: params.directChatHistory,
      activeWorldBooks: params.activeWorldBooks,
      perception: params.perception,
    });

    const prompt = [
      '群里刚发出了一张群聊线下征集卡，现在请生成角色们在群里的公开表态。',
      '要求：',
      '1. 只写会在群里当场接这个话头的角色，不要强行让所有人都发言。',
      '2. 每个角色最多一条消息，消息要像群里当场发出来的话，不要旁白，不要系统说明。',
      '3. decision 只能是 "join" 或 "decline"。',
      '4. join 表示这个角色愿意参加，这条消息里要自然体现出要来、算我一个、俺也去之类的态度。',
      '5. decline 表示这个角色这次不参加，这条消息里要自然带出原因或拦路点，不要只说“不去”。',
      '6. 这是群体征集，不要写成单人独占剧情；可以同时有人报名，也有人婉拒。',
      '7. 每个角色的 decision 和 text 都必须优先符合下面给出的公开人设摘要、说话手感和群内关系起点，不要只看标题、地点、氛围或一句 signature 就硬猜。',
      '8. 公开场合本来更克制、这轮也没必要接话的人，可以不写；不要为了凑数硬让他表态。',
      '9. 只输出 JSON：{"reactions":[{"characterId":"角色id","decision":"join|decline","text":"群里公开消息"}]}。',
      '',
      `征集标题：${draft.title}`,
      `局类型：${draft.customActivityType?.trim() || draft.activityType}`,
      `地点：${draft.location}`,
      `时间：${draft.timeLabel}`,
      `氛围：${draft.vibe}`,
      draft.scenePrompt?.trim() ? `情景：${draft.scenePrompt.trim()}` : '',
      draft.scenarioState?.currentTask ? `当前任务：${draft.scenarioState.currentTask}` : '',
      recruitStatusSummary.joinedLabels.length > 0 ? `已报名：${recruitStatusSummary.joinedLabels.join('、')}` : '',
      recruitStatusSummary.declinedCount > 0 ? `已婉拒：${recruitStatusSummary.declinedCount} 人` : '',
      recruitStatusSummary.pendingCount > 0 ? `这轮重点看剩余待表态的人：${recruitStatusSummary.pendingCount} 人` : '',
      `候选角色：${pendingCandidateMembers.map((member) => `${member.id} / ${member.remarkName?.trim() || member.name}`).join('\n')}`,
      '',
      '候选角色公开人设摘要：',
      candidatePersonaBlocks,
      '',
      '只输出 JSON。',
    ].filter(Boolean).join('\n');

    try {
      const rawText = await generateTextFromMessagesWithConfig({
        activeConfig: params.activeConfig,
        messages: [{ role: 'user', content: prompt }],
      });
      const reactions = parseGroupOfflineRecruitResponses(rawText)
        .filter((item) => pendingCandidateIds.includes(item.characterId));
      if (reactions.length === 0) {
        return;
      }

      const reactionMessages: ChatMessage[] = [];
      const responseTimestamp = Date.now();
      const responseRecords = reactions.map((reaction, index) => ({
        characterId: reaction.characterId,
        decision: reaction.decision,
        text: reaction.text,
        respondedAt: responseTimestamp + index,
      }));
      reactions.forEach((reaction) => {
        const speaker = pendingCandidateMembers.find((member) => member.id === reaction.characterId);
        if (!speaker) {
          return;
        }
        reactionMessages.push(
          ...params.buildGeneratedGroupReplyMessages({
            speaker,
            text: reaction.text,
            baseTimestamp: Date.now() + reactionMessages.length + 1,
          }),
        );
      });

      if (reactionMessages.length === 0) {
        return;
      }

      params.setHistory((prev) => {
        const nextHistory = prev.map((message) => {
          if (message.timestamp !== cardTimestamp) {
            return message;
          }

          const existingDraft = message.groupOfflineDraft || draft;
          const nextDraft = applyGroupOfflineRecruitResponsesToDraft({
            draft: existingDraft,
            incomingResponses: responseRecords,
            fallbackCandidateIds: candidateIds,
            members: params.groupCharacterPool,
          });

          return {
            ...message,
            groupOfflineDraft: nextDraft,
            groupOfflineCard: buildGroupOfflineRecruitCard({
              draft: nextDraft,
              createdBy: message.groupOfflineCard?.createdBy || params.userName,
              timestamp: message.timestamp,
              status: 'recruiting',
            }),
          };
        });

        return [...nextHistory, ...reactionMessages];
      });
    } catch (error) {
      console.error('[group-chat] Failed to generate offline recruit reactions', error);
    }
  }, [
    params.activeConfig,
    params.activeWorldBooks,
    params.buildGeneratedGroupReplyMessages,
    params.directChatHistory,
    params.group,
    params.groupCharacterPool,
    params.history,
    params.members,
    params.perception,
    params.setHistory,
    params.userName,
    hasUsableConfig,
  ]);

  const handleRecruitDraftUpdate = useCallback((draft: GroupOfflineRecruitDraft) => {
    setOfflineModalDraft(draft);
    if (offlineModalDraftMessageTimestamp === null) {
      return;
    }

    params.setHistory((prev) => prev.map((message) => {
      if (message.timestamp !== offlineModalDraftMessageTimestamp) {
        return message;
      }

      const createdBy = message.groupOfflineCard?.createdBy || params.userName;
      return {
        ...message,
        groupOfflineDraft: draft,
        groupOfflineCard: buildGroupOfflineRecruitCard({
          draft,
          createdBy,
          timestamp: message.timestamp,
          status: 'recruiting',
        }),
      };
    }));
  }, [offlineModalDraftMessageTimestamp, params.setHistory, params.userName]);

  const handleSessionStart = useCallback((session: GroupOfflineSession, startMessage: ChatMessage) => {
    if (offlineModalDraftMessageTimestamp !== null) {
      const launchedParticipantIds = session.participants.map((participant) => participant.characterId);
      const launchedParticipantLabels = params.groupCharacterPool
        .filter((member) => launchedParticipantIds.includes(member.id))
        .map((member) => member.remarkName?.trim() || member.name);
      params.setHistory((prev) => prev.map((message) => {
        if (message.timestamp !== offlineModalDraftMessageTimestamp) {
          return message;
        }

        const existingDraft = message.groupOfflineDraft || offlineModalDraft;
        const nextDraft = existingDraft
          ? {
              ...existingDraft,
              selectedParticipantIds: launchedParticipantIds,
              participantLabels: launchedParticipantLabels,
              signedUpParticipantIds: launchedParticipantIds,
              launchedAt: session.createdAt,
              recruitCardSessionId: existingDraft.recruitCardSessionId || message.groupOfflineCard?.sessionId,
            }
          : undefined;
        return {
          ...message,
          groupOfflineDraft: nextDraft,
          groupOfflineCard: nextDraft
            ? buildGroupOfflineRecruitCard({
                draft: nextDraft,
                createdBy: message.groupOfflineCard?.createdBy || params.userName,
                timestamp: message.timestamp,
                status: 'active',
                participantLabelsOverride: launchedParticipantLabels,
                summaryLinesOverride: ['已按报名名单发起群线下。'],
              })
            : message.groupOfflineCard
              ? {
                  ...message.groupOfflineCard,
                  status: 'active' as const,
                  participantLabels: launchedParticipantLabels,
                  statusLabel: '已开局',
                  summaryLines: ['已发起群线下。'],
                }
              : message.groupOfflineCard,
        };
      }));
    }

    params.onUpdateGroup({
      activeOfflineSession: session,
      collectedOfflineSessions: buildCollectedOfflineSessionsPatch(session),
    });
    params.setHistory((prev) => [...prev, startMessage]);
    clearOfflineDraftLink();
  }, [
    buildCollectedOfflineSessionsPatch,
    clearOfflineDraftLink,
    offlineModalDraft,
    offlineModalDraftMessageTimestamp,
    params.groupCharacterPool,
    params.onUpdateGroup,
    params.setHistory,
    params.userName,
  ]);

  const handleSessionUpdate = useCallback((nextSession: GroupOfflineSession | null) => {
    const collectedOfflineSessions = buildCollectedOfflineSessionsPatch(nextSession);
    params.onUpdateGroup({
      activeOfflineSession: nextSession,
      ...(collectedOfflineSessions ? { collectedOfflineSessions } : {}),
    });
  }, [buildCollectedOfflineSessionsPatch, params.onUpdateGroup]);

  const handlePublishRecruitCard = useCallback((draft: GroupOfflineRecruitDraft, cardMessage: ChatMessage) => {
    params.setHistory((prev) => [...prev, cardMessage]);
    setOfflineModalDraft(draft);
    setOfflineModalDraftMessageTimestamp(null);
    setShowOfflineModal(false);
    void runOfflineRecruitResponses(draft, cardMessage.timestamp);
  }, [params.setHistory, runOfflineRecruitResponses]);

  const handleContinueRecruitRound = useCallback((draft: GroupOfflineRecruitDraft) => {
    const cardTimestamp = offlineModalDraftMessageTimestamp;
    if (cardTimestamp === null) {
      closeGroupOffline();
      return;
    }

    params.setHistory((prev) => prev.map((message) => (
      message.timestamp === cardTimestamp
        ? {
            ...message,
            groupOfflineDraft: draft,
            groupOfflineCard: buildGroupOfflineRecruitCard({
              draft,
              createdBy: message.groupOfflineCard?.createdBy || params.userName,
              timestamp: message.timestamp,
              status: 'recruiting',
            }),
          }
        : message
    )));
    closeGroupOffline();
    void runOfflineRecruitResponses(draft, cardTimestamp);
  }, [closeGroupOffline, offlineModalDraftMessageTimestamp, params.setHistory, params.userName, runOfflineRecruitResponses]);

  const handleSessionComplete = useCallback((payload: {
    archivedSession: GroupOfflineSession;
    endMessage: ChatMessage;
    followupMessages: ChatMessage[];
  }) => {
    const { archivedSession, endMessage, followupMessages } = payload;
    const settledParticipantIds = archivedSession.participants.map((participant) => participant.characterId);
    const settledParticipantLabels = params.groupCharacterPool
      .filter((member) => settledParticipantIds.includes(member.id))
      .map((member) => member.remarkName?.trim() || member.name);
    const historyWithRecruitCardState = archivedSession.sourceRecruitCardSessionId
      ? params.history.map((message) => {
          if (message.groupOfflineCard?.sessionId !== archivedSession.sourceRecruitCardSessionId) {
            return message;
          }

          const existingDraft = message.groupOfflineDraft;
          const nextDraft = existingDraft
            ? {
                ...existingDraft,
                selectedParticipantIds: settledParticipantIds,
                participantLabels: settledParticipantLabels,
                signedUpParticipantIds: settledParticipantIds,
                launchedAt: archivedSession.endedAt || Date.now(),
              }
            : undefined;

          return {
            ...message,
            groupOfflineDraft: nextDraft,
            groupOfflineCard: nextDraft
              ? buildGroupOfflineRecruitCard({
                  draft: nextDraft,
                  createdBy: message.groupOfflineCard?.createdBy || params.userName,
                  timestamp: message.timestamp,
                  status: 'ended',
                  participantLabelsOverride: settledParticipantLabels,
                  summaryLinesOverride: [
                    '这张征集卡对应的群线下已结束。',
                    ...(archivedSession.summaryCard?.lines?.slice(0, 1) || []),
                  ],
                })
              : message.groupOfflineCard
                ? {
                    ...message.groupOfflineCard,
                    status: 'ended' as const,
                    participantLabels: settledParticipantLabels,
                    statusLabel: '已结束',
                    summaryLines: ['这张征集卡对应的群线下已结束。'],
                  }
                : message.groupOfflineCard,
          };
        })
      : params.history;
    const nextHistory = [...historyWithRecruitCardState, endMessage, ...followupMessages];
    params.onUpdateGroup({
      activeOfflineSession: null,
      currentScene: archivedSession.location,
      collectedOfflineSessions: buildCollectedOfflineSessionsPatch(archivedSession),
    });
    params.setHistory(nextHistory);
    void (async () => {
      const participantMembers = params.groupCharacterPool.filter((member) => (
        archivedSession.participants.some((participant) => participant.characterId === member.id)
      ));
      if (participantMembers.length === 0) {
        return;
      }

      const writebackPlan = buildGroupOfflineWritebackPlan(archivedSession, participantMembers);
      if (!shouldWriteGroupOfflineMemoryBack(archivedSession)) {
        return;
      }

      try {
        const results = await persistSceneSettlementBatch(
          participantMembers.map((member) => ({
            characterId: member.id,
            sourceScene: 'group_offline',
            sourceSessionType: 'group',
            sourceSessionId: archivedSession.id,
            settlement: buildGroupOfflineSharedSettlement(member, archivedSession, {
              writebackPlan,
            }),
            timestamp: archivedSession.endedAt || Date.now(),
          })),
        );

        results.forEach((result, index) => {
          const member = participantMembers[index];
          if (!member) return;
          params.patchCharacter(member.id, result.characterPatch);
        });

        const groupShortTermSummary = writebackPlan.sharedEventSummary
          || archivedSession.summaryCard?.lines
            ?.map((line) => line.trim())
            .filter(Boolean)
            .join('\n');
        const groupMemberPerspectiveSummaries = Object.fromEntries(
          participantMembers.map((member, index) => {
            const result = results[index];
            return [member.id, result?.characterPatch.shortTermSummary || ''] as const;
          })
            .filter((entry) => entry[1].trim().length > 0),
        );
        const memberNames = Object.fromEntries(
          params.groupCharacterPool.map((member) => [member.id, member.remarkName?.trim() || member.name] as const),
        );
        const nextGroupLongTermMemory = deriveGroupLongTermMemoryFromHistory({
          history: nextHistory,
          memberIds: params.group.memberIds,
          memberNames,
          previous: params.group.groupLongTermMemory,
          backgroundSummary: params.group.backgroundSummary,
          publicFacts: params.group.publicFacts,
        });
        const unifiedContextPatch = buildGroupOfflineUnifiedContextPatch({
          session: archivedSession,
          members: participantMembers,
          existingRelationshipWaves: params.group.relationshipWaves,
          existingFactTraces: params.group.factTraces,
          writebackPlan,
        });

        params.onUpdateGroup({
          ...(groupShortTermSummary ? { groupShortTermSummary } : {}),
          ...(Object.keys(groupMemberPerspectiveSummaries).length > 0
            ? {
                groupMemberPerspectiveSummaries: {
                  ...(params.group.groupMemberPerspectiveSummaries || {}),
                  ...groupMemberPerspectiveSummaries,
                },
              }
            : {}),
          ...(nextGroupLongTermMemory ? { groupLongTermMemory: nextGroupLongTermMemory } : {}),
          relationshipWaves: unifiedContextPatch.relationshipWaves,
          factTraces: unifiedContextPatch.factTraces,
        });
      } catch (error) {
        console.error('[group-chat] Failed to persist group offline settlement memory snapshots', error);
      }
    })();
    void runOfflineReturnReactions(archivedSession);
  }, [
    buildCollectedOfflineSessionsPatch,
    params.group,
    params.groupCharacterPool,
    params.history,
    params.onUpdateGroup,
    params.patchCharacter,
    params.setHistory,
    params.userName,
    runOfflineReturnReactions,
  ]);

  return {
    openGroupOffline,
    groupOfflineModal: (
      <GroupOfflineModal
        isOpen={showOfflineModal}
        group={params.group}
        members={params.members}
        inviteableCharacters={params.inviteableCharacters}
        userName={params.userName}
        activeConfig={params.activeConfig}
        activeWorldBooks={params.activeWorldBooks}
        history={params.history}
        directChatHistory={params.directChatHistory}
        perception={params.perception}
        initialSession={params.group.activeOfflineSession || null}
        initialDraft={offlineModalDraft}
        onClose={closeGroupOffline}
        onRecruitDraftUpdate={handleRecruitDraftUpdate}
        onSessionStart={handleSessionStart}
        onSessionUpdate={handleSessionUpdate}
        onPublishRecruitCard={handlePublishRecruitCard}
        onContinueRecruitRound={handleContinueRecruitRound}
        onSessionComplete={handleSessionComplete}
      />
    ),
  };
}
