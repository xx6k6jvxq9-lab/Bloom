import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  Copy,
  Cpu,
  Key,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Volume2,
} from 'lucide-react';
import { motion } from 'motion/react';

import type {
  ApiConfig,
  AppSettings,
  Character,
  SavedTtsVoiceRecord,
  SingleChatCallConfig,
} from '../../types';
import { AppSelect } from '../shared/AppSelect';
import {
  fetchAvailableModels,
  filterAvailableModels,
} from '../../services/ai/apiCenter/modelDiscovery';
import {
  convertLegacyApiConfigToProviderConfig,
  convertProviderConfigToLegacyApiConfig,
  ensureApiCenterConfig,
} from '../../services/ai/apiCenter/defaults';
import { testApiConnection } from '../../services/ai/apiCenter/testApiConnection';
import { testTtsVoice } from '../../services/ai/apiCenter/testTtsVoice';
import { cloneTtsVoice } from '../../services/ai/apiCenter/cloneTtsVoice';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { usePersistentFieldActions } from '../../features/persistence/usePersistentFieldActions';
import { copyTextContent } from '../../services/chat/messageActions';
import { showInAppAlert, showInAppConfirm } from '../../utils';
import { TtsVoiceManagementPanel } from './TtsVoiceManagementPanel';
import { looksLikeMinimaxConfig } from '../../services/ai/apiCenter/minimaxCatalog';

type SettingsAppProps = {
  onBack: () => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  defaultConfig: ApiConfig;
  characters: Character[];
};

type SceneKind = 'single-chat' | 'group-chat' | 'forum' | 'dating' | 'tts';
type RoleScopeMode = 'all' | 'include' | 'exclude';

type DefaultEditorState = {
  kind: 'default';
  editingConfigId: string | null;
  form: ApiConfig;
};

type SceneEditorState = {
  kind: 'scene';
  editingSceneId: string | null;
  scene: SceneKind;
  enabled: boolean;
  name: string;
  roleScopeMode: RoleScopeMode;
  characterIds: string[];
  config: ApiConfig;
  defaultVoiceId: string;
  defaultVoiceSampleAssetId: string;
  defaultVoiceSampleName: string;
  supportsVoiceClone: boolean;
  voiceLibraryRecords: SavedTtsVoiceRecord[];
};

type EditorState = DefaultEditorState | SceneEditorState;

type SceneCard = {
  id: string;
  scene: SceneKind;
  name: string;
  enabled: boolean;
  config: ApiConfig;
  roleScopeMode?: RoleScopeMode;
  characterIds?: string[];
  defaultVoiceId?: string;
  defaultVoiceSampleAssetId?: string;
  defaultVoiceSampleName?: string;
  supportsVoiceClone?: boolean;
  voiceLibraryRecords?: SavedTtsVoiceRecord[];
};

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const PROVIDER_OPTIONS = [
  { value: 'Google Gemini', label: 'Google Gemini' },
  { value: 'OpenAI Compatible', label: 'OpenAI Compatible' },
  { value: 'Custom', label: '自定义 (Custom)' },
];

function normalizeProviderLabel(provider: string | undefined, baseUrl: string | undefined): string {
  const normalizedProvider = provider?.trim().toLowerCase() || '';
  const normalizedBaseUrl = baseUrl?.trim().toLowerCase() || '';

  if (normalizedProvider.includes('gemini')) {
    return 'Google Gemini';
  }

  if (normalizedProvider.includes('openai')) {
    return 'OpenAI Compatible';
  }

  if (normalizedProvider.includes('custom')) {
    return 'Custom';
  }

  if (!normalizedBaseUrl) {
    return 'Google Gemini';
  }

  if (normalizedBaseUrl.includes('openai') || normalizedBaseUrl.endsWith('/v1')) {
    return 'OpenAI Compatible';
  }

  return 'Custom';
}

function normalizeConfigForEdit(config: ApiConfig): ApiConfig {
  return {
    ...config,
    provider: normalizeProviderLabel(config.provider, config.baseUrl),
    model: config.model || DEFAULT_MODEL,
    temperature: typeof config.temperature === 'number' ? config.temperature : 0.7,
  };
}

function createEmptyApiConfig(seed?: ApiConfig): ApiConfig {
  const normalizedSeed = seed ? normalizeConfigForEdit(seed) : null;
  return {
    id: `api-${Date.now()}`,
    name: normalizedSeed?.name || '',
    provider: normalizedSeed?.provider || 'Google Gemini',
    apiKey: normalizedSeed?.apiKey || '',
    baseUrl: normalizedSeed?.baseUrl || '',
    model: normalizedSeed?.model || DEFAULT_MODEL,
    temperature: typeof normalizedSeed?.temperature === 'number' ? normalizedSeed.temperature : 0.7,
  };
}

function createSceneEditorState(scene: SceneKind, seed?: ApiConfig): SceneEditorState {
  return {
    kind: 'scene',
    editingSceneId: null,
    scene,
    enabled: true,
    name: '',
    roleScopeMode: 'all',
    characterIds: [],
    config: createEmptyApiConfig(seed),
    defaultVoiceId: '',
    defaultVoiceSampleAssetId: '',
    defaultVoiceSampleName: '',
    supportsVoiceClone: false,
    voiceLibraryRecords: [],
  };
}

