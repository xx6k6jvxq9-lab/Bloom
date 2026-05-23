import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiConfig } from '../../types';
import {
  canUseVisionInputs,
  generateTextFromMessagesWithConfig,
  isVisionCapabilityError,
  streamTextWithConfig,
} from './runtimeClient';

function createConfig(model: string): ApiConfig {
  return {
    id: 'test-config',
    name: 'Test Config',
    provider: 'OpenAI Compatible',
    apiKey: 'test-key',
    baseUrl: 'https://example.com/v1',
    model,
    temperature: 0.7,
  };
}

function buildStreamingResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
    },
  });
}

function parseRequestBody(init: RequestInit | undefined) {
  const rawBody = typeof init?.body === 'string' ? init.body : '';
  return rawBody ? JSON.parse(rawBody) : null;
}

test('canUseVisionInputs is conservative for generic OpenAI-compatible text models', () => {
  assert.equal(canUseVisionInputs(createConfig('deepseek-chat')), false);
  assert.equal(canUseVisionInputs(createConfig('gpt-4o')), true);
});

test('isVisionCapabilityError recognizes upstream non-VLM failures', () => {
  assert.equal(
    isVisionCapabilityError('400: The model is not a VLM (Vision Language Model). Please use text-only prompts.'),
    true,
  );
});

test('generateTextFromMessagesWithConfig retries without image inputs when the upstream rejects vision payloads', async (t) => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, any>> = [];

  globalThis.fetch = (async (_input, init) => {
    const body = parseRequestBody(init);
    if (body) {
      requestBodies.push(body);
    }

    if (requestBodies.length === 1) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'The model is not a VLM (Vision Language Model). Please use text-only prompts.',
          },
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '我先按文字接住这个表情。',
            },
          },
        ],
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const text = await generateTextFromMessagesWithConfig({
    activeConfig: createConfig('gpt-4o'),
    messages: [
      {
        role: 'user',
        content: '[sent a sticker; hint: sad]',
        imageUrl: 'data:image/png;base64,AAAA',
      },
    ],
  });

  assert.equal(text, '我先按文字接住这个表情。');
  assert.equal(requestBodies.length, 2);
  assert.equal(Array.isArray(requestBodies[0]?.messages?.[0]?.content), true);
  assert.equal(requestBodies[1]?.messages?.[0]?.content, '[sent a sticker; hint: sad]');
});

test('streamTextWithConfig retries without image inputs when the upstream rejects vision payloads', async (t) => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, any>> = [];

  globalThis.fetch = (async (_input, init) => {
    const body = parseRequestBody(init);
    if (body) {
      requestBodies.push(body);
    }

    if (requestBodies.length === 1) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'The model is not a VLM (Vision Language Model). Please use text-only prompts.',
          },
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json',
          },
        },
      );
    }

    return buildStreamingResponse([
      'data: {"choices":[{"delta":{"content":"没事，"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"我先按文字接。"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const chunks: string[] = [];
  await streamTextWithConfig({
    activeConfig: createConfig('gpt-4o'),
    messages: [
      {
        role: 'user',
        content: '[sent a sticker; hint: sad]',
        imageUrl: 'data:image/png;base64,AAAA',
      },
    ],
    onTextChunk: (chunkText) => {
      chunks.push(chunkText);
    },
  });

  assert.equal(chunks.join(''), '没事，我先按文字接。');
  assert.equal(requestBodies.length, 2);
  assert.equal(Array.isArray(requestBodies[0]?.messages?.[0]?.content), true);
  assert.equal(requestBodies[1]?.messages?.[0]?.content, '[sent a sticker; hint: sad]');
});
