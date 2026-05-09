import type {
  DreamCustomTag,
  DreamGeneratedChoice,
  DreamGenerationMode,
  DreamRuntimeScenario,
  DreamWorldBookConfig,
} from '../../services/dream/dreamRuntimeTypes';
import type { DreamDepth, DreamDomainId, DreamEntryMode, DreamTagCategory } from './types';

export const DREAM_LATEST_SESSION_KEY = 'dream_app_latest_session';
export const DREAM_BACKGROUND_RESUME_REQUEST_KEY = 'dream_background_resume_request';
export const DREAM_SELECTED_ROLE_KEY = 'dream_selected_role_id';

export type DreamResumeStage = 'scene' | 'choices' | 'reaction' | 'ending' | 'aftermath';

export type PersistedDreamSelectedChoice = DreamGeneratedChoice & {
  reaction: string;
  fromCustom?: boolean;
};

export type PersistedDreamSession = {
  resumeKind?: 'saved' | 'background_exit';
  mode: DreamEntryMode;
  generationMode?: DreamGenerationMode;
  roleId: string;
  domain: DreamDomainId;
  depth: DreamDepth;
  selectedTags: Record<DreamTagCategory, string[]>;
  customTags?: DreamCustomTag[];
  supplementNote?: string;
  dreamWorldBookConfig?: DreamWorldBookConfig;
  scenario: DreamRuntimeScenario;
  createdAt: number;
  progress?: {
    stage: DreamResumeStage;
    actIndex: number;
    selectedChoice: PersistedDreamSelectedChoice | null;
    closingActId: string | null;
    customInput: string;
    customInputOpen: boolean;
  };
};

export type DreamResumableState = {
  source: 'saved';
  roleId: string;
  generationMode?: DreamGenerationMode;
  dreamWorldBookConfig?: DreamWorldBookConfig;
  scenario: DreamRuntimeScenario;
  createdAt: number;
  progress?: PersistedDreamSession['progress'];
};

export type DreamBackgroundResumeRequest = {
  taskId?: string;
  requestKey?: string;
};

export function readPersistedDreamSession(): PersistedDreamSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(DREAM_LATEST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDreamSession | null;
    if (!parsed?.scenario || !parsed.roleId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readPersistedDreamSelectedRoleId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(DREAM_SELECTED_ROLE_KEY);
    const roleId = raw?.trim();
    return roleId || null;
  } catch {
    return null;
  }
}

export function writePersistedDreamSelectedRoleId(roleId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DREAM_SELECTED_ROLE_KEY, roleId);
}

export function writePersistedDreamSession(session: PersistedDreamSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DREAM_LATEST_SESSION_KEY, JSON.stringify(session));
}

export function clearPersistedDreamSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DREAM_LATEST_SESSION_KEY);
}

export function writeDreamBackgroundResumeRequest(request: DreamBackgroundResumeRequest) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DREAM_BACKGROUND_RESUME_REQUEST_KEY, JSON.stringify(request));
}

export function clearDreamBackgroundResumeRequest() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DREAM_BACKGROUND_RESUME_REQUEST_KEY);
}

export function isDreamResumeStage(stage: string | undefined): stage is DreamResumeStage {
  return stage === 'scene' || stage === 'choices' || stage === 'reaction' || stage === 'ending' || stage === 'aftermath';
}

export function isPersistedDreamUnfinished(session: PersistedDreamSession | null) {
  if (!session) return false;
  return !(session.scenario.endingOutput && session.scenario.aftermathOutput);
}

export function formatPersistedDreamTime(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function buildDreamResumableState(savedSession: PersistedDreamSession | null): DreamResumableState | null {
  const unfinishedSaved = savedSession
    && (savedSession.resumeKind === 'saved' || savedSession.resumeKind === 'background_exit' || !savedSession.resumeKind)
    && isPersistedDreamUnfinished(savedSession)
    ? {
        source: 'saved' as const,
        roleId: savedSession.roleId,
        generationMode: savedSession.generationMode,
        dreamWorldBookConfig: savedSession.dreamWorldBookConfig,
        scenario: savedSession.scenario,
        createdAt: savedSession.createdAt,
        progress: savedSession.progress,
      }
    : null;

  return unfinishedSaved;
}
