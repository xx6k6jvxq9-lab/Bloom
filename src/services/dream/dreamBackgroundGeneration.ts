import type { DreamRuntimeScenario, GenerateDreamScenarioOptions } from './dreamRuntimeTypes';
import { generateDreamScenario } from './generateDreamScenario';

export const DREAM_BACKGROUND_EVENT = 'dream:background-generation';

type DreamBackgroundEventDetail =
  | {
      kind: 'completed';
      taskId: string;
      title: string;
      roleName: string;
    }
  | {
      kind: 'failed';
      taskId: string;
      roleName: string;
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

function normalizeRequestKey(options: GenerateDreamScenarioOptions) {
  const normalizedTags = Object.entries(options.selection.selectedTags)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, ids]) => [category, [...ids].sort()]);

  return JSON.stringify({
    characterId: options.character.id,
    configId: options.activeConfig.id,
    entryMode: options.selection.entryMode,
    domainId: options.selection.domainId,
    depth: options.selection.depth,
    selectedTags: normalizedTags,
  });
}

function dispatchBackgroundEvent(detail: DreamBackgroundEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DreamBackgroundEventDetail>(DREAM_BACKGROUND_EVENT, { detail }));
}

export function getCurrentDreamBackgroundTask() {
  return currentTask?.snapshot ?? null;
}

export function startDreamBackgroundGeneration(options: GenerateDreamScenarioOptions) {
  const requestKey = normalizeRequestKey(options);
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
        dispatchBackgroundEvent({
          kind: 'completed',
          taskId,
          title: scenario.coverTitle || scenario.storyFrame.worldTitle || '梦境已生成',
          roleName: options.character.remarkName?.trim() || options.character.name || '角色',
        });
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
          errorMessage,
        });
      }
      throw error;
    });

  currentTask = {
    snapshot: pendingSnapshot,
    promise,
  };

  return promise;
}
