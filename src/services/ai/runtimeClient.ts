import { GoogleGenAI } from '@google/genai';
import type { ApiConfig } from '../../types';

export function isGeminiConfig(activeConfig: ApiConfig) {
  return activeConfig.provider === 'Google Gemini' || (!activeConfig.baseUrl && activeConfig.provider === '自定义 (Custom)');
}

export function getConfigApiKey(activeConfig: ApiConfig) {
  return activeConfig.apiKey || process.env.GEMINI_API_KEY || '';
}

export async function generateTextWithConfig(options: {
  activeConfig: ApiConfig;
  prompt: string;
  temperature?: number;
}) {
  const { activeConfig, prompt, temperature } = options;
  const apiKey = getConfigApiKey(activeConfig);

  if (!apiKey) {
    throw new Error('未检测到 API Key，请先在 API 中心完成配置。');
  }

  if (isGeminiConfig(activeConfig)) {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: activeConfig.model || 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: activeConfig.temperature ?? temperature ?? 1.0,
      },
    });

    return (response.text || '').trim();
  }

  if (!activeConfig.baseUrl) {
    throw new Error('当前 API 中心配置缺少 Base URL。');
  }

  const baseUrl = activeConfig.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: activeConfig.model,
      messages: [{ role: 'system', content: prompt }],
      temperature: activeConfig.temperature ?? temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API 错误 (${res.status})`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}
