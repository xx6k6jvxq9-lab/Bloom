import type {
  AiProviderConfig,
  ApiCenterConfig,
  ApiConfig,
  ApiCenterProvider,
  AppSettings,
  TextCallConfig,
} from '../../../types';

function normalizeLegacyProvider(provider: string | undefined, baseUrl: string | undefined): ApiCenterProvider {
  const normalizedProvider = provider?.trim().toLowerCase() || '';
  const normalizedBaseUrl = baseUrl?.trim() || '';

  if (normalizedProvider.includes('gemini') || !normalizedBaseUrl) {
    return 'gemini';
  }

  if (normalizedProvider.includes('openai')) {
    return 'openai-compatible';
  }

  return 'custom';
}

export function createDefaultAiProviderConfig(): AiProviderConfig {
  return {
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    model: 'gemini-3-flash-preview',
    temperature: 1.0,
  };
}

export function createDefaultTextCallConfig(): TextCallConfig {
  return {
    enabled: true,
    config: createDefaultAiProviderConfig(),
  };
}

export function createDefaultApiCenterConfig(): ApiCenterConfig {
  return {
    defaultTextCall: createDefaultTextCallConfig(),
    singleChatCalls: [],
    groupChatCall: {
      enabled: false,
      config: createDefaultAiProviderConfig(),
    },
    forumCall: {
      enabled: false,
      config: createDefaultAiProviderConfig(),
    },
    datingCall: {
      enabled: false,
      config: createDefaultAiProviderConfig(),
    },
    voiceCall: {
      enabled: false,
      tts: {
        enabled: false,
        config: createDefaultAiProviderConfig(),
        defaultVoiceId: '',
        defaultSampleAssetId: '',
        defaultSampleName: '',
        supportsVoiceClone: false,
      },
    },
  };
}

export function convertLegacyApiConfigToProviderConfig(config: ApiConfig | null | undefined): AiProviderConfig {
  if (!config) {
    return createDefaultAiProviderConfig();
  }

  return {
    provider: normalizeLegacyProvider(config.provider, config.baseUrl),
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl || '',
    model: config.model || 'gemini-3-flash-preview',
    temperature: typeof config.temperature === 'number' ? config.temperature : 1.0,
  };
}

export function convertProviderConfigToLegacyApiConfig(
  config: AiProviderConfig,
  options?: { id?: string; name?: string },
): ApiConfig {
  const providerLabelMap: Record<ApiCenterProvider, string> = {
    gemini: 'Google Gemini',
    'openai-compatible': 'OpenAI Compatible',
    custom: 'Custom',
  };

  return {
    id: options?.id || 'api-center-resolved',
    name: options?.name || 'API Center Resolved',
    provider: providerLabelMap[config.provider] || 'Custom',
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl || '',
    model: config.model || 'gemini-3-flash-preview',
    temperature: typeof config.temperature === 'number' ? config.temperature : 1.0,
  };
}

export function resolveLegacyActiveApiConfig(
  settings: Pick<AppSettings, 'activeConfigId' | 'configs'>,
): ApiConfig | null {
  const configs = Array.isArray(settings.configs) ? settings.configs : [];
  if (configs.length === 0) {
    return null;
  }

  return configs.find((config) => config.id === settings.activeConfigId) || configs[0] || null;
}

export function createApiCenterConfigFromLegacySettings(
  settings: Pick<AppSettings, 'activeConfigId' | 'configs'>,
): ApiCenterConfig {
  const legacyActiveConfig = resolveLegacyActiveApiConfig(settings);
  const nextConfig = createDefaultApiCenterConfig();

  nextConfig.defaultTextCall = {
    enabled: true,
    config: convertLegacyApiConfigToProviderConfig(legacyActiveConfig),
  };

  return nextConfig;
}

function isEffectivelyEmptyApiCenterConfig(
  settings: Pick<AppSettings, 'activeConfigId' | 'configs' | 'apiCenterConfig'>,
): boolean {
  const apiCenterConfig = settings.apiCenterConfig;
  if (!apiCenterConfig) {
    return true;
  }

  const hasSingleChatRules = Array.isArray(apiCenterConfig.singleChatCalls) && apiCenterConfig.singleChatCalls.length > 0;
  const hasEnabledSceneOverride = Boolean(
    apiCenterConfig.groupChatCall?.enabled
    || apiCenterConfig.forumCall?.enabled
    || apiCenterConfig.datingCall?.enabled
    || apiCenterConfig.voiceCall?.enabled
    || apiCenterConfig.voiceCall?.tts?.enabled,
  );
  const defaultCall = apiCenterConfig.defaultTextCall;
  const hasDefaultCallCredential = Boolean(
    defaultCall?.config?.apiKey?.trim()
    || defaultCall?.config?.baseUrl?.trim(),
  );

  return !hasSingleChatRules && !hasEnabledSceneOverride && !hasDefaultCallCredential;
}

export function ensureApiCenterConfig(
  settings: Pick<AppSettings, 'activeConfigId' | 'configs' | 'apiCenterConfig'>,
): ApiCenterConfig {
  const legacyActiveConfig = resolveLegacyActiveApiConfig(settings);

  if (!settings.apiCenterConfig || (
    isEffectivelyEmptyApiCenterConfig(settings)
    && Boolean(legacyActiveConfig?.apiKey?.trim())
  )) {
    return createApiCenterConfigFromLegacySettings(settings);
  }

  const defaults = createDefaultApiCenterConfig();

  return {
    ...defaults,
    ...settings.apiCenterConfig,
    defaultTextCall: {
      ...defaults.defaultTextCall,
      ...settings.apiCenterConfig.defaultTextCall,
      config: {
        ...defaults.defaultTextCall.config,
        ...settings.apiCenterConfig.defaultTextCall?.config,
      },
    },
    singleChatCalls: Array.isArray(settings.apiCenterConfig.singleChatCalls)
      ? settings.apiCenterConfig.singleChatCalls.map((rule, index) => ({
        ...rule,
        priority: typeof rule.priority === 'number' ? rule.priority : index,
        roleScope: {
          mode: rule.roleScope?.mode || 'all',
          characterIds: Array.isArray(rule.roleScope?.characterIds)
            ? rule.roleScope.characterIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            : [],
        },
        config: {
          ...defaults.defaultTextCall.config,
          ...rule.config,
        },
      }))
      : [],
    groupChatCall: {
      ...defaults.groupChatCall,
      ...settings.apiCenterConfig.groupChatCall,
      config: {
        ...defaults.groupChatCall!.config,
        ...settings.apiCenterConfig.groupChatCall?.config,
      },
    },
    forumCall: {
      ...defaults.forumCall,
      ...settings.apiCenterConfig.forumCall,
      config: {
        ...defaults.forumCall!.config,
        ...settings.apiCenterConfig.forumCall?.config,
      },
    },
    datingCall: {
      ...defaults.datingCall,
      ...settings.apiCenterConfig.datingCall,
      config: {
        ...defaults.datingCall!.config,
        ...settings.apiCenterConfig.datingCall?.config,
      },
    },
    voiceCall: {
      ...defaults.voiceCall,
      ...settings.apiCenterConfig.voiceCall,
      tts: {
        ...defaults.voiceCall!.tts,
        ...settings.apiCenterConfig.voiceCall?.tts,
        config: {
          ...defaults.voiceCall!.tts!.config,
          ...settings.apiCenterConfig.voiceCall?.tts?.config,
        },
      },
    },
  };
}
