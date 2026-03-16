import type { Character, ChatMessage, DateSession, UserProfileExtended } from '../../../../types';
import { DATING_SCENARIO_PROMPT } from '../scenarios/dating';

type BuildDatingPromptOptions = {
  mode: 'start' | 'continue';
  character: Character;
  userProfile: UserProfileExtended;
  session: DateSession;
  chatHistory: ChatMessage[];
  latestUserInput?: string;
};

export function buildDatingPrompt({
  mode,
  character,
  userProfile,
  session,
  chatHistory,
  latestUserInput,
}: BuildDatingPromptOptions): string {
  const pastChatContext = chatHistory
    .slice(-16)
    .map(message => `${message.role === 'user' ? '用户' : character.name}：${message.text}`)
    .join('\n');

  const datingMessages = session.messages
    .slice(-12)
    .map(message => {
      if (message.role === 'user') {
        return `用户在约会中说：${message.text}`;
      }

      if (message.generatedContent) {
        const summary = message.generatedContent.narrative.segments.map(segment => segment.text).join(' ');
        return `角色上一轮剧情：${summary}`;
      }

      return `角色上一轮剧情：${message.text}`;
    })
    .join('\n');

  const currentGeneratedNarrative = session.generatedContent?.narrative?.segments?.length
    ? session.generatedContent.narrative.segments
        .map(segment => `${segment.type === 'dialogue' ? '[台词]' : '[叙述]'} ${segment.text}`)
        .join('\n')
    : '当前还没有已生成的正式约会正文。';

  const currentGeneratedStatus = session.generatedContent?.status
    ? `当前状态：
地点：${session.generatedContent.status.location}
时间：${session.generatedContent.status.time}
心情：${session.generatedContent.status.mood}
内心OS：${session.generatedContent.status.innerThought}`
    : '当前还没有已生成的状态。';

  const currentGeneratedPlaylist = session.generatedContent?.playlist?.length
    ? `当前歌单：
${session.generatedContent.playlist
  .map(song => `- ${song.title} / ${song.artist}：${song.note || '符合当前氛围'}`)
  .join('\n')}`
    : '当前还没有已生成的歌单。';

  const backgroundRule = session.backgroundImage
    ? `本次约会背景图已经确定，页面会优先使用：${session.backgroundImage}`
    : '本次约会背景图未单独设置，页面默认使用角色头像作为背景。';

  const task =
    mode === 'start'
      ? '现在请正式生成这次约会的第一轮内容。第一轮内容也必须是即时生成，不能使用默认模板文案。'
      : latestUserInput
        ? `用户刚刚在正式约会里说了：${latestUserInput}
请从这句话之后继续推进剧情，并同步更新状态与歌单。`
        : '请基于当前保留的约会上下文继续生成后续内容。';

  return [
    DATING_SCENARIO_PROMPT.trim(),
    `角色：${character.name}`,
    `角色设定：${character.setting}`,
    `角色签名：${character.signature || '暂无'}`,
    `用户：${userProfile.name}`,
    `本次约会地点：${session.location}`,
    `本次约会情景：${session.scenario}`,
    `本次约会氛围：${session.mood}`,
    backgroundRule,
    `用户与角色的过往聊天记录（用于延续关系和心理变化）：
${pastChatContext || '暂无可用聊天记录。'}`,
    `正式约会内的消息流记录：
${datingMessages || '暂无约会内消息。'}`,
    `最近一轮已生成的约会正文：
${currentGeneratedNarrative}`,
    currentGeneratedStatus,
    currentGeneratedPlaylist,
    task,
  ]
    .filter(Boolean)
    .join('\n\n');
}
