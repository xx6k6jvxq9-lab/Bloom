import {
  convertLegacyApiConfigToProviderConfig,
  ensureApiCenterConfig,
  resolveLegacyActiveApiConfig,
} from './defaults';
import { matchSingleChatRule } from './matchSingleChatRule';
import type { ResolveTextCallConfigParams, ResolvedTextCallConfig } from './types';

function resolveDefaultTextFallback(
  params: ResolveTextCallConfigParams,
  apiCenterConfig: ReturnType<typeof ensureApiCenterConfig>,
): ResolvedTextCallConfig {
  const legacyActiveConfig = resolveLegacyActiveApiConfig(params.settings);
  if (legacyActiveConfig) {
    return {
      source: 'legacy-active',
      config: convertLegacyApiConfigToProviderConfig(legacyActiveConfig),
      legacyConfig: legacyActiveConfig,
    };
  }

  return {
    source: 'default',
    config: apiCenterConfig.defaultTextCall.enabled
      ? apiCenterConfig.defaultTextCall.config
      : null,
  };
}

export function resolveTextCallConfig(
  params: ResolveTextCallConfigParams,
): ResolvedTextCallConfig {
  const apiCenterConfig = ensureApiCenterConfig(params.settings);

  if (params.scene === 'single-chat') {
    const matchedRule = matchSingleChatRule(apiCenterConfig.singleChatCalls, params.characterId);
    if (matchedRule) {
      return {
        source: 'single-chat-rule',
        ruleId: matchedRule.id,
        config: matchedRule.config,
      };
    }
  }

  if (params.scene === 'group-chat' && apiCenterConfig.groupChatCall?.enabled) {
    return {
      source: 'group-chat',
      config: apiCenterConfig.groupChatCall.config,
    };
  }

  if (params.scene === 'forum' && apiCenterConfig.forumCall?.enabled) {
    return {
      source: 'forum',
      config: apiCenterConfig.forumCall.config,
    };
  }

  if (params.scene === 'dating' && apiCenterConfig.datingCall?.enabled) {
    return {
      source: 'dating',
      config: apiCenterConfig.datingCall.config,
    };
  }

  return resolveDefaultTextFallback(params, apiCenterConfig);
}
