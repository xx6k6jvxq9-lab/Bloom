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

test('buildGroupChatPrompt includes structural group roles when provided', () => {
  const prompt = buildGroupChatPrompt({
    sceneInput: {
      speakerName: 'Alpha',
      speakerCorePersona: '嘴硬，护短，会接梗。',
      userName: 'User',
      memberNames: ['Alpha', 'Beta'],
      mode: 'reply',
      groupStage: 'warming',
      relationshipSummary: '正常群聊关系。',
      peerAwareness: [],
      roleInstruction: 'Please reply to the conversation in the group chat context.',
      recentContext: {
        speakerStructuralGroupRole: '管理员',
        userStructuralGroupRole: '群主',
        groupManagementSummary: '群主：User；管理员：Alpha',
      },
      historyTranscript: '暂无历史消息。',
    },
  });

  assert.match(prompt, /当前角色的群内明面身份：管理员/);
  assert.match(prompt, /只影响是否有资格发公告或发起群事件/);
  assert.match(prompt, /用户当前的群内明面身份：群主/);
  assert.match(prompt, /群管理结构：群主：User；管理员：Alpha/);
});
