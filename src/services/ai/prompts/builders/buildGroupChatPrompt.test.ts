import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGroupChatPrompt } from './buildGroupChatPrompt';

test('buildGroupChatPrompt includes the public persona guide alongside persona guard rules', () => {
  const prompt = buildGroupChatPrompt({
    sceneInput: {
      speakerName: 'Alpha',
      speakerCorePersona: '嘴硬，护短，会接梗。',
      speakerSignature: '懒得装不在意。',
      speakerPublicPersonaGuide: [
        '## 公开场合角色锚点',
        '[角色可主动外放的私密线索]',
        '- 喜欢半开玩笑提你，像在宣示主权。',
      ].join('\n'),
      userName: 'User',
      memberNames: ['Alpha', 'Beta'],
      mode: 'reply',
      groupStage: 'warming',
      relationshipSummary: '正常群聊关系。',
      peerAwareness: [],
      roleInstruction: 'Please reply to the conversation in the group chat context.',
      recentContext: {
        expressionStyle: '公开场合会轻描淡写地阴阳一句。',
      },
      historyTranscript: '暂无历史消息。',
    },
  });

  assert.match(prompt, /## 公开场合角色锚点/);
  assert.match(prompt, /宣示主权/);
});
