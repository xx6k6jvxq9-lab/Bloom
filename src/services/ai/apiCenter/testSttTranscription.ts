import type { ApiConfig } from '../../../types';
import { testApiConnection } from './testApiConnection';

export async function testSttTranscription(
  config: ApiConfig,
): Promise<{ ok: true; message: string; normalizedBaseUrl?: string }> {
  const result = await testApiConnection(config);

  return {
    ok: true,
    message: 'STT 服务基础连接正常。完整转写测试将在语音接入阶段补齐。',
    normalizedBaseUrl: result.normalizedBaseUrl,
  };
}
