import { useCallback } from 'react';
import type { ApiConfig, Character, ChatMessage } from '../../types';
import { generateTextWithConfig } from '../../services/ai/runtimeClient';
import { buildGroupChatPrompt } from '../../services/ai/prompts/builders/buildGroupChatPrompt';
import { createCharacterDirectory } from '../character-domain/useCharacterDirectory';
import { useSessionRuntimeCore } from './useSessionRuntimeCore';
import type { SendCapableSessionRuntime } from './types';

type UseGroupChatRuntimeArgs = {
  members: Character[];
  history: ChatMessage[];
  setHistory: (history: ChatMessage[]) => void;
  input: string;
  setInput: (value: string) => void;
  userName: string;
  activeConfig?: ApiConfig;
};

type UseGroupChatRuntimeResult = SendCapableSessionRuntime;

export function useGroupChatRuntime({
  members,
  history,
  setHistory,
  input,
  setInput,
  userName,
  activeConfig,
}: UseGroupChatRuntimeArgs): UseGroupChatRuntimeResult {
  const { isLoading, error, setError, runGeneration } = useSessionRuntimeCore();
  const { getCharacterByName } = createCharacterDirectory({ characters: members });
  const hasActiveConfig = !!activeConfig;

  const triggerAISpeaker = useCallback(async (speaker: Character, currentHistory: ChatMessage[]) => {
    await runGeneration(async () => {
      if (!activeConfig) {
        throw new Error('Missing active API config.');
      }

      const responseText = await generateTextWithConfig({
        activeConfig,
        prompt: buildGroupChatPrompt({
          speaker,
          members,
          userName,
          history: currentHistory,
          mode: 'invited',
        }),
        temperature: 0.7,
      });

      if (responseText) {
        const replyMsg: ChatMessage = {
          role: 'model',
          text: `${speaker.name}: ${responseText}`,
          timestamp: Date.now(),
        };
        setHistory([...currentHistory, replyMsg]);
      }
    }).catch((runtimeError) => {
      console.error('Triggered speaker error:', runtimeError);
    });
  }, [activeConfig, members, runGeneration, setHistory, userName]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (!hasActiveConfig) {
      setError('未检测到 API Key，请在设置中配置。');
      return;
    }

    const userMsg: ChatMessage = { role: 'user', text: input.trim(), timestamp: Date.now() };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setInput('');

    await runGeneration(async ({ setRuntimeError }) => {
      let responder = members[Math.floor(Math.random() * members.length)];

      const lastMsg = newHistory[newHistory.length - 1];
      if (lastMsg.role === 'user') {
        const mentionMatch = lastMsg.text.match(/@([^ ]+)/);
        if (mentionMatch) {
          const mentionedName = mentionMatch[1];
          const mentionedChar = getCharacterByName(mentionedName);
          if (mentionedChar) responder = mentionedChar;
        }
      }

      if (!responder) {
        throw new Error('群组中没有成员');
      }

      if (!activeConfig) {
        throw new Error('Missing active API config.');
      }

      const responseText = await generateTextWithConfig({
        activeConfig,
        prompt: buildGroupChatPrompt({
          speaker: responder,
          members,
          userName,
          history: newHistory,
          mode: 'reply',
        }),
        temperature: 0.7,
      });

      if (responseText) {
        const replyMsg: ChatMessage = {
          role: 'model',
          text: `${responder.name}: ${responseText}`,
          timestamp: Date.now(),
        };
        const updatedHistory = [...newHistory, replyMsg];
        setHistory(updatedHistory);

        const mentionMatch = responseText.match(/@([^ ]+)/);
        if (mentionMatch) {
          const nextSpeakerName = mentionMatch[1];
          const nextSpeaker = getCharacterByName(nextSpeakerName);
          if (nextSpeaker && nextSpeaker.id === responder.id) {
            return;
          }
          if (nextSpeaker) {
            setTimeout(() => {
              void triggerAISpeaker(nextSpeaker, updatedHistory);
            }, 1500);
          }
        }
      }
    }).catch((runtimeError) => {
      console.error('Group chat error:', runtimeError);
      setError(`发送失败: ${runtimeError instanceof Error ? runtimeError.message : '未知错误'}`);
    });
  }, [activeConfig, getCharacterByName, hasActiveConfig, history, input, isLoading, members, runGeneration, setError, setHistory, setInput, triggerAISpeaker, userName]);

  return {
    isLoading,
    error,
    sendText: handleSend,
  };
}
