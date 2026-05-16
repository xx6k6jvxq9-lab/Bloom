import type {
  GroupOfflineRoundPlanSnapshot,
  GroupOfflineRoundRuntimeProjectionSnapshot,
} from '../../types';

export type GroupOfflineProjectionIdentity =
  GroupOfflineRoundRuntimeProjectionSnapshot['characters'][number]['identity'];

export type GroupOfflineProjectionPersona =
  GroupOfflineRoundRuntimeProjectionSnapshot['characters'][number]['persona'];

export type GroupOfflineProjectionMemory =
  GroupOfflineRoundRuntimeProjectionSnapshot['characters'][number]['memory'];

export type GroupOfflineProjectionUserRelation =
  GroupOfflineRoundRuntimeProjectionSnapshot['characters'][number]['userRelation'];

export type GroupOfflineProjectionPeerRelation =
  GroupOfflineRoundRuntimeProjectionSnapshot['characters'][number]['peerRelations'][number];

export type GroupOfflineProjectionGroupState =
  GroupOfflineRoundRuntimeProjectionSnapshot['characters'][number]['groupState'];

export type GroupOfflineCharacterRuntimeProjection =
  GroupOfflineRoundRuntimeProjectionSnapshot['characters'][number];

export type GroupOfflineGroupRuntimeSummary =
  GroupOfflineRoundRuntimeProjectionSnapshot['groupSummary'];

export type GroupOfflineRuntimeProjection =
  GroupOfflineRoundRuntimeProjectionSnapshot & {
    session: {
      id: string;
      groupId: string;
      mode: 'daily' | 'scenario' | 'random';
      generationMode?: 'blocks' | 'ensemble' | 'single' | 'pair' | 'group';
      activityType: string;
      customActivityType?: string;
      location: string;
      timeLabel: string;
      weatherLabel: string;
      vibe: string;
      currentRound: number;
    };
    generatedAt: number;
  };

export type GroupOfflinePromptInput = {
  relationshipContextByCharacterId: Record<string, string>;
  groupStateSummary?: string;
};

export type GroupOfflineRoundPlanCharacterStep =
  GroupOfflineRoundPlanSnapshot['characterSteps'][number];

export type GroupOfflineRoundPlan = GroupOfflineRoundPlanSnapshot;