function syncApiCenterWithActiveConfig(settings: AppSettings): AppSettings {
  const activeConfig = settings.configs.find((config) => config.id === settings.activeConfigId)
    || settings.configs[0]
    || null;
  const apiCenterConfig = ensureApiCenterConfig(settings);

  if (activeConfig) {
    apiCenterConfig.defaultTextCall = {
      enabled: true,
      config: convertLegacyApiConfigToProviderConfig(activeConfig),
    };
  }

  return {
    ...settings,
    apiCenterConfig,
  };
}

function sceneLabel(scene: SceneKind): string {
  switch (scene) {
    case 'single-chat':
      return '单聊调用';
    case 'group-chat':
      return '群聊调用';
    case 'forum':
      return '论坛调用';
    case 'dating':
      return '约会调用';
    case 'tts':
      return '语音合成 TTS';
    default:
      return scene;
  }
}

function sceneDescription(scene: SceneKind): string {
  switch (scene) {
    case 'single-chat':
      return '只覆盖角色一对一聊天，支持按角色范围命中。';
    case 'group-chat':
      return '只覆盖群聊相关生成，未命中时回退总调用。';
    case 'forum':
      return '只覆盖论坛和公开内容生成，未命中时回退总调用。';
    case 'dating':
      return '只覆盖约会场景生成，未命中时回退总调用。';
    case 'tts':
      return '只覆盖语音合成，不会作为总调用使用。';
    default:
      return '';
  }
}

function getTestButtonLabel(editor: EditorState, isTesting: boolean): string {
  if (isTesting) {
    return '测试中...';
  }

  if (editor.kind === 'scene') {
    if (editor.scene === 'tts') {
      return '测试试听';
    }
  }

  return '测试连接';
}

function sceneIcon(scene: SceneKind) {
  return scene === 'tts' ? Volume2 : Cpu;
}

function isMultiRuleScene(scene: SceneKind): boolean {
  return scene === 'single-chat';
}

function findConflictingSceneCard(
  cards: SceneCard[],
  scene: SceneKind,
  editingId: string | null,
): SceneCard | null {
  if (isMultiRuleScene(scene)) {
    return null;
  }

  return cards.find((card) => card.scene === scene && card.id !== editingId) || null;
}

