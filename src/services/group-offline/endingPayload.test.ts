import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, GroupOfflineSession } from '../../types';
import {
  buildDerivedGroupOfflineEndingPayload,
  buildUserAnchoredGroupOfflineEndingVoices,
} from './endingPayload';

function createCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    gender: 'other',
    avatar: '',
    setting: `${name} persona.`,
  } as Character;
}

function createSession(overrides?: Partial<GroupOfflineSession>): GroupOfflineSession {
  return {
    id: 'offline-ending-1',
    groupId: 'group-1',
    mode: 'daily',
    generationMode: 'blocks',
    activityType: '临时碰头',
    location: '旧城区入口',
    scenePrompt: '风从旧城区入口吹过来。',
    timeLabel: '今晚 21:30',
    weatherLabel: '风很大',
    vibe: '收束',
    participants: [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: 1,
    updatedAt: 1,
    currentRound: 1,
    messages: [],
    status: 'active',
    ...overrides,
  } as GroupOfflineSession;
}

test('buildUserAnchoredGroupOfflineEndingVoices only keeps explicit user-targeted continuity', () => {
  const members = [
    createCharacter('alpha', '阿青'),
    createCharacter('beta', '小白'),
  ];
  const session = createSession({
    generatedContent: {
      card: {
        timeLabel: '今晚 21:30',
        locationLabel: '旧城区入口',
        weatherLabel: '风很大',
        participantLabels: ['阿青', '小白'],
      },
      intro: '风从旧城区入口吹散了刚才那点紧绷。',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        userMessageText: '别散，先把刚才那句说完。',
        characterEntries: [
          {
            characterId: 'alpha',
            speakerLabel: '阿青',
            target: { type: 'user', label: '你' },
            text: '他看着你，还是把声音压低了些。“别急，跟我走。”',
            highlightText: '别急，跟我走',
            statusFields: [],
          },
          {
            characterId: 'beta',
            speakerLabel: '小白',
            target: { type: 'character', label: '阿青', characterId: 'alpha' },
            text: '他只回头看了阿青一眼，没有接你的话。',
            statusFields: [],
          },
        ],
      }],
    },
  });

  const voices = buildUserAnchoredGroupOfflineEndingVoices(session, members);

  assert.equal(voices.length, 1);
  assert.equal(voices[0]?.characterId, 'alpha');
  assert.match(voices[0]?.text || '', /回去|跟我说完|跟我说清楚/u);
  assert.doesNotMatch(voices[0]?.text || '', /回群|我到了|撤了/u);
});

test('buildUserAnchoredGroupOfflineEndingVoices can continue a character explicitly mentioned by the user', () => {
  const members = [createCharacter('alpha', '阿青')];
  const session = createSession({
    participants: [{ characterId: 'alpha', joinedAt: 1, presence: 'arrived' }],
    generatedContent: {
      card: {
        timeLabel: '今晚 21:30',
        locationLabel: '旧城区入口',
        weatherLabel: '风很大',
        participantLabels: ['阿青'],
      },
      intro: '场子刚要散。',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        userMessageText: '阿青你先别躲，把刚才那句说完。',
        characterEntries: [{
          characterId: 'alpha',
          speakerLabel: '阿青',
          target: { type: 'group', label: '全场' },
          text: '他终于抬眼，像是松了半口气。“我没躲。”',
          highlightText: '我没躲',
          statusFields: [],
        }],
      }],
    },
  });

  const voices = buildUserAnchoredGroupOfflineEndingVoices(session, members);

  assert.equal(voices.length, 1);
  assert.match(voices[0]?.text || '', /刚才我都点到你了|既然刚才都点到你了|刚才我都点你了/u);
});

test('buildDerivedGroupOfflineEndingPayload leaves ending voices empty when there was no user-facing continuity', () => {
  const members = [
    createCharacter('alpha', '阿青'),
    createCharacter('beta', '小白'),
  ];
  const session = createSession({
    generatedContent: {
      card: {
        timeLabel: '今晚 21:30',
        locationLabel: '旧城区入口',
        weatherLabel: '风很大',
        participantLabels: ['阿青', '小白'],
      },
      intro: '风从旧城区入口吹散了刚才那点紧绷。',
      lines: [],
      characterBlocks: [],
      rounds: [{
        id: 'round-1',
        sceneText: '两个人都在收各自的尾。',
        characterEntries: [
          {
            characterId: 'alpha',
            speakerLabel: '阿青',
            target: { type: 'character', label: '小白', characterId: 'beta' },
            text: '他只是在和小白对最后那一下眼色。',
            statusFields: [],
          },
          {
            characterId: 'beta',
            speakerLabel: '小白',
            target: { type: 'group', label: '全场' },
            text: '他没再把话往你这边接。',
            statusFields: [],
          },
        ],
      }],
    },
  });

  const payload = buildDerivedGroupOfflineEndingPayload(session, members);

  assert.equal(payload.summaryLines.length > 0, true);
  assert.deepEqual(payload.endingVoices, []);
});
