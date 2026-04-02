import { GoogleGenAI } from '@google/genai';
import type { ApiConfig } from '../../types';

export type RuntimeChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'model';
  content: string;
};

function sanitizeModelOutput(text: string) {
  if (!text) return '';

  let cleaned = text.trim();

  // Strip hidden reasoning blocks if a provider leaks them.
  cleaned = cleaned.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '').trim();

  // If the model starts a think block but never closes it, drop that tail entirely.
  cleaned = cleaned.replace(/<think\b[^>]*>[\s\S]*$/gi, '').trim();

  return cleaned;
}

function extractTextFromSsePayload(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('data: '))
    .map(line => line.slice(6).trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  const chunks: string[] = [];

  for (const line of lines) {
    if (line === '[DONE]') {
      continue;
    }

    try {
      const data = JSON.parse(line);
      const messageContent = data.choices?.[0]?.message?.content;
      const deltaContent = data.choices?.[0]?.delta?.content;
      const textContent = typeof data.text === 'string' ? data.text : '';
      const content = messageContent || deltaContent || textContent;
      if (content) {
        chunks.push(content);
      }
    } catch {
      return '';
    }
  }

  return chunks.join('');
}

export function isGeminiConfig(activeConfig: ApiConfig) {
  return activeConfig.provider === 'Google Gemini' || !activeConfig.baseUrl?.trim();
}

export function getConfigApiKey(activeConfig: ApiConfig) {
  return activeConfig.apiKey?.trim() || '';
}

function getConfigModel(activeConfig: ApiConfig) {
  return activeConfig.model?.trim() || 'gemini-3-flash-preview';
}

function ensureValidConfig(activeConfig: ApiConfig) {
  const apiKey = getConfigApiKey(activeConfig);

  if (!apiKey) {
    throw new Error('Missing API Key in active API Center config.');
  }

  if (!isGeminiConfig(activeConfig) && !activeConfig.baseUrl?.trim()) {
    throw new Error('Missing Base URL in active API Center config.');
  }

  return {
    apiKey,
    model: getConfigModel(activeConfig),
    baseUrl: activeConfig.baseUrl?.trim()?.replace(/\/$/, '') || '',
  };
}

export async function generateTextWithConfig(options: {
  activeConfig: ApiConfig;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}) {
  const { activeConfig, prompt, temperature, maxOutputTokens } = options;
  const { apiKey, model, baseUrl } = ensureValidConfig(activeConfig);

  if (isGeminiConfig(activeConfig)) {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: activeConfig.temperature ?? temperature ?? 1.0,
        maxOutputTokens,
      },
    });

    return sanitizeModelOutput(response.text || '');
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: prompt }],
      temperature: activeConfig.temperature ?? temperature ?? 0.7,
      max_tokens: maxOutputTokens,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error (${res.status})`);
  }

  const rawResponse = await res.text();

  try {
    const data = JSON.parse(rawResponse);
    return sanitizeModelOutput(data.choices?.[0]?.message?.content || '');
  } catch (error) {
    const fallbackText = extractTextFromSsePayload(rawResponse);
    if (fallbackText) {
      console.warn('[runtimeClient] Received SSE payload on non-stream request, falling back to SSE parser.', error);
      return sanitizeModelOutput(fallbackText);
    }

    throw new Error(`Unable to parse model response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function streamTextWithConfig(options: {
  activeConfig: ApiConfig;
  messages: RuntimeChatMessage[];
  temperature?: number;
  onTextChunk: (chunkText: string) => void;
}) {
  const { activeConfig, messages, temperature, onTextChunk } = options;
  const { apiKey, model, baseUrl } = ensureValidConfig(activeConfig);

  if (isGeminiConfig(activeConfig)) {
    const ai = new GoogleGenAI({ apiKey });
    const contents = messages.map(message => ({
      role: message.role === 'assistant' ? 'model' : message.role,
      parts: [{ text: message.content }],
    }));

    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        temperature: activeConfig.temperature ?? temperature ?? 1.0,
      },
    });

    for await (const chunk of stream) {
      const chunkText = chunk.text;
      if (chunkText) {
        onTextChunk(chunkText);
      }
    }

    return;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(message => ({
        role: message.role === 'model' ? 'assistant' : message.role,
        content: message.content,
      })),
      temperature: activeConfig.temperature ?? temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Unable to read streaming response.');
  }

  const decoder = new TextDecoder();
  let pendingChunk = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      pendingChunk += decoder.decode();
    } else {
      pendingChunk += decoder.decode(value, { stream: true });
    }

    const events = pendingChunk.split(/\r?\n\r?\n/);
    pendingChunk = events.pop() || '';

    for (const eventBlock of events) {
      const lines = eventBlock.split(/\r?\n/).filter(line => line.trim() !== '');
      const dataLines = lines
        .filter(line => line.startsWith('data: '))
        .map(line => line.slice(6));

      if (dataLines.length === 0) continue;

      const dataStr = dataLines.join('\n');
      if (dataStr === '[DONE]') continue;

      try {
        const data = JSON.parse(dataStr);
        const content = data.choices?.[0]?.delta?.content || '';
        if (content) {
          onTextChunk(content);
        }
      } catch (error) {
        console.error('Error parsing SSE chunk', error);
      }
    }

    if (done) {
      break;
    }
  }

  const finalData = pendingChunk.trim();
  if (!finalData) {
    return;
  }

  const finalLines = finalData.split(/\r?\n/).filter(line => line.trim() !== '');
  const finalDataLines = finalLines
    .filter(line => line.startsWith('data: '))
    .map(line => line.slice(6));

  if (finalDataLines.length === 0) {
    return;
  }

  const finalDataStr = finalDataLines.join('\n');
  if (finalDataStr === '[DONE]') {
    return;
  }

  try {
    const data = JSON.parse(finalDataStr);
    const content = data.choices?.[0]?.delta?.content || '';
    if (content) {
      onTextChunk(content);
    }
  } catch (error) {
    console.error('Error parsing final SSE chunk', error);
  }
}
