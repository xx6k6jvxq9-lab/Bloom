import type {
  Character,
  ChatHistory,
  CoupleSpaceData,
  CoupleSpaceInitiativeCadence,
  CoupleSpaceInitiativeSettings,
  CoupleSpaceInitiativeSource,
  Mask,
  UserProfileExtended,
  WorldBookEntry,
} from '../../../../types';
import type { CharacterCoreSectionsInput } from '../../prompts/character/characterCore';
import type {
  CoupleSpaceInitiativeActionType,
  CoupleSpacePromptCommonInput,
  CoupleSpacePromptMode,
} from '../../prompts/coupleSpace/types';

export type CreateCoupleSpacePromptCommonInputSource = {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory?: ChatHistory | null;
  characters?: Character[];
  masks?: Mask[];
  worldBooks?: WorldBookEntry[];
  settings?: {
    initiativeSettings?: CoupleSpaceInitiativeSettings;
  } | null;
  now?: number;
};

export type CoupleSpacePromptSceneInput = {
  mode?: CoupleSpacePromptMode;
  actionType?: CoupleSpaceInitiativeActionType;
  source?: CoupleSpaceInitiativeSource;
  subScene?: string;
  currentSubScene?: string;
  triggerReason?: string;
  relatedContentSummary?: string;
  sharedMomentsSummary?: string;
  occasion?: string;
};

export type CoupleSpacePromptContextBuildOptions = {
  historyLimit?: number;
  includeRecentChatTranscript?: boolean;
  includeRecentChatTurns?: boolean;
  includeRecentChatSummary?: boolean;
  includeRelatedChatContext?: boolean;
  includeRecentRelationshipEvents?: boolean;
  includeRecentCoupleSpaceArtifacts?: boolean;
  recentChatTurnLimit?: number;
  relatedChatTurnLimit?: number;
  relationshipEventLimit?: number;
  allowHeavyContext?: boolean;
  preferRelatedContextOverFullTranscript?: boolean;
};

export type CoupleSpaceRecentChatTurn = {
  role: 'user' | 'character';
  authorLabel: string;
  text: string;
  timestamp: number;
  replyToAuthorLabel?: string;
  replyPreview?: string;
};

export type CoupleSpaceRelationshipEvent = {
  id: string;
  domain: 'chat' | 'love_letter' | 'co_note' | 'message_board' | 'post' | 'comment';
  direction: 'user_to_character' | 'character_to_user' | 'mutual';
  summary: string;
  timestamp: number;
  emotionalWeight?: 'light' | 'medium' | 'high';
  tags?: string[];
  sourceRef?: {
    type: string;
    id: string;
  };
};

export type CoupleSpaceRecentArtifactSummary = {
  type: 'love_letter' | 'co_note' | 'message_board' | 'post' | 'comment_reply';
  authorId: string;
  authorLabel: string;
  summary: string;
  timestamp: number;
};

export type CoupleSpacePromptRuntimePolicy = {
  generationPolicy: {
    enabled: boolean;
    cadenceOrOpportunity: CoupleSpaceInitiativeCadence | 'off';
    cooldownMinutes?: number;
  };
  promptBudgetPolicy: {
    historyWindowSize: number;
    maxRecentTurns: number;
    allowHeavyContext: boolean;
    includeRelatedChatContext: boolean;
    preferRelatedContextOverFullTranscript: boolean;
    maxRelationshipEvents: number;
    maxRecentArtifacts: number;
  };
};

export type CoupleSpacePromptCommonInputDiagnostics = {
  usedMaskId?: string;
  usedWorldBookIds?: string[];
  historyMessageCount?: number;
  selectedRecentTurnCount?: number;
  selectedRelationshipEventCount?: number;
  selectedArtifactCount?: number;
  warnings?: string[];
};

export type CoupleSpacePromptCommonSections = CoupleSpacePromptCommonInput & {
  characterCore?: CharacterCoreSectionsInput;
  recentContext?: CoupleSpacePromptCommonInput['recentContext'] & {
    recentChatTurns?: CoupleSpaceRecentChatTurn[];
    recentChatTranscript?: string;
    recentChatSummary?: string;
    recentRelationshipEvents?: CoupleSpaceRelationshipEvent[];
    recentCoupleSpaceArtifacts?: CoupleSpaceRecentArtifactSummary[];
    crossDomainRelationshipMemory?: string;
  };
};

export type CoupleSpacePromptCommonInputEnvelope = {
  common: CoupleSpacePromptCommonSections;
  policy: CoupleSpacePromptRuntimePolicy;
  diagnostics: CoupleSpacePromptCommonInputDiagnostics;
};
