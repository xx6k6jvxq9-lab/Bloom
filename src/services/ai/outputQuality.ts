import type { ApiConfig } from '../../types';
import { STRUCTURED_ASSISTANT_REPLY_TOKEN } from './assistantReplyEnvelope';
import { streamTextWithConfig, type RuntimeChatMessage } from './runtimeClient';

export type OutputQualityReason =
  | 'empty'
  | 'punctuation_only'
  | 'punctuation_heavy'
  | 'repetition_noise'
  | 'analysis_leak'
  | 'system_leak'
  | 'generic_assistant_tone'
  | 'too_short_after_cleaning';

export type OutputQualityResult = {
  ok: boolean;
  cleanedText: string;
  reason?: OutputQualityReason;
};

export function getOutputQualityReasonLabel(reason?: OutputQualityReason): string {
  switch (reason) {
    case 'empty':
      return '清洗后没有留下可显示正文，常见原因是只输出了空白、括号动作或协议壳。';
    case 'punctuation_only':
      return '返回内容几乎只有标点或空白，没有可显示正文。';
    case 'punctuation_heavy':
      return '返回内容符号太多、正文太少，像半截坏掉的回复。';
    case 'repetition_noise':
      return '返回内容里有明显重复字符或重复符号噪音。';
    case 'analysis_leak':
      return '回复混入了分析过程或解释腔，不像角色真正会发出去的话。';
    case 'system_leak':
      return '回复混入了 system、prompt 或 AI 身份提示，不能直接显示。';
    case 'generic_assistant_tone':
      return '回复滑成了通用安抚/陪聊模板，不像当前角色本人。';
    case 'too_short_after_cleaning':
      return '清洗后剩下的内容太短，不足以作为一条有效回复。';
    default:
      return '模型返回了不可直接显示的内容。';
  }
}

export function formatKnownGenerationFailureMessage(message: string): string | null {
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const invalidOutputMatch = normalized.match(/^(?:模型返回无效内容|语音通话模型返回无效内容)[:：](.+)$/);
  if (invalidOutputMatch?.[1]) {
    return `回复失败（正文清洗）：${getOutputQualityReasonLabel(invalidOutputMatch[1].trim() as OutputQualityReason)}`;
  }

  if (normalized === '模型未按双语协议返回可显示的中文翻译。') {
    return '回复失败（双语协议）：这次双语返回里正文或翻译没有对齐，当前无法安全显示。';
  }

  if (normalized === '模型返回为空') {
    return '回复失败（上游空结果）：模型这次没有返回可显示正文。';
  }

  if (/Model response contained no extractable text/i.test(normalized)) {
    return '回复失败（上游空结果）：上游接口返回了响应，但里面没有可提取的正文。';
  }

  if (/Unable to parse model response/i.test(normalized)) {
    return '回复失败（上游解析异常）：上游接口返回格式异常，当前这轮没法解析成正文。';
  }

  return null;
}

export type AssistantOutputQualityOptions = {
  allowBracketActions?: boolean;
  allowStructuredProtocols?: boolean;
  toneGuardMode?: 'off' | 'character_chat';
};

export type GenerateQualityCheckedAssistantReplyParams = {
  activeConfig: ApiConfig;
  messages: RuntimeChatMessage[];
  allowBracketActions?: boolean;
  allowStructuredProtocols?: boolean;
  toneGuardMode?: 'off' | 'character_chat';
  softRecoveryMode?: 'off' | 'character_chat';
  temperature?: number;
  retryTemperature?: number;
  onInvalid?: (result: OutputQualityResult) => void;
  onProgress?: (text: string, meta: { attempt: 1 | 2 | 3 }) => void;
  traceLabel?: string;
};

