import { GoogleGenAI, createPartFromBase64, createPartFromText, createPartFromUri } from '@google/genai';
import type { ApiConfig } from '../../types';
import { resolveValueToModelInput } from '../../features/persistence/persistentAssetService';

export type RuntimeChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'model';
  content: string;
  imageUrl?: string;
  audioUrl?: string;
  audioMimeType?: string;
};

function parseDataUrl(value: string): { mimeType: string; data: string } | null {
  const match = value.match(/^data:([^;,]+)(?:;[^,]+)?,(.+)$/i);
  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function inferMimeTypeFromImageUrl(value: string): string {
  const lowerValue = value.toLowerCase();
  if (lowerValue.includes('.png')) return 'image/png';
  if (lowerValue.includes('.webp')) return 'image/webp';
  if (lowerValue.includes('.gif')) return 'image/gif';
  if (lowerValue.includes('.jpg') || lowerValue.includes('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

async function resolveRuntimeMessagesForModel(messages: RuntimeChatMessage[]): Promise<RuntimeChatMessage[]> {
  return Promise.all(messages.map(async (message) => {
    const [resolvedImageUrl, resolvedAudioUrl] = await Promise.all([
      message.imageUrl
        ? resolveValueToModelInput(message.imageUrl, { assetType: 'image' }).catch((error) => {
            console.warn('[runtimeClient] Failed to resolve image input for model, falling back to text-only content.', {
              role: message.role,
              contentPreview: message.content.slice(0, 120),
              error,
            });
            return null;
          })
        : Promise.resolve(null),
      message.audioUrl ? resolveValueToModelInput(message.audioUrl, { assetType: 'audio' }) : Promise.resolve(null),
    ]);

    return {
      ...message,
      imageUrl: resolvedImageUrl || undefined,
      audioUrl: resolvedAudioUrl || undefined,
    };
  }));
}

function buildGeminiMessageParts(message: RuntimeChatMessage) {
  const parts = [createPartFromText(message.content)];
  if (message.imageUrl) {
    const dataUrl = parseDataUrl(message.imageUrl);
    if (dataUrl) {
      parts.push(createPartFromBase64(dataUrl.data, dataUrl.mimeType));
    } else {
      parts.push(createPartFromUri(message.imageUrl, inferMimeTypeFromImageUrl(message.imageUrl)));
    }
  }

  if (message.audioUrl) {
    const dataUrl = parseDataUrl(message.audioUrl);
    if (dataUrl) {
      parts.push(createPartFromBase64(dataUrl.data, message.audioMimeType || dataUrl.mimeType));
    } else {
      parts.push(createPartFromUri(message.audioUrl, message.audioMimeType || 'audio/wav'));
    }
  }

  return parts;
}

function buildOpenAiCompatibleMessageContent(message: RuntimeChatMessage) {
  if ((!message.imageUrl && !message.audioUrl) || message.role !== 'user') {
    return message.content;
  }

  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: message.content },
  ];

  if (message.imageUrl) {
    content.push({ type: 'image_url', image_url: { url: message.imageUrl } });
  }

  if (message.audioUrl) {
    const dataUrl = parseDataUrl(message.audioUrl);
    if (!dataUrl) {
      throw new Error('Audio input for OpenAI-compatible chat requires a data URL.');
    }

    const format = (message.audioMimeType || dataUrl.mimeType || 'audio/wav')
      .replace(/^audio\//i, '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    content.push({
      type: 'input_audio',
      input_audio: {
        data: dataUrl.data,
        format,
      },
    });
  }

  return content;
}

function normalizeErrorDetail(detail: string, maxLength = 160) {
  const normalized = detail.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function extractErrorDetail(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const error = Reflect.get(data, 'error');
  if (error && typeof error === 'object') {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string') {
      return message;
    }
  }

  const message = Reflect.get(data, 'message');
  if (typeof message === 'string') {
    return message;
  }

  const detail = Reflect.get(data, 'detail');
  if (typeof detail === 'string') {
    return detail;
  }

  return '';
}

async function throwApiErrorResponse(res: Response): Promise<never> {
  const rawText = await res.text().catch(() => '');
  let detail = '';

  if (rawText.trim()) {
    try {
      detail = extractErrorDetail(JSON.parse(rawText));
    } catch {
      detail = rawText;
    }
  }

  const normalizedDetail = normalizeErrorDetail(detail);
  throw new Error(normalizedDetail ? `${res.status}: ${normalizedDetail}` : `${res.status}: API request failed`);
}

function sanitizeModelOutput(text: string) {
  if (!text) return '';

  let cleaned = text.trim();

  // Strip hidden reasoning blocks if a provider leaks them.
  cleaned = cleaned.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '').trim();

  // If the model starts a think block but never closes it, drop that tail entirely.
  cleaned = cleaned.replace(/<think\b[^>]*>[\s\S]*$/gi, '').trim();

  // Strip common agent/tool leakage from upstream orchestration layers.
  cleaned = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^call:[^\s]+/i.test(line)) return false;
      if (/^\[system\].*recovered by/i.test(line)) return false;
      if (/^recovered by\b/i.test(line)) return false;
      if (/^antigravity here\.?$/i.test(line)) return false;
      if (/^upstream model interrupted after thinking\.?$/i.test(line)) return false;
      return true;
    })
    .join('\n')
    .trim();

  return cleaned;
}

