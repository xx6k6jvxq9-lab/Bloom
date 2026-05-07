import type { DreamRuntimeScenario, GenerateDreamScenarioOptions } from './dreamRuntimeTypes';
import { generateDreamScenario } from './generateDreamScenario';

export const DREAM_BACKGROUND_EVENT = 'dream:background-generation';
export const DREAM_BACKGROUND_TOAST_READY_EVENT = 'dream:background-toast-ready';
const DREAM_LATEST_SESSION_KEY = 'dream_app_latest_session';
const DREAM_BACKGROUND_RESUME_REQUEST_KEY = 'dream_background_resume_request';
const DREAM_BACKGROUND_TOAST_KEY = 'dream_background_toast_pending';

type DreamBackgroundResumeRequest = {
  taskId?: string;
  requestKey?: string;
};

export type DreamBackgroundEventDetail =
  | {
      kind: 'completed';
      taskId: string;
      title: string;
      roleName: string;
      roleId: string;
      roleAvatar?: string;
      shouldNotify: boolean;
    }
  | {
      kind: 'failed';
      taskId: string;
      roleName: string;
      roleId: string;
      shouldNotify: boolean;
      errorMessage: string;
    };

type DreamBackgroundTaskSnapshot =
  | {
      id: string;
      requestKey: string;
      status: 'pending';
      options: GenerateDreamScenarioOptions;
      startedAt: number;
    }
  | {
      id: string;
      requestKey: string;
      status: 'resolved';
      options: GenerateDreamScenarioOptions;
      scenario: DreamRuntimeScenario;
      startedAt: number;
      finishedAt: number;
    }
  | {
      id: string;
      requestKey: string;
      status: 'rejected';
      options: GenerateDreamScenarioOptions;
      errorMessage: string;
      startedAt: number;
      finishedAt: number;
    };

type DreamBackgroundTask = {
  snapshot: DreamBackgroundTaskSnapshot;
  promise: Promise<DreamRuntimeScenario>;
};

let currentTask: DreamBackgroundTask | null = null;

export function buildDreamBackgroundRequestKey(options: GenerateDreamScenarioOptions) {
  const normalizedTags = Object.entries(options.selection.selectedTags)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, ids]) => [category, [...ids].sort()]);
  const normalizedWorldBooks = [...options.worldBooks]
    .map((entry) => ({
      id: entry.id,
      title: entry.title?.trim() || '',
      priorityLevel: entry.priorityLevel || 'normal',
      contentPreview: entry.content?.trim().slice(0, 80) || '',
      contentLength: entry.content?.trim().length || 0,
    }))
    .sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'));

  return JSON.stringify({
    characterId: options.character.id,
    configId: options.activeConfig.id,
    entryMode: options.selection.entryMode,
    domainId: options.selection.domainId,
    depth: options.selection.depth,
    selectedTags: normalizedTags,
    worldBooks: normalizedWorldBooks,
  });
}

function dispatchBackgroundEvent(detail: DreamBackgroundEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DreamBackgroundEventDetail>(DREAM_BACKGROUND_EVENT, { detail }));
}

function readBackgroundResumeRequestTaskId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DREAM_BACKGROUND_RESUME_REQUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DreamBackgroundResumeRequest | null;
    if (!parsed?.taskId && !parsed?.requestKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearBackgroundResumeRequest() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DREAM_BACKGROUND_RESUME_REQUEST_KEY);
}

function writeBackgroundToast(detail: Extract<DreamBackgroundEventDetail, { kind: 'completed' }>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DREAM_BACKGROUND_TOAST_KEY, JSON.stringify(detail));
  window.dispatchEvent(new CustomEvent(DREAM_BACKGROUND_TOAST_READY_EVENT, { detail }));
}

function shouldNotifyForCompletedTask(taskId: string, requestKey: string) {
  void taskId;
  void requestKey;
  return Boolean(readBackgroundResumeRequestTaskId());
}

function persistCompletedDream(
  options: GenerateDreamScenarioOptions,
  scenario: DreamRuntimeScenario,
) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    DREAM_LATEST_SESSION_KEY,
    JSON.stringify({
      resumeKind: 'background_exit',
      mode: options.selection.entryMode,
      roleId: options.character.id,
      domain: options.selection.domainId,
      depth: options.selection.depth,
      selectedTags: options.selection.selectedTags,
      dreamWorldBookConfig: options.dreamWorldBookConfig,
      scenario,
      createdAt: Date.now(),
      progress: {
        stage: 'scene',
        actIndex: 0,
        selectedChoice: null,
        closingActId: null,
        customInput: '',
        customInputOpen: false,
      },
    }),
  );
}

export function getCurrentDreamBackgroundTask() {
  return currentTask?.snapshot ?? null;
}

export function startDreamBackgroundGeneration(options: GenerateDreamScenarioOptions) {
  const requestKey = buildDreamBackgroundRequestKey(options);
  if (currentTask?.snapshot.status === 'pending' && currentTask.snapshot.requestKey === requestKey) {
    return currentTask.promise;
  }

  const taskId = `dream-bg-${Date.now()}`;
  const startedAt = Date.now();
  const pendingSnapshot: DreamBackgroundTaskSnapshot = {
    id: taskId,
    requestKey,
    status: 'pending',
    options,
    startedAt,
  };

  let promise: Promise<DreamRuntimeScenario>;

  promise = generateDreamScenario(options)
    .then((scenario) => {
      if (currentTask?.snapshot.id === taskId) {
        currentTask = {
          snapshot: {
            ...pendingSnapshot,
            status: 'resolved',
            scenario,
            finishedAt: Date.now(),
          },
          promise: Promise.resolve(scenario),
        };
        const completedDetail = {
          kind: 'completed',
          taskId,
          title: scenario.coverTitle || scenario.storyFrame.worldTitle || '梦境已生成',
          roleName: options.character.remarkName?.trim() || options.character.name || '角色',
          roleId: options.character.id,
          roleAvatar: options.character.avatar,
          shouldNotify: shouldNotifyForCompletedTask(taskId, requestKey),
        } as const;
        if (completedDetail.shouldNotify) {
          persistCompletedDream(options, scenario);
          writeBackgroundToast(completedDetail);
          clearBackgroundResumeRequest();
        }
        dispatchBackgroundEvent(completedDetail);
      }
      return scenario;
    })
    .catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : '梦境生成失败';
      if (currentTask?.snapshot.id === taskId) {
        currentTask = {
          snapshot: {
            ...pendingSnapshot,
            status: 'rejected',
            errorMessage,
            finishedAt: Date.now(),
          },
          promise,
        };
        dispatchBackgroundEvent({
          kind: 'failed',
          taskId,
          roleName: options.character.remarkName?.trim() || options.character.name || '角色',
          roleId: options.character.id,
          shouldNotify: shouldNotifyForCompletedTask(taskId, requestKey),
          errorMessage,
        });
        if (shouldNotifyForCompletedTask(taskId, requestKey)) {
          clearBackgroundResumeRequest();
        }
      }
      throw error;
    });

  currentTask = {
    snapshot: pendingSnapshot,
    promise,
  };

  return promise;
}
