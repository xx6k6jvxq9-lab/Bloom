import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGroupOfflineRecruitResponses } from './groupOfflineRecruitResponses';

test('parseGroupOfflineRecruitResponses keeps both join and decline reactions', () => {
  const responses = parseGroupOfflineRecruitResponses(`
    {
      "reactions": [
        { "characterId": "alpha", "decision": "join", "text": "算我一个，我到时候直接过去。" },
        { "characterId": "beta", "decision": "decline", "text": "这次我去不了，手上的事还没收完。" }
      ]
    }
  `);

  assert.deepEqual(responses, [
    { characterId: 'alpha', decision: 'join', text: '算我一个，我到时候直接过去。' },
    { characterId: 'beta', decision: 'decline', text: '这次我去不了，手上的事还没收完。' },
  ]);
});

test('parseGroupOfflineRecruitResponses falls back to legacy signup payloads', () => {
  const responses = parseGroupOfflineRecruitResponses(`
    {
      "signups": [
        { "characterId": "alpha", "text": "我报一个。" }
      ]
    }
  `);

  assert.deepEqual(responses, [
    { characterId: 'alpha', decision: 'join', text: '我报一个。' },
  ]);
});

test('parseGroupOfflineRecruitResponses ignores invalid entries and dedupes characters', () => {
  const responses = parseGroupOfflineRecruitResponses(`
    {
      "reactions": [
        { "characterId": "alpha", "decision": "join", "text": "我去。" },
        { "characterId": "alpha", "decision": "decline", "text": "我不去了。" },
        { "characterId": "", "decision": "join", "text": "invalid" }
      ]
    }
  `);

  assert.deepEqual(responses, [
    { characterId: 'alpha', decision: 'join', text: '我去。' },
  ]);
});