function buildRawResponsePreview(rawResponse: string, maxLength = 240) {
  const normalized = rawResponse.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function buildTimeoutError(timeoutMs: number) {
  return new Error(`Request timed out after ${Math.ceil(timeoutMs / 1000)}s.`);
}

async function runWithTimeout<T>(
  run: (signal?: AbortSignal) => Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return run();
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(buildTimeoutError(timeoutMs));
      }, timeoutMs);

      run(controller?.signal)
        .then(resolve)
        .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') {
            reject(buildTimeoutError(timeoutMs));
            return;
          }
          reject(error);
        });
    });
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function extractTextFromContentValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (!item || typeof item !== 'object') {
          return '';
        }

        const text = Reflect.get(item, 'text');
        if (typeof text === 'string') {
          return text;
        }

        const nestedContent = Reflect.get(item, 'content');
        if (typeof nestedContent === 'string') {
          return nestedContent;
        }

        return '';
      })
      .filter(Boolean)
      .join('');
  }

  return '';
}

function extractTextFromOutputItems(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }

      const directText = extractTextFromContentValue(Reflect.get(item, 'text'));
      if (directText) {
        return directText;
      }

      const contentText = extractTextFromContentValue(Reflect.get(item, 'content'));
      if (contentText) {
        return contentText;
      }

      const nestedOutputText = extractTextFromOutputItems(Reflect.get(item, 'output'));
      if (nestedOutputText) {
        return nestedOutputText;
      }

      return '';
    })
    .filter(Boolean)
    .join('');
}

function extractTextFromPayload(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const eventType = Reflect.get(data, 'type');
  if (typeof eventType === 'string') {
    const eventDelta = extractTextFromContentValue(Reflect.get(data, 'delta'));
    if (eventDelta) {
      return eventDelta;
    }

    const eventText = extractTextFromContentValue(Reflect.get(data, 'text'));
    if (eventText) {
      return eventText;
    }

    const eventOutputText = extractTextFromContentValue(Reflect.get(data, 'output_text'));
    if (eventOutputText) {
      return eventOutputText;
    }

    const eventResponse = Reflect.get(data, 'response');
    const nestedResponseText = extractTextFromPayload(eventResponse);
    if (nestedResponseText) {
      return nestedResponseText;
    }
  }

  const choices = Reflect.get(data, 'choices');
  if (Array.isArray(choices)) {
    const chunks = choices
      .map((choice) => {
        if (!choice || typeof choice !== 'object') {
          return '';
        }

        const message = Reflect.get(choice, 'message');
        if (message && typeof message === 'object') {
          const messageContent = extractTextFromContentValue(Reflect.get(message, 'content'));
          if (messageContent) {
            return messageContent;
          }
        }

        const delta = Reflect.get(choice, 'delta');
        if (delta && typeof delta === 'object') {
          const deltaContent = extractTextFromContentValue(Reflect.get(delta, 'content'));
          if (deltaContent) {
            return deltaContent;
          }
        }

        return extractTextFromContentValue(Reflect.get(choice, 'text'));
      })
      .filter(Boolean);

    if (chunks.length > 0) {
      return chunks.join('');
    }
  }

  const directText = extractTextFromContentValue(Reflect.get(data, 'text'));
  if (directText) {
    return directText;
  }

  const outputText = extractTextFromContentValue(Reflect.get(data, 'output_text'));
  if (outputText) {
    return outputText;
  }

  const outputArrayText = extractTextFromOutputItems(Reflect.get(data, 'output'));
  if (outputArrayText) {
    return outputArrayText;
  }

  const nestedResponseText = extractTextFromPayload(Reflect.get(data, 'response'));
  if (nestedResponseText) {
    return nestedResponseText;
  }

  return '';
}

