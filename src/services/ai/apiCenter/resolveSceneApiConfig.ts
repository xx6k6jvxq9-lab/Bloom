import type { ApiConfig } from '../../../types';
import { convertProviderConfigToLegacyApiConfig } from './defaults';
import { resolveTextCallConfig } from './resolveTextCallConfig';
import { resolveVoiceCallConfig } from './resolveVoiceCallConfig';
import type {
  ResolveTextCallConfigParams,
  ResolveVoiceCallConfigParams,
  ResolvedTextCallConfig,
  ResolvedVoiceCallConfig,
} from './types';

export function resolveSceneTextApiConfig(
  params: ResolveTextCallConfigParams,
): ResolvedTextCallConfig & { runtimeConfig: ApiConfig | null } {
  const resolved = resolveTextCallConfig(params);
  return {
    ...resolved,
    runtimeConfig: resolved.config
      ? convertProviderConfigToLegacyApiConfig(resolved.config, {
        id: `api-center-${params.scene}`,
        name: `API Center ${params.scene}`,
      })
      : null,
  };
}

export function resolveSceneVoiceApiConfig(
  params: ResolveVoiceCallConfigParams,
): ResolvedVoiceCallConfig & { runtimeConfig: ApiConfig | null } {
  const resolved = resolveVoiceCallConfig(params);
  return {
    ...resolved,
    runtimeConfig: resolved.config
      ? convertProviderConfigToLegacyApiConfig(resolved.config, {
        id: `api-center-${params.mode}`,
        name: `API Center ${params.mode}`,
      })
      : null,
  };
}
