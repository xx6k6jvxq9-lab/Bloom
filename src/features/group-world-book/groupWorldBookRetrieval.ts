import type { WorldBookRetrievalOptions } from '../../services/world-book/worldBookBudget';

type GroupWorldBookRecallMessage = {
  role?: string | null | undefined;
  text?: string | null | undefined;
};

export function extractGroupWorldBookRecallText(message: GroupWorldBookRecallMessage): string {
  return typeof message.text === 'string' ? message.text.trim() : '';
}

export function buildGroupWorldBookRetrievalOptions(params: {
  history?: GroupWorldBookRecallMessage[];
  supplementalMessages?: GroupWorldBookRecallMessage[];
  latestUserMessage?: string;
} = {}): WorldBookRetrievalOptions {
  const history = params.history || [];
  const supplementalMessages = params.supplementalMessages || [];
  const recentText = [...history, ...supplementalMessages]
    .map(extractGroupWorldBookRecallText)
    .filter(Boolean)
    .slice(-8);
  const latestSupplementalUserText = [...supplementalMessages]
    .reverse()
    .find((message) => message.role === 'user' && extractGroupWorldBookRecallText(message))
    ?.text;
  const latestHistoryUserText = [...history]
    .reverse()
    .find((message) => message.role === 'user' && extractGroupWorldBookRecallText(message))
    ?.text;
  const latestConversationText = [...supplementalMessages, ...history]
    .map(extractGroupWorldBookRecallText)
    .reverse()
    .find(Boolean);
  const query = (params.latestUserMessage || '').trim()
    || extractGroupWorldBookRecallText({ text: latestSupplementalUserText })
    || extractGroupWorldBookRecallText({ text: latestHistoryUserText })
    || latestConversationText
    || undefined;

  return {
    query,
    recentText,
  };
}