function extractTextFromSsePayload(raw: string) {
  const dataLineMatches = Array.from(raw.matchAll(/(^|\n)\s*data:\s*(.+)$/gim))
    .map((match) => match[2]?.trim() || '')
    .filter(Boolean);

  const eventBlocks = raw
    .split(/\r?\n\r?\n/)
    .map(block => block.trim())
    .filter(Boolean);
  const directSegments = raw
    .split(/(?=data:\s*)/i)
    .map(segment => segment.trim())
    .filter(segment => /^data:\s*/i.test(segment));

  if (eventBlocks.length === 0 && directSegments.length === 0 && dataLineMatches.length === 0) {
    return '';
  }

  const chunks: string[] = [];
  const candidateBlocks =
    eventBlocks.length > 0
      ? eventBlocks
      : directSegments.length > 0
        ? directSegments
        : dataLineMatches.map(line => `data: ${line}`);

  for (const block of candidateBlocks) {
    const dataLines = block
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => /^data:\s*/i.test(line))
      .map(line => line.replace(/^data:\s*/i, ''));

    if (dataLines.length === 0) {
      continue;
    }

    const payload = dataLines.join('\n').trim();
    if (!payload || payload === '[DONE]') {
      continue;
    }

    try {
      const data = JSON.parse(payload);
      const content = extractTextFromPayload(data);
      if (content) {
        chunks.push(content);
      }
    } catch {
      // Some providers send SSE-like responses without blank-line event separators.
      // Fall back to parsing individual data lines to salvage text chunks.
      for (const line of dataLines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === '[DONE]') {
          continue;
        }

        try {
          const data = JSON.parse(trimmedLine);
          const content = extractTextFromPayload(data);
          if (content) {
            chunks.push(content);
          }
        } catch {
          continue;
        }
      }

      // Last-chance recovery for providers that concatenate SSE objects into one segment.
      const nestedSegments = block
        .split(/(?=data:\s*)/i)
        .map(segment => segment.trim())
        .filter(segment => /^data:\s*/i.test(segment))
        .map(segment => segment.replace(/^data:\s*/i, '').trim());

      for (const segment of nestedSegments) {
        if (!segment || segment === '[DONE]') {
          continue;
        }

        try {
          const data = JSON.parse(segment);
          const content = extractTextFromPayload(data);
          if (content) {
            chunks.push(content);
          }
        } catch {
          continue;
        }
      }
    }
  }

  return chunks.join('');
}