const ANALYSIS_LEAK_PATTERN =
  /\b(?:based on these points|reacting to|reflecting(?: and adjusting)?|adjusting my response|i['\u2019]?m (?:crafting|developing|focusing|meticulously)|my goal is|given the shutdown|strategy|acknowledging her decision)\b/i;

const SYSTEM_LEAK_PATTERN =
  /\b(?:system prompt|developer message|as an ai|language model|task requires|output only|rules?:|instruction(?:s)?|prompt says)\b/i;

const BRACKET_BLOCK_REGEX = /[\(\uFF08]([^\(\)\uFF08\uFF09\n]{0,160})[\)\uFF09]/gu;
const PUNCTUATION_CHARS_REGEX = /[\s,\uFF0C.\u3002!\uFF01?\uFF1F\u3001;\uFF1B:"\u201C\u201D'\u2018\u2019`~\u2026\-\u2014()[\]{}<>\u300A\u300B\u3010\u3011\uFF08\uFF09]/gu;
const EFFECTIVE_CHAR_REGEX = /[\p{L}\p{N}]/gu;
const CJK_REGEX = /[\u4e00-\u9fff]/u;
const REPEATED_CHAR_RUN_REGEX = /(.)\1{7,}/u;
const REPEATED_PUNCTUATION_CLUSTER_REGEX = /([,，.。!！?？、;；~…])\1{3,}/u;

const GENERIC_ASSISTANT_HIGH_CONFIDENCE_PATTERNS = [
  /if you want[^.!?\n]{0,24}(?:you can|feel free to)[^.!?\n]{0,24}(?:talk to me|tell me|share)/i,
  /i will(?: always| still)? be here (?:with|for) you/i,
  /you do not have to (?:go through|face) this alone/i,
  /如果你愿意(?:的话)?[^。！？\n]{0,16}(?:可以|也可以|都可以|随时)[^。！？\n]{0,18}(?:和我说|告诉我|慢慢说)/u,
  /有什么(?:想说的|想聊的|事|心事|情绪)[^。！？\n]{0,18}(?:都)?可以[^。！？\n]{0,18}(?:和我说|告诉我)/u,
  /我会(?:一直|都)?在这里(?:陪(?:着)?你|支持你|听你说)/u,
  /你不需要一个人(?:扛|撑|面对|消化)/u,
  /当你(?:准备好|想说)的时候[^。！？\n]{0,10}(?:再)?和我说/u,
];
const GENERIC_ASSISTANT_MEDIUM_CONFIDENCE_PATTERNS = [
  /take a deep breath/i,
  /take it slow/i,
  /do not be too hard on yourself/i,
  /先(?:深呼吸|休息一下|缓一缓)/u,
  /慢慢来/u,
  /别给自己太大压力/u,
  /照顾好自己/u,
  /听起来你/u,
  /我(?:能)?理解你/u,
];

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

const RECOVERABLE_META_REPLY_PREFIX_REGEXES = [
  /^(?:in character|as the character|character reply|final reply|reply|response|message)\s*[:：-]\s*/i,
  /^(?:角色回复|角色回覆|角色回答|最终回复|回复|回覆|回答|台词|可发送内容|正文)\s*[:：-]\s*/u,
];
const RECOVERABLE_META_LEADIN_REGEXES = [
  /^(?:sure[,，]?\s*)?(?:here(?:'s| is)\s+)?(?:the\s+)?(?:reply|response|message)\s*[:：-]\s*/i,
  /^(?:作为(?:这个)?角色|按角色口吻|用角色口吻|下面是(?:角色)?回复|以下是(?:角色)?回复)\s*[:：-]?\s*/u,
];

function normalizeExcessivePunctuation(text: string): string {
  return text
    .replace(/[,\uFF0C]{2,}/g, '\uFF0C')
    .replace(/[.\u3002]{3,}/g, '\u3002')
    .replace(/[!\uFF01]{3,}/g, '\uFF01')
    .replace(/[?\uFF1F]{3,}/g, '\uFF1F')
    .replace(/[\u3001]{3,}/g, '\u3001')
    .replace(/[\u2026]{3,}/g, '\u2026')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

function hasStructuredProtocolPayload(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return (
    trimmed.startsWith(STRUCTURED_ASSISTANT_REPLY_TOKEN)
    || trimmed.startsWith('[GAME_CARD]')
    || trimmed.includes('---TRANSLATION---')
    || trimmed.startsWith('[COUPLE_SPACE_INVITE_ACCEPTED]')
    || trimmed.startsWith('[COUPLE_SPACE_INVITE]')
    || trimmed.startsWith('[LIGHT_INTERACTION]')
    || trimmed.startsWith('[transfer]')
    || /^\[转账\s*[\d.]+\]/.test(trimmed)
    || /^TRANSFER\|[\d.]+\|/i.test(trimmed)
  );
}

function countPatternHits(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function hasGenericAssistantTone(
  text: string,
  mode: AssistantOutputQualityOptions['toneGuardMode'],
): boolean {
  if (mode !== 'character_chat') {
    return false;
  }

  const normalized = text.trim();
  if (!normalized || hasStructuredProtocolPayload(normalized)) {
    return false;
  }

  const highHits = countPatternHits(normalized, GENERIC_ASSISTANT_HIGH_CONFIDENCE_PATTERNS);
  const mediumHits = countPatternHits(normalized, GENERIC_ASSISTANT_MEDIUM_CONFIDENCE_PATTERNS);

  return highHits >= 2 || (highHits >= 1 && mediumHits >= 1);
}

function hasObviousRepetitionNoise(text: string): boolean {
  const compactText = text.replace(/\s/g, '');
  if (!compactText) {
    return false;
  }

  if (REPEATED_CHAR_RUN_REGEX.test(compactText)) {
    return true;
  }

  const punctuationClusters = compactText.match(REPEATED_PUNCTUATION_CLUSTER_REGEX) ?? [];
  if (punctuationClusters.length >= 2) {
    return true;
  }

  return false;
}

function isInvalidBracketContent(content: string): boolean {
  const normalized = content.trim();
  if (!normalized) {
    return true;
  }

  if (ANALYSIS_LEAK_PATTERN.test(normalized) || SYSTEM_LEAK_PATTERN.test(normalized)) {
    return true;
  }

  const effectiveChars = countMatches(normalized, EFFECTIVE_CHAR_REGEX);
  if (effectiveChars === 0) {
    return true;
  }

  const punctuationChars = countMatches(normalized, PUNCTUATION_CHARS_REGEX);
  return normalized.length >= 4 && punctuationChars / Math.max(normalized.length, 1) > 0.65;
}

function sanitizeBracketBlocks(text: string, allowBracketActions: boolean): string {
  return text.replace(BRACKET_BLOCK_REGEX, (fullMatch, content: string) => {
    if (isInvalidBracketContent(content)) {
      return '';
    }

    return allowBracketActions ? fullMatch : '';
  });
}

function stripLeakedAnalysisLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      const unwrapped = line
        .replace(/^\*{1,3}/, '')
        .replace(/\*{1,3}$/, '')
        .replace(/^#{1,6}\s*/, '')
        .trim();

      if (ANALYSIS_LEAK_PATTERN.test(unwrapped)) {
        return false;
      }

      if (SYSTEM_LEAK_PATTERN.test(unwrapped)) {
        return false;
      }

      const looksLikeEnglishHeading =
        /^[A-Z][A-Za-z\s:'"-]{8,80}$/.test(unwrapped)
        && !CJK_REGEX.test(unwrapped)
        && !/[.!?]$/.test(unwrapped);
      if (looksLikeEnglishHeading) {
        return false;
      }

      return true;
    })
    .join('\n')
    .trim();
}

function stripRecoverableMetaPrefixes(text: string): string {
  let normalized = text.trim();
  if (!normalized) {
    return '';
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of [...RECOVERABLE_META_REPLY_PREFIX_REGEXES, ...RECOVERABLE_META_LEADIN_REGEXES]) {
      const nextValue = normalized.replace(pattern, '').trim();
      if (nextValue !== normalized) {
        normalized = nextValue;
        changed = true;
      }
    }
  }

  return normalized;
}

function collectRecoverableReplyCandidates(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const candidates = new Set<string>();
  const lines = trimmed
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const pushCandidate = (value: string) => {
    const normalized = stripRecoverableMetaPrefixes(
      value
        .replace(/^[-*#]+\s*/, '')
        .replace(/^["'\u201C\u201D\u2018\u2019]+|["'\u201C\u201D\u2018\u2019]+$/g, '')
        .trim(),
    );
    if (normalized) {
      candidates.add(normalized);
    }
  };

  pushCandidate(trimmed);
  for (const line of lines) {
    pushCandidate(line);

    const colonIndex = line.search(/[:：]/);
    if (colonIndex >= 0 && colonIndex < line.length - 1) {
      pushCandidate(line.slice(colonIndex + 1));
    }
  }

  return [...candidates];
}

export function recoverInvalidAssistantOutput(
  text: string,
  options: AssistantOutputQualityOptions,
  reason?: OutputQualityReason,
): string {
  if (!text.trim() || reason === 'generic_assistant_tone') {
    return '';
  }

  const candidates = collectRecoverableReplyCandidates(text);
  if (candidates.length === 0) {
    return '';
  }

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    const result = evaluateAssistantOutput(candidate, {
      ...options,
      toneGuardMode: 'off',
      allowBracketActions: options.allowBracketActions || /^[\(\uFF08][^\(\)\uFF08\uFF09\n]{1,80}[\)\uFF09]$/u.test(candidate),
    });

    if (result.ok) {
      return result.cleanedText;
    }
  }

  return '';
}

function buildInvalidOutputRetryInstruction(reason?: OutputQualityReason): string {
  const genericToneLine = reason === 'generic_assistant_tone'
    ? '不要用“如果你愿意可以和我说”、“我会一直在这里陪你”这类通用陪聊模板。请直接用当前角色本人的语气、边界和说话手感重答。'
    : '';

  return [
    '刚才的输出无法作为聊天消息使用。',
    reason ? `无效原因：${reason}。` : '',
    '请只输出当前角色会发出的一句自然聊天内容。',
    '不要写标题、解释、系统规则、思考过程、英文分析或纯标点。',
    genericToneLine,
    '如果用户正在使用中文，就用自然中文；如果用户明确使用其他语言或要求翻译，才跟随对应语言。',
  ].filter(Boolean).join('\n');
}

function buildSoftRecoveryRetryInstruction(reason?: OutputQualityReason): string {
  const emptyLine = reason === 'empty'
    ? '不要只输出括号动作、空白、纯标点或隐藏协议。'
    : '';
  const leakLine = reason === 'analysis_leak' || reason === 'system_leak'
    ? '不要解释规则、不要提 system、prompt、developer message、AI 身份或思考过程。'
    : '';
  const genericToneLine = reason === 'generic_assistant_tone'
    ? '不要说“如果你愿意可以和我说”“我会一直在这里陪你”这类模板安抚。'
    : '';

  return [
    '上一条仍然不能直接作为聊天气泡显示。',
    emptyLine,
    leakLine,
    genericToneLine,
    '现在请只发 1 到 2 句角色本人会直接发出去的短消息。',
    '不要解释，不要总结，不要分析，不要说规则，不要输出空白。',
    '如果前文里有会让你想跳出角色的词，也不要复述它们，直接回到角色当下的态度和语气。',
  ].filter(Boolean).join('\n');
}

async function streamRuntimeReplyText(params: {
  activeConfig: ApiConfig;
  messages: RuntimeChatMessage[];
  temperature?: number;
  onProgress?: (text: string) => void;
  traceLabel?: string;
}): Promise<string> {
  let responseText = '';
  await streamTextWithConfig({
    ...params,
    onTextChunk: (chunkText) => {
      responseText += chunkText;
      params.onProgress?.(responseText);
    },
  });
  return responseText;
}

function buildAttemptTraceLabel(base: string | null | undefined, attempt: 1 | 2 | 3) {
  if (!base?.trim()) {
    return undefined;
  }

  return `${base.trim()}:attempt-${attempt}`;
}

export function shouldAllowBracketActions(input: {
  actionDescriptionEnabled?: boolean;
  characterActionDescriptionEnabled?: boolean;
}): boolean {
  return !!input.characterActionDescriptionEnabled;
}

export function sanitizeAssistantOutput(
  text: string,
  options: AssistantOutputQualityOptions = {},
): string {
  if (!text) {
    return '';
  }

  let cleaned = text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .trim();

  cleaned = stripLeakedAnalysisLines(cleaned);
  cleaned = sanitizeBracketBlocks(cleaned, !!options.allowBracketActions);
  cleaned = normalizeExcessivePunctuation(cleaned);
  cleaned = cleaned
    .replace(/^\s*["'\u201C\u201D\u2018\u2019]+|["'\u201C\u201D\u2018\u2019]+\s*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

export function evaluateAssistantOutput(
  text: string,
  options: AssistantOutputQualityOptions = {},
): OutputQualityResult {
  const cleanedText = sanitizeAssistantOutput(text, options);
  if (!cleanedText) {
    return { ok: false, cleanedText, reason: 'empty' };
  }

  if (ANALYSIS_LEAK_PATTERN.test(cleanedText)) {
    return { ok: false, cleanedText, reason: 'analysis_leak' };
  }

  if (SYSTEM_LEAK_PATTERN.test(cleanedText)) {
    return { ok: false, cleanedText, reason: 'system_leak' };
  }

  const effectiveChars = countMatches(cleanedText, EFFECTIVE_CHAR_REGEX);
  if (effectiveChars === 0) {
    return { ok: false, cleanedText, reason: 'punctuation_only' };
  }

  const compactText = cleanedText.replace(/\s/g, '');
  const punctuationChars = countMatches(compactText, PUNCTUATION_CHARS_REGEX);
  const punctuationRatio = punctuationChars / Math.max(compactText.length, 1);
  const isStructuredProtocol = !!options.allowStructuredProtocols && hasStructuredProtocolPayload(cleanedText);
  if (!isStructuredProtocol && compactText.length >= 8 && punctuationRatio > 0.45) {
    return { ok: false, cleanedText, reason: 'punctuation_heavy' };
  }

  if (hasObviousRepetitionNoise(text)) {
    return { ok: false, cleanedText, reason: 'repetition_noise' };
  }

  if (hasGenericAssistantTone(cleanedText, options.toneGuardMode)) {
    return { ok: false, cleanedText, reason: 'generic_assistant_tone' };
  }

  return { ok: true, cleanedText };
}

export async function generateQualityCheckedAssistantReply(
  params: GenerateQualityCheckedAssistantReplyParams,
): Promise<OutputQualityResult> {
  const firstText = await streamRuntimeReplyText({
    activeConfig: params.activeConfig,
    messages: params.messages,
    temperature: params.temperature,
    traceLabel: buildAttemptTraceLabel(params.traceLabel, 1),
    onProgress: (text) => {
      params.onProgress?.(text, { attempt: 1 });
    },
  });
  const firstResult = evaluateAssistantOutput(firstText, {
    allowBracketActions: params.allowBracketActions,
    allowStructuredProtocols: params.allowStructuredProtocols,
    toneGuardMode: params.toneGuardMode,
  });
  if (firstResult.ok) {
    return firstResult;
  }

  params.onInvalid?.(firstResult);
  if (!Number.isFinite(params.retryTemperature)) {
    return firstResult;
  }

  const retryText = await streamRuntimeReplyText({
    activeConfig: params.activeConfig,
    messages: [
      ...params.messages,
      {
        role: 'user',
        content: buildInvalidOutputRetryInstruction(firstResult.reason),
      },
    ],
    temperature: params.retryTemperature,
    traceLabel: buildAttemptTraceLabel(params.traceLabel, 2),
    onProgress: (text) => {
      params.onProgress?.(text, { attempt: 2 });
    },
  });
  const retryResult = evaluateAssistantOutput(retryText, {
    allowBracketActions: params.allowBracketActions,
    allowStructuredProtocols: params.allowStructuredProtocols,
    toneGuardMode: params.toneGuardMode,
  });

  if (!retryResult.ok) {
    params.onInvalid?.(retryResult);
  }

  if (retryResult.ok || params.softRecoveryMode !== 'character_chat') {
    return retryResult;
  }

  const recoveryOptions: AssistantOutputQualityOptions = {
    allowBracketActions: params.allowBracketActions,
    allowStructuredProtocols: params.allowStructuredProtocols,
    toneGuardMode: params.toneGuardMode,
  };
  const recoveredRetryText = recoverInvalidAssistantOutput(
    retryText,
    recoveryOptions,
    retryResult.reason,
  );
  if (recoveredRetryText) {
    return { ok: true, cleanedText: recoveredRetryText };
  }

  const recoveredFirstText = recoverInvalidAssistantOutput(
    firstText,
    recoveryOptions,
    firstResult.reason,
  );
  if (recoveredFirstText) {
    return { ok: true, cleanedText: recoveredFirstText };
  }

  const rescueText = await streamRuntimeReplyText({
    activeConfig: params.activeConfig,
    messages: [
      ...params.messages,
      {
        role: 'user',
        content: buildSoftRecoveryRetryInstruction(retryResult.reason),
      },
    ],
    temperature: Math.min(Math.max(params.retryTemperature ?? params.temperature ?? 0.65, 0.3), 0.45),
    traceLabel: buildAttemptTraceLabel(params.traceLabel, 3),
    onProgress: (text) => {
      params.onProgress?.(text, { attempt: 3 });
    },
  });
  const rescueResult = evaluateAssistantOutput(rescueText, recoveryOptions);
  if (rescueResult.ok) {
    return rescueResult;
  }

  params.onInvalid?.(rescueResult);
  const recoveredRescueText = recoverInvalidAssistantOutput(
    rescueText,
    recoveryOptions,
    rescueResult.reason,
  );
  if (recoveredRescueText) {
    return { ok: true, cleanedText: recoveredRescueText };
  }

  return rescueResult;
}
