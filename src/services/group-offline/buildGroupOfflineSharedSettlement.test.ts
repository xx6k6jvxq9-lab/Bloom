import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, GroupOfflineSession } from '../../types';
import { buildGroupOfflineSharedSettlement } from './buildGroupOfflineSharedSettlement';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: overrides.id ?? 'alpha',
    name: overrides.name ?? '沈星回',
    gender: overrides.gender ?? 'other',
    avatar: overrides.avatar ?? '',
    setting: overrides.setting ?? '表面冷静，实际上会记很细。',
    openingRemark: overrides.openingRemark ?? '你来了。',
    sharedContextSnapshots: overrides.sharedContextSnapshots,
    shortTermSummary: overrides.shortTermSummary,
    openLoopRegistry: overrides.openLoopRegistry,
    presenceState: overrides.presenceState,
    sharedState: overrides.sharedState,
  } as Character;
}

function createSession(): GroupOfflineSession {
  return {
    id: 'offline-1',
    groupId: 'group-1',
    mode: 'daily',
    generationMode: 'blocks',
    activityType: '深夜续摊',
    location: '停车场出口',
    timeLabel: '今晚 21:30',
    weatherLabel: '夜风微凉',
    vibe: '各怀心事',
    participants: [
      { characterId: 'alpha', joinedAt: 1, presence: 'arrived' },
      { characterId: 'beta', joinedAt: 1, presence: 'arrived' },
    ],
    createdAt: 1,
    updatedAt: 1,
    currentRound: 2,
    messages: [],
    status: 'ended',
    endedAt: 10,
    generatedContent: {
      card: {
        timeLabel: '今晚 21:30',
        locationLabel: '停车场出口',
        weatherLabel: '夜风微凉',
        participantLabels: ['沈星回', '张白'],
      },
      intro: '刚从线下收尾。',
      lines: [],
      characterBlocks: [],
      rounds: [
        {
          id: 'round-1',
          title: '第 1 轮',
          sceneText: '停车场出口的风把刚才那点热意吹散了一些。',
          userMessageText: '你们都到家了吗？',
          characterEntries: [
            {
              characterId: 'alpha',
              speakerLabel: '沈星回',
              target: { type: 'user', label: '林然然' },
              text: '沈星回看了一眼手机，还是先问她到家没有。',
              highlightText: '“先回去，别在外面吹风。”',
              statusFields: [],
              notebook: '记下她在风口里还要回头看这一眼。',
              memoryPanel: {
                shortTerm: ['他先问了她到家没有。'],
                longTerm: [],
              },
            },
            {
              characterId: 'beta',
              speakerLabel: '张白',
              text: '张白嘴上还在逗，实际上已经开始催人回去。',
              statusFields: [],
            },
          ],
        },
      ],
    },
  } as GroupOfflineSession;
}

test('buildGroupOfflineSharedSettlement emits group_offline settlement records for participant continuity', () => {
  const settlement = buildGroupOfflineSharedSettlement(createCharacter(), createSession());

  assert.equal(settlement.sharedContextSnapshots.length > 0, true);
  assert.equal(settlement.sharedContextSnapshots[0]?.sourceScene, 'group_offline');
  assert.match(settlement.shortTermSummary || '', /群线下|停车场出口|余波/);
  assert.equal(settlement.sceneProgressRecords?.length, 1);
  assert.match(settlement.sceneProgressRecords?.[0]?.summary || '', /群线下推进到/);
  assert.equal(settlement.sharedState?.sourceScene, 'group_offline');
});