function parseTextResponse(rawResponse: string) {
  const trimmedResponse = rawResponse.trim();
  const preview = buildRawResponsePreview(trimmedResponse);

  try {
    const data = JSON.parse(trimmedResponse);
    const upstreamErrorDetail = normalizeErrorDetail(extractErrorDetail(data));
    const extractedText = sanitizeModelOutput(extractTextFromPayload(data));
    if (extractedText) {
      return extractedText;
    }

    if (upstreamErrorDetail) {
      throw new Error(
        preview
          ? `Upstream API error: ${upstreamErrorDetail}. Raw preview: ${preview}`
          : `Upstream API error: ${upstreamErrorDetail}`,
      );
    }

    const preview = buildRawResponsePreview(trimmedResponse);
    throw new Error(
      preview
        ? `Model response contained no extractable text. Raw preview: ${preview}`
        : 'Model response contained no extractable text.',
    );
  } catch (error) {
    const fallbackText = extractTextFromSsePayload(trimmedResponse);
    if (fallbackText) {
      console.warn('[runtimeClient] Received SSE payload on non-stream request, falling back to SSE parser.', error);
      return sanitizeModelOutput(fallbackText);
    }

    if (/^\s*data:\s*/i.test(trimmedResponse)) {
      const normalizedResponse = trimmedResponse
        .split(/\r?\n/)
        .map(line => line.replace(/^\s*data:\s*/i, '').trim())
        .filter(line => line && line !== '[DONE]')
        .join('\n');

      if (normalizedResponse) {
        try {
          const data = JSON.parse(normalizedResponse);
          const extractedText = sanitizeModelOutput(extractTextFromPayload(data));
          if (extractedText) {
            return extractedText;
          }
          throw new Error(
            preview
              ? `SSE response contained no extractable text. Raw preview: ${preview}`
              : 'SSE response contained no extractable text.',
          );
        } catch {
          // Let the original parse error surface below.
        }
      }

      throw new Error(
        preview
          ? `Received SSE-style response that could not be parsed. Raw preview: ${preview}`
          : 'Received SSE-style response that could not be parsed.',
      );
    }

    throw new Error(
      preview
        ? `Unable to parse model response: ${error instanceof Error ? error.message : 'Unknown error'}. Raw preview: ${preview}`
        : `Unable to parse model response: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
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
  timeoutMs?: number;
}) {
  const { activeConfig, prompt, temperature, maxOutputTokens, timeoutMs } = options;
  const { apiKey, model, baseUrl } = ensureValidConfig(activeConfig);

  if (isGeminiConfig(activeConfig)) {
    const ai = new GoogleGenAI({ apiKey });
    const response = await runWithTimeout(() => ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: activeConfig.temperature ?? temperature ?? 1.0,
        maxOutputTokens,
      },
    }), timeoutMs);

    return sanitizeModelOutput(response.text || '');
  }

  return runWithTimeout(async (signal) => {
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
      signal,
    });

    if (!res.ok) {
      await throwApiErrorResponse(res);
    }

    const rawResponse = await res.text();
    return parseTextResponse(rawResponse);
  }, timeoutMs);
}

export async function generateTextFromMessagesWithConfig(options: {
  activeConfig: ApiConfig;
  messages: RuntimeChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}) {
  const { activeConfig, messages, temperature, maxOutputTokens, timeoutMs } = options;
  const { apiKey, model, baseUrl } = ensureValidConfig(activeConfig);
  const resolvedMessages = await resolveRuntimeMessagesForModel(messages);

  if (isGeminiConfig(activeConfig)) {
    const ai = new GoogleGenAI({ apiKey });
    const response = await runWithTimeout(() => ai.models.generateContent({
      model,
      contents: resolvedMessages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : message.role,
        parts: buildGeminiMessageParts(message),
      })),
      config: {
        temperature: activeConfig.temperature ?? temperature ?? 1.0,
        maxOutputTokens,
      },
    }), timeoutMs);

    return sanitizeModelOutput(response.text || '');
  }

  return runWithTimeout(async (signal) => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: resolvedMessages.map((message) => ({
          role: message.role === 'model' ? 'assistant' : message.role,
          content: buildOpenAiCompatibleMessageContent(message),
        })),
        temperature: activeConfig.temperature ?? temperature ?? 0.7,
        max_tokens: maxOutputTokens,
        stream: false,
      }),
      signal,
    });

    if (!res.ok) {
      await throwApiErrorResponse(res);
    }

    const rawResponse = await res.text();
    return parseTextResponse(rawResponse);
  }, timeoutMs);
}

export async function streamTextWithConfig(options: {
  activeConfig: ApiConfig;
  messages: RuntimeChatMessage[];
  temperature?: number;
  onTextChunk: (chunkText: string) => void;
}) {
  const { activeConfig, messages, temperature, onTextChunk } = options;
  const { apiKey, model, baseUrl } = ensureValidConfig(activeConfig);
  const resolvedMessages = await resolveRuntimeMessagesForModel(messages);

  if (isGeminiConfig(activeConfig)) {
    const ai = new GoogleGenAI({ apiKey });
    const contents = resolvedMessages.map(message => ({
      role: message.role === 'assistant' ? 'model' : message.role,
      parts: buildGeminiMessageParts(message),
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
      messages: resolvedMessages.map(message => ({
        role: message.role === 'model' ? 'assistant' : message.role,
        content: buildOpenAiCompatibleMessageContent(message),
      })),
      temperature: activeConfig.temperature ?? temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    await throwApiErrorResponse(res);
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
        .filter(line => /^data:\s*/i.test(line))
        .map(line => line.replace(/^data:\s*/i, ''));

      if (dataLines.length === 0) continue;

      const dataStr = dataLines.join('\n');
      if (dataStr === '[DONE]') continue;

      try {
        const data = JSON.parse(dataStr);
        const content = extractTextFromPayload(data);
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
    .filter(line => /^data:\s*/i.test(line))
    .map(line => line.replace(/^data:\s*/i, ''));

  if (finalDataLines.length === 0) {
    return;
  }

  const finalDataStr = finalDataLines.join('\n');
  if (finalDataStr === '[DONE]') {
    return;
  }

  try {
    const data = JSON.parse(finalDataStr);
    const content = extractTextFromPayload(data);
    if (content) {
      onTextChunk(content);
    }
  } catch (error) {
    console.error('Error parsing final SSE chunk', error);
  }
}
