import { ensureApiCenterConfig } from './defaults';
import { matchSingleChatRule } from './matchSingleChatRule';
import type { ResolveTextCallConfigParams, ResolvedTextCallConfig } from './types';

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

  return {
    source: 'default',
    config: apiCenterConfig.defaultTextCall.enabled
      ? apiCenterConfig.defaultTextCall.config
      : null,
  };
}