function sortSceneCards(cards: SceneCard[]): SceneCard[] {
  const order: Record<SceneKind, number> = {
    'single-chat': 0,
    'group-chat': 1,
    forum: 2,
    dating: 3,
    tts: 4,
  };

  return [...cards].sort((left, right) => {
    const sceneDelta = order[left.scene] - order[right.scene];
    if (sceneDelta !== 0) return sceneDelta;
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function buildSceneCards(settings: AppSettings): SceneCard[] {
  const apiCenterConfig = ensureApiCenterConfig(settings);
  const cards: SceneCard[] = [];

  apiCenterConfig.singleChatCalls.forEach((rule) => {
    cards.push({
      id: rule.id,
      scene: 'single-chat',
      name: rule.name || sceneLabel('single-chat'),
      enabled: rule.enabled,
      config: convertProviderConfigToLegacyApiConfig(rule.config, {
        id: rule.id,
        name: rule.name || sceneLabel('single-chat'),
      }),
      roleScopeMode: rule.roleScope.mode,
      characterIds: rule.roleScope.characterIds || [],
    });
  });

  if (apiCenterConfig.groupChatCall?.enabled) {
    cards.push({
      id: 'group-chat',
      scene: 'group-chat',
      name: sceneLabel('group-chat'),
      enabled: true,
      config: convertProviderConfigToLegacyApiConfig(apiCenterConfig.groupChatCall.config, {
        id: 'group-chat',
        name: sceneLabel('group-chat'),
      }),
    });
  }

  if (apiCenterConfig.forumCall?.enabled) {
    cards.push({
      id: 'forum',
      scene: 'forum',
      name: sceneLabel('forum'),
      enabled: true,
      config: convertProviderConfigToLegacyApiConfig(apiCenterConfig.forumCall.config, {
        id: 'forum',
        name: sceneLabel('forum'),
      }),
    });
  }

  if (apiCenterConfig.datingCall?.enabled) {
    cards.push({
      id: 'dating',
      scene: 'dating',
      name: sceneLabel('dating'),
      enabled: true,
      config: convertProviderConfigToLegacyApiConfig(apiCenterConfig.datingCall.config, {
        id: 'dating',
        name: sceneLabel('dating'),
      }),
    });
  }

  if (apiCenterConfig.voiceCall?.tts?.enabled) {
    cards.push({
      id: 'tts',
      scene: 'tts',
      name: sceneLabel('tts'),
      enabled: true,
      config: convertProviderConfigToLegacyApiConfig(apiCenterConfig.voiceCall.tts.config, {
        id: 'tts',
        name: sceneLabel('tts'),
      }),
      defaultVoiceId: apiCenterConfig.voiceCall.tts.defaultVoiceId || '',
      defaultVoiceSampleAssetId: apiCenterConfig.voiceCall.tts.defaultSampleAssetId || '',
      defaultVoiceSampleName: apiCenterConfig.voiceCall.tts.defaultSampleName || '',
      supportsVoiceClone: !!apiCenterConfig.voiceCall.tts.supportsVoiceClone,
      voiceLibraryRecords: apiCenterConfig.voiceCall.tts.voiceLibraryRecords || [],
    });
  }

  return sortSceneCards(cards);
}

function buildSingleChatSummary(card: SceneCard, characters: Character[]): string {
  const mode = card.roleScopeMode || 'all';
  if (mode === 'all') {
    return '适用于所有角色';
  }

  const names = (card.characterIds || [])
    .map((id) => characters.find((character) => character.id === id)?.name || id)
    .filter(Boolean);

  if (mode === 'include') {
    return names.length > 0 ? `指定角色：${names.join('、')}` : '指定角色';
  }

  return names.length > 0 ? `排除角色：${names.join('、')}` : '排除角色';
}

function buildDefaultCardSummary(config: ApiConfig): string {
  return `${normalizeProviderLabel(config.provider, config.baseUrl)} · ${config.model || '未设置模型'}`;
}

export function SettingsApp({
  onBack,
  settings,
  setSettings,
  defaultConfig,
  characters,
}: SettingsAppProps) {
  const voiceSampleInputRef = useRef<HTMLInputElement | null>(null);
  const { setUploadedFile } = usePersistentFieldActions();
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editor, setEditor] = useState<EditorState>({
    kind: 'default',
    editingConfigId: null,
    form: createEmptyApiConfig(defaultConfig),
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCloningDefaultVoice, setIsCloningDefaultVoice] = useState(false);
  const [ttsPreviewAudioUrl, setTtsPreviewAudioUrl] = useState('');

  const currentConfigForm = editor.kind === 'default' ? editor.form : editor.config;
  const isMinimaxConfig = looksLikeMinimaxConfig(currentConfigForm);
  const currentVoiceSampleAssetRef = editor.kind === 'scene' && editor.scene === 'tts'
    ? editor.defaultVoiceSampleAssetId
    : '';
  const { resolvedUrl: resolvedDefaultVoiceSampleUrl } = useResolvedPersistentValue(currentVoiceSampleAssetRef);
  const defaultVoiceSampleUrl = getDisplayableAssetValue(currentVoiceSampleAssetRef, resolvedDefaultVoiceSampleUrl);
  const sceneCards = useMemo(() => buildSceneCards(settings), [settings]);
  const conflictingSceneCard = useMemo(
    () => editor.kind === 'scene'
      ? findConflictingSceneCard(sceneCards, editor.scene, editor.editingSceneId)
      : null,
    [editor, sceneCards],
  );
  const filteredAvailableModels = useMemo(
    () => filterAvailableModels(availableModels, currentConfigForm.model),
    [availableModels, currentConfigForm.model],
  );

  const updateSettings = (nextSettings: AppSettings) => {
    setSettings(nextSettings);
  };

  const handleAddDefaultConfig = () => {
    setEditor({
      kind: 'default',
      editingConfigId: null,
      form: createEmptyApiConfig(defaultConfig),
    });
    setAvailableModels([]);
    setView('edit');
  };

  const handleAddSceneConfig = () => {
    setEditor(createSceneEditorState('group-chat', defaultConfig));
    setAvailableModels([]);
    setView('edit');
  };

  const handleEditDefaultConfig = (config: ApiConfig, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditor({
      kind: 'default',
      editingConfigId: config.id,
      form: normalizeConfigForEdit(config),
    });
    setAvailableModels([]);
    setView('edit');
  };

  const handleEditSceneConfig = (card: SceneCard, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditor({
      kind: 'scene',
      editingSceneId: card.id,
      scene: card.scene,
      enabled: card.enabled,
      name: card.name,
      roleScopeMode: card.roleScopeMode || 'all',
      characterIds: card.characterIds || [],
      config: normalizeConfigForEdit(card.config),
      defaultVoiceId: card.defaultVoiceId || '',
      defaultVoiceSampleAssetId: card.defaultVoiceSampleAssetId || '',
      defaultVoiceSampleName: card.defaultVoiceSampleName || '',
      supportsVoiceClone: !!card.supportsVoiceClone,
      voiceLibraryRecords: card.voiceLibraryRecords || [],
    });
    setAvailableModels([]);
    setView('edit');
  };

  const handleActivateDefaultConfig = (configId: string) => {
    updateSettings(syncApiCenterWithActiveConfig({
      ...settings,
      activeConfigId: configId,
    }));
  };

  const handleDeleteDefaultConfig = async () => {
    if (editor.kind !== 'default' || !editor.editingConfigId) return;
    if (settings.configs.length <= 1) {
      alert('至少保留一个总调用配置。');
      return;
    }
    if (!(await showInAppConfirm('确定要删除这个总调用配置吗？'))) {
      return;
    }

    const nextConfigs = settings.configs.filter((config) => config.id !== editor.editingConfigId);
    const nextActiveConfigId = settings.activeConfigId === editor.editingConfigId
      ? nextConfigs[0].id
      : settings.activeConfigId;

    updateSettings(syncApiCenterWithActiveConfig({
      ...settings,
      configs: nextConfigs,
      activeConfigId: nextActiveConfigId,
    }));
    setView('list');
  };

  const handleDeleteSceneConfig = async () => {
    if (editor.kind !== 'scene' || !editor.editingSceneId) return;
    if (!(await showInAppConfirm('确定要删除这个分调用配置吗？'))) {
      return;
    }

    if (conflictingSceneCard) {
      alert(`${sceneLabel(editor.scene)} 已经存在一个分调用配置，请先编辑现有配置或删除后再新建。`);
      return;
    }

    const apiCenterConfig = ensureApiCenterConfig(settings);

    if (editor.scene === 'single-chat') {
      apiCenterConfig.singleChatCalls = apiCenterConfig.singleChatCalls.filter((item) => item.id !== editor.editingSceneId);
    } else if (editor.scene === 'group-chat') {
      apiCenterConfig.groupChatCall = {
        ...(apiCenterConfig.groupChatCall || { config: convertLegacyApiConfigToProviderConfig(defaultConfig) }),
        enabled: false,
      };
    } else if (editor.scene === 'forum') {
      apiCenterConfig.forumCall = {
        ...(apiCenterConfig.forumCall || { config: convertLegacyApiConfigToProviderConfig(defaultConfig) }),
        enabled: false,
      };
    } else if (editor.scene === 'dating') {
      apiCenterConfig.datingCall = {
        ...(apiCenterConfig.datingCall || { config: convertLegacyApiConfigToProviderConfig(defaultConfig) }),
        enabled: false,
      };
    } else if (editor.scene === 'tts') {
      apiCenterConfig.voiceCall = {
        ...apiCenterConfig.voiceCall,
        enabled: false,
        tts: {
          ...(apiCenterConfig.voiceCall?.tts || { config: convertLegacyApiConfigToProviderConfig(defaultConfig) }),
          enabled: false,
          defaultVoiceId: '',
          defaultSampleAssetId: '',
          defaultSampleName: '',
          supportsVoiceClone: false,
        },
      };
    }

    updateSettings({
      ...settings,
      apiCenterConfig,
    });
    setView('list');
  };

  const handleSave = () => {
    if (!currentConfigForm.name.trim() && editor.kind === 'default') {
      alert('请先填写配置名称。');
      return;
    }

    if (!currentConfigForm.model.trim()) {
      alert('请先填写模型名称。');
      return;
    }

    if (editor.kind === 'default') {
      const normalizedForm = normalizeConfigForEdit(editor.form);
      const nextSettings = editor.editingConfigId
        ? {
          ...settings,
          configs: settings.configs.map((config) => (
            config.id === editor.editingConfigId ? normalizedForm : config
          )),
        }
        : {
          ...settings,
          configs: [...settings.configs, normalizedForm],
          activeConfigId: normalizedForm.id,
        };

      updateSettings(syncApiCenterWithActiveConfig(nextSettings));
      setView('list');
      return;
    }

    if (editor.scene === 'single-chat' && editor.roleScopeMode !== 'all' && editor.characterIds.length === 0) {
      alert('单聊分调用请选择至少一个角色。');
      return;
    }

    const apiCenterConfig = ensureApiCenterConfig(settings);
    const providerConfig = convertLegacyApiConfigToProviderConfig(normalizeConfigForEdit(editor.config));

    if (editor.scene === 'single-chat') {
      const existingRule = apiCenterConfig.singleChatCalls.find((item) => item.id === editor.editingSceneId);
      const nextRule: SingleChatCallConfig = {
        id: editor.editingSceneId || editor.config.id,
        enabled: editor.enabled,
        name: editor.name.trim() || sceneLabel(editor.scene),
        roleScope: {
          mode: editor.roleScopeMode,
          characterIds: editor.characterIds,
        },
        config: providerConfig,
        priority: existingRule?.priority ?? apiCenterConfig.singleChatCalls.length,
      };

      apiCenterConfig.singleChatCalls = existingRule
        ? apiCenterConfig.singleChatCalls.map((item) => (item.id === nextRule.id ? nextRule : item))
        : [...apiCenterConfig.singleChatCalls, nextRule];
    } else if (editor.scene === 'group-chat') {
      apiCenterConfig.groupChatCall = {
        enabled: editor.enabled,
        config: providerConfig,
      };
    } else if (editor.scene === 'forum') {
      apiCenterConfig.forumCall = {
        enabled: editor.enabled,
        config: providerConfig,
      };
    } else if (editor.scene === 'dating') {
      apiCenterConfig.datingCall = {
        enabled: editor.enabled,
        config: providerConfig,
      };
    } else if (editor.scene === 'tts') {
      apiCenterConfig.voiceCall = {
        ...apiCenterConfig.voiceCall,
        enabled: true,
        tts: {
          enabled: editor.enabled,
          config: providerConfig,
          defaultVoiceId: editor.defaultVoiceId.trim(),
          defaultSampleAssetId: editor.defaultVoiceSampleAssetId.trim(),
          defaultSampleName: editor.defaultVoiceSampleName.trim(),
          supportsVoiceClone: editor.supportsVoiceClone,
          voiceLibraryRecords: editor.voiceLibraryRecords,
        },
      };
    }

    updateSettings({
      ...settings,
      apiCenterConfig,
    });
    setView('list');
  };

  const handleFetchModels = async () => {
    if (isFetchingModels) return;
    setIsFetchingModels(true);
    setAvailableModels([]);
    try {
      const result = await fetchAvailableModels(currentConfigForm);
      if (result.normalizedBaseUrl) {
        updateCurrentConfig({ baseUrl: result.normalizedBaseUrl });
      }
      setAvailableModels(result.models);
      alert(`成功拉取 ${result.models.length} 个模型。`);
    } catch (error: any) {
      console.error('Fetch models error:', error);
      alert(`拉取失败：${error.message}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleUploadDefaultVoiceSample = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (editor.kind !== 'scene' || editor.scene !== 'tts') {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('audio/')) {
      alert('请上传音频文件，例如 mp3、wav、m4a。');
      event.currentTarget.value = '';
      return;
    }

    try {
      const assetRef = await setUploadedFile(file);
      setEditor({
        ...editor,
        defaultVoiceSampleAssetId: assetRef,
        defaultVoiceSampleName: file.name,
      });
      setTtsPreviewAudioUrl('');
    } finally {
      event.currentTarget.value = '';
    }
  };

  const handleGenerateDefaultVoice = async () => {
    if (editor.kind !== 'scene' || editor.scene !== 'tts') {
      return;
    }

    if (!editor.defaultVoiceSampleAssetId) {
      await showInAppAlert('请先上传默认语音样本。');
      return;
    }

    setIsCloningDefaultVoice(true);
    try {
      const voiceIdSeed = editor.defaultVoiceId.trim()
        || editor.defaultVoiceSampleName.replace(/\.[^.]+$/, '').trim()
        || 'BloomDefaultVoice';
      const result = await cloneTtsVoice({
        config: currentConfigForm,
        sampleAssetRef: editor.defaultVoiceSampleAssetId,
        voiceId: voiceIdSeed,
        promptText: '你好，这是 Bloom 的默认语音。',
      });

      setEditor({
        ...editor,
        defaultVoiceId: result.voiceId,
        supportsVoiceClone: true,
        voiceLibraryRecords: [
          {
            voiceId: result.voiceId,
            voiceName: editor.defaultVoiceSampleName.replace(/\.[^.]+$/, '').trim() || '默认克隆音色',
            source: 'voice_cloning',
            previewAudioUrl: result.demoAudioUrl,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          ...editor.voiceLibraryRecords.filter((item) => item.voiceId !== result.voiceId),
        ],
      });
      setTtsPreviewAudioUrl(result.demoAudioUrl || '');

      if (result.demoAudioUrl) {
        void new Audio(result.demoAudioUrl).play().catch((error) => {
          console.warn('Unable to autoplay cloned default voice demo.', error);
        });
      }

      await showInAppAlert(`默认声音已生成并回填 voiceId：${result.voiceId}`);
    } catch (error: any) {
      await showInAppAlert(`生成默认声音失败：${error?.message || 'unknown error'}`);
    } finally {
      setIsCloningDefaultVoice(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      let result: { normalizedBaseUrl?: string; message?: string; audioUrl?: string };

      if (editor.kind === 'scene' && editor.scene === 'tts') {
        result = await testTtsVoice(currentConfigForm, {
          voiceId: editor.defaultVoiceId,
        });
      } else {
        result = await testApiConnection(currentConfigForm);
      }

      if (result.normalizedBaseUrl) {
        updateCurrentConfig({ baseUrl: result.normalizedBaseUrl });
      }
      if (result.audioUrl) {
        setTtsPreviewAudioUrl(result.audioUrl);
        void new Audio(result.audioUrl).play().catch((error) => {
          console.warn('Unable to autoplay TTS preview audio.', error);
        });
      }
      alert(result.message || '连接成功。');
    } catch (error: any) {
      alert(`测试连接失败：${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const updateCurrentConfig = (patch: Partial<ApiConfig>) => {
    if (editor.kind === 'default') {
      setEditor({
        ...editor,
        form: { ...editor.form, ...patch },
      });
      return;
    }

    setEditor({
      ...editor,
      config: { ...editor.config, ...patch },
    });
  };

  const syncApiKeyFromField = (value: string) => {
    updateCurrentConfig({ apiKey: value });
  };

  return (
    <motion.div className="absolute inset-0 flex flex-col bg-[#f7f7f9]">
      {view === 'list' ? (
        <>
          <div className="z-10 flex min-h-[64px] items-center justify-between bg-[#f7f7f9] px-4 pb-3 pt-12">
            <button onClick={onBack} className="-ml-1 flex items-center p-1 text-black active:opacity-70">
              <ChevronLeft size={26} />
            </button>
            <span className="text-[16px] font-semibold text-black">API 中心</span>
            <div className="w-[26px]" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-20">
            <div className="mb-8">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-[18px] font-bold text-zinc-900">总调用</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                    这里是默认兜底配置。你可以新建多个总调用配置，并选择当前启用哪一个。
                  </p>
                </div>
                <button onClick={handleAddDefaultConfig} className="rounded-full bg-white p-2 text-zinc-900 shadow-sm active:opacity-70">
                  <Plus size={18} />
                </button>
              </div>

              <div className="space-y-3">
                {settings.configs.map((config) => (
                  <div
                    key={config.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleActivateDefaultConfig(config.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleActivateDefaultConfig(config.id);
                      }
                    }}
                    className={`w-full rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                      settings.activeConfigId === config.id
                        ? 'border-zinc-900 shadow-md'
                        : 'border-transparent shadow-sm'
                    }`}
                  >
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                        <Cpu size={26} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-[16px] font-bold text-zinc-900">
                            {config.name || '未命名配置'}
                          </div>
                          {settings.activeConfigId === config.id ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">
                              <Check size={12} />
                              当前启用
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[12px] text-zinc-500">
                          {buildDefaultCardSummary(config)}
                        </p>
                        <p className="mt-1 truncate text-[12px] text-zinc-400">
                          {config.baseUrl || 'https://generativelanguage.googleapis.com'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-end justify-between border-t border-zinc-50 pt-3">
                      <p className="text-[12px] text-zinc-400">
                        温度：{typeof config.temperature === 'number' ? config.temperature.toFixed(1) : '0.7'}
                      </p>
                      <button
                        type="button"
                        onClick={(event) => handleEditDefaultConfig(config, event)}
                        className="shrink-0 p-1 text-zinc-300 active:text-zinc-500"
                      >
                        <Pencil size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-[18px] font-bold text-zinc-900">分调用</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                    这里的新建配置必须绑定具体场景，不能作为总调用使用。未命中的场景会回退到上面的总调用。
                  </p>
                </div>
                <button onClick={handleAddSceneConfig} className="rounded-full bg-white p-2 text-zinc-900 shadow-sm active:opacity-70">
                  <Plus size={18} />
                </button>
              </div>

              <div className="space-y-3">
                {sceneCards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-[13px] text-zinc-400">
                    还没有分调用配置，点击右上角 + 新建。
                  </div>
                ) : sceneCards.map((card) => {
                  const Icon = sceneIcon(card.scene);
                  return (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-transparent bg-white p-4 shadow-sm"
                    >
                      <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                          <Icon size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-[16px] font-bold text-zinc-900">
                              {card.name || sceneLabel(card.scene)}
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              card.enabled ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                            }`}>
                              {card.enabled ? '启用中' : '已关闭'}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-zinc-500">
                            {sceneLabel(card.scene)}
                            {card.scene === 'single-chat' ? ` · ${buildSingleChatSummary(card, characters)}` : ''}
                          </p>
                          <p className="mt-1 truncate text-[12px] text-zinc-400">
                            {card.config.baseUrl || 'https://generativelanguage.googleapis.com'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-end justify-between border-t border-zinc-50 pt-3">
                        <div className="space-y-1">
                          <p className="text-[12px] text-zinc-400">
                            模型：{card.config.model || '未设置'}
                          </p>
                          {card.scene === 'tts' && card.defaultVoiceId ? (
                            <p className="text-[12px] text-zinc-400">
                              默认声音：{card.defaultVoiceId}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => handleEditSceneConfig(card, event)}
                          className="shrink-0 p-1 text-zinc-300 active:text-zinc-500"
                        >
                          <Pencil size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="z-10 flex min-h-[64px] items-center justify-between bg-white px-4 pb-3 pt-12">
            <button onClick={() => setView('list')} className="-ml-1 flex items-center p-1 text-black active:opacity-70">
              <ChevronLeft size={26} />
            </button>
            <span className="text-[16px] font-semibold text-black">
              {editor.kind === 'default'
                ? (editor.editingConfigId ? '编辑总调用' : '新增总调用')
                : (editor.editingSceneId ? '编辑分调用' : '新增分调用')}
            </span>
            <div className="flex items-center gap-2">
              {editor.kind === 'default' ? (
                editor.editingConfigId ? (
                  <button onClick={handleDeleteDefaultConfig} className="p-1.5 text-red-500 active:opacity-70">
                    <Trash2 size={20} />
                  </button>
                ) : null
              ) : editor.editingSceneId ? (
                <button onClick={handleDeleteSceneConfig} className="p-1.5 text-red-500 active:opacity-70">
                  <Trash2 size={20} />
                </button>
              ) : null}
              <button
                onClick={handleSave}
                className="rounded-full bg-zinc-100 p-1.5 text-zinc-900 active:opacity-70"
              >
                <Save size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto bg-white p-4 pb-20">
            <div className="rounded-3xl border border-zinc-100 bg-zinc-50/80 p-4">
              <div className="text-[16px] font-bold text-zinc-900">
                {editor.kind === 'default' ? '总调用配置' : '分调用配置'}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                {editor.kind === 'default'
                  ? '这里创建的是默认兜底配置，不绑定具体场景。'
                  : sceneDescription(editor.scene)}
              </p>
            </div>

            {editor.kind === 'scene' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[13px] text-zinc-500">调用场景</label>
                  <AppSelect
                    value={editor.scene}
                    onChange={(scene) => setEditor({ ...editor, scene: scene as SceneKind })}
                    options={[
                      { value: 'single-chat', label: sceneLabel('single-chat') },
                      { value: 'group-chat', label: sceneLabel('group-chat') },
                      { value: 'forum', label: sceneLabel('forum') },
                      { value: 'dating', label: sceneLabel('dating') },
                      { value: 'tts', label: sceneLabel('tts') },
                    ]}
                    placeholder="选择场景"
                  />
                  {conflictingSceneCard ? (
                    <p className="text-[12px] leading-5 text-amber-600">
                      当前场景已经有一个分调用配置：{conflictingSceneCard.name || sceneLabel(conflictingSceneCard.scene)}。
                      这类场景一次只保留一条分调用，请直接编辑现有配置。
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] text-zinc-500">启用状态</label>
                  <AppSelect
                    value={editor.enabled ? 'enabled' : 'disabled'}
                    onChange={(value) => setEditor({ ...editor, enabled: value === 'enabled' })}
                    options={[
                      { value: 'enabled', label: '启用' },
                      { value: 'disabled', label: '关闭' },
                    ]}
                    placeholder="选择状态"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] text-zinc-500">配置名称</label>
                  <input
                    type="text"
                    value={editor.name}
                    onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                    placeholder={`例如：${sceneLabel(editor.scene)}`}
                    className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                  />
                </div>

                {editor.scene === 'single-chat' ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[13px] text-zinc-500">角色范围</label>
                      <AppSelect
                        value={editor.roleScopeMode}
                        onChange={(value) => setEditor({ ...editor, roleScopeMode: value as RoleScopeMode })}
                        options={[
                          { value: 'all', label: '适用于所有角色' },
                          { value: 'include', label: '指定角色' },
                          { value: 'exclude', label: '排除角色' },
                        ]}
                        placeholder="选择角色范围"
                      />
                    </div>

                    {editor.roleScopeMode !== 'all' ? (
                      <div className="space-y-2">
                        <label className="text-[13px] text-zinc-500">选择角色</label>
                        <div className="grid grid-cols-2 gap-2">
                          {characters.map((character) => {
                            const selected = editor.characterIds.includes(character.id);
                            return (
                              <button
                                key={character.id}
                                type="button"
                                onClick={() => {
                                  const nextCharacterIds = selected
                                    ? editor.characterIds.filter((id) => id !== character.id)
                                    : [...editor.characterIds, character.id];
                                  setEditor({ ...editor, characterIds: nextCharacterIds });
                                }}
                                className={`rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${
                                  selected
                                    ? 'border-zinc-900 bg-zinc-900 text-white'
                                    : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                                }`}
                              >
                                {character.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {editor.scene === 'tts' ? (
                  <>
                    <input
                      ref={voiceSampleInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(event) => void handleUploadDefaultVoiceSample(event)}
                      className="hidden"
                    />
                    <div className="space-y-1.5">
                      <label className="text-[13px] text-zinc-500">默认声音 ID</label>
                      <input
                        type="text"
                        value={editor.defaultVoiceId}
                        onChange={(event) => setEditor({ ...editor, defaultVoiceId: event.target.value })}
                        placeholder="例如：voice_001"
                        className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-zinc-900">默认语音样本</div>
                          <div className="mt-1 text-[12px] leading-5 text-zinc-500">
                            可以先上传一段默认语音样本，帮助用户理解“默认声音”是什么。后续可据此生成默认 voiceId。
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => voiceSampleInputRef.current?.click()}
                          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-900 active:opacity-70"
                        >
                          {editor.defaultVoiceSampleAssetId ? '更换样本' : '上传样本'}
                        </button>
                      </div>

                      {editor.defaultVoiceSampleAssetId ? (
                        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                          <div className="text-[12px] text-zinc-600">
                            当前样本：{editor.defaultVoiceSampleName || '未命名默认语音样本'}
                          </div>
                          {defaultVoiceSampleUrl ? (
                            <audio controls src={defaultVoiceSampleUrl} className="w-full" />
                          ) : null}
                          {editor.defaultVoiceId ? (
                            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-[11px] text-zinc-500">当前默认 voiceId</div>
                                <div className="truncate text-[13px] font-medium text-zinc-900">{editor.defaultVoiceId}</div>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await copyTextContent(editor.defaultVoiceId);
                                  await showInAppAlert(result.ok ? '默认 voiceId 已复制。' : '复制失败，请手动复制。');
                                }}
                                className="shrink-0 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-700 active:opacity-70"
                                title="复制 voiceId"
                              >
                                <Copy size={16} />
                              </button>
                            </div>
                          ) : null}
                          {ttsPreviewAudioUrl ? (
                            <div className="space-y-1">
                              <div className="text-[11px] text-zinc-500">最新试听</div>
                              <audio controls src={ttsPreviewAudioUrl} className="w-full" />
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleGenerateDefaultVoice()}
                              disabled={isCloningDefaultVoice}
                              className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-900 active:opacity-70 disabled:opacity-50"
                            >
                              {isCloningDefaultVoice ? '生成中...' : '生成默认声音'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditor({
                                ...editor,
                                defaultVoiceSampleAssetId: '',
                                defaultVoiceSampleName: '',
                              })}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 active:opacity-70"
                            >
                              删除样本
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[13px] text-zinc-500">支持声音克隆</label>
                      <AppSelect
                        value={editor.supportsVoiceClone ? 'yes' : 'no'}
                        onChange={(value) => setEditor({ ...editor, supportsVoiceClone: value === 'yes' })}
                        options={[
                          { value: 'yes', label: '支持' },
                          { value: 'no', label: '不支持' },
                        ]}
                        placeholder="选择是否支持"
                      />
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500">配置名称</label>
                <input
                  type="text"
                  value={editor.form.name}
                  onChange={(event) => updateCurrentConfig({ name: event.target.value })}
                  placeholder="例如：我的主接口"
                  className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">提供商 (Provider)</label>
              <AppSelect
                value={currentConfigForm.provider || 'Google Gemini'}
                onChange={(provider) => updateCurrentConfig({ provider })}
                options={PROVIDER_OPTIONS}
                placeholder="选择提供商"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">Base URL 基础网址</label>
              <div className="relative flex items-center">
                <Link2 size={18} className="absolute left-3 text-zinc-400" />
                <input
                  type="text"
                  value={currentConfigForm.baseUrl}
                  onChange={(event) => updateCurrentConfig({ baseUrl: event.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-xl border border-zinc-100 bg-zinc-50 py-3 pl-10 pr-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">API Key</label>
              <div className="relative flex items-center">
                <Key size={18} className="absolute left-3 text-zinc-400" />
                <input
                  type="password"
                  value={currentConfigForm.apiKey}
                  onChange={(event) => updateCurrentConfig({ apiKey: event.target.value })}
                  onInput={(event) => syncApiKeyFromField((event.target as HTMLInputElement).value)}
                  onBlur={(event) => syncApiKeyFromField(event.target.value)}
                  autoComplete="off"
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-zinc-100 bg-zinc-50 py-3 pl-10 pr-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[13px] text-zinc-500">模型名称 (Model)</label>
                {!isMinimaxConfig ? (
                  <button
                    onClick={handleFetchModels}
                    disabled={isFetchingModels}
                    className="flex items-center gap-1 text-[13px] text-blue-500 active:opacity-70 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isFetchingModels ? 'animate-spin' : ''} />
                    {isFetchingModels ? '拉取中...' : '拉取模型'}
                  </button>
                ) : null}
              </div>
              <div className="relative">
                {availableModels.length > 0 ? (
                  <AppSelect
                    value={currentConfigForm.model}
                    onChange={(model) => updateCurrentConfig({ model })}
                    options={(filteredAvailableModels.length > 0 ? filteredAvailableModels : availableModels).map((model) => ({
                      value: model,
                      label: model,
                    }))}
                    placeholder="请选择模型"
                    emptyText="暂无可选模型"
                  />
                ) : (
                  <input
                    type="text"
                    value={currentConfigForm.model}
                    onChange={(event) => updateCurrentConfig({ model: event.target.value })}
                    placeholder="例如：gpt-4o"
                    className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                  />
                )}
                {availableModels.length > 0 ? (
                  <div className="mt-1 flex items-center justify-between px-1">
                    <span className="text-[11px] text-zinc-400">
                      已拉取 {availableModels.length} 个模型
                    </span>
                    <button
                      onClick={() => updateCurrentConfig({ model: '' })}
                      className="text-[11px] text-zinc-900 active:opacity-70"
                    >
                      清空查看全部
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[13px] text-zinc-500">温度参数 (Temperature)</label>
                <span className="text-[14px] font-medium text-zinc-900">
                  {(currentConfigForm.temperature ?? 0.7).toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={currentConfigForm.temperature ?? 0.7}
                onChange={(event) => updateCurrentConfig({ temperature: parseFloat(event.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900"
              />
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>精确 (0.0)</span>
                <span>创造性 (2.0)</span>
              </div>
            </div>

            {editor.kind === 'scene' && editor.scene === 'tts' ? (
              <TtsVoiceManagementPanel
                config={editor.config}
                defaultVoiceId={editor.defaultVoiceId}
                defaultVoiceSampleAssetId={editor.defaultVoiceSampleAssetId}
                defaultVoiceSampleName={editor.defaultVoiceSampleName}
                characters={characters}
                savedVoiceRecords={editor.voiceLibraryRecords}
                onConfigChange={(patch) => setEditor({
                  ...editor,
                  config: {
                    ...editor.config,
                    ...patch,
                  },
                })}
                onDefaultVoiceIdChange={(voiceId) => setEditor({
                  ...editor,
                  defaultVoiceId: voiceId,
                })}
                onSavedVoiceRecordsChange={(records) => setEditor({
                  ...editor,
                  voiceLibraryRecords: records,
                })}
              />
            ) : null}

            <div className="pb-8 pt-4">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3.5 text-[15px] font-medium text-zinc-600 transition-colors active:bg-zinc-100 disabled:opacity-50"
              >
                {getTestButtonLabel(editor, isTesting)}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
