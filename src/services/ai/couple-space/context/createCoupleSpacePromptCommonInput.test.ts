import assert from 'node:assert/strict';
import test from 'node:test';
import type { PerceptionSettings, UserProfileExtended } from '../../../../types';
import { DEFAULT_CHARACTERS } from '../../../../features/app-shell/defaultCharacters';
import { DEFAULT_USER } from '../../../../features/app-shell/defaultSettings';
import { createDefaultCoupleSpaceData } from '../../../../features/persistence/coupleSpaceStore';
import { createDefaultPerceptionSettings } from '../../../../features/persistence/perceptionStore';
import { createCoupleSpacePromptCommonInput } from './createCoupleSpacePromptCommonInput';

function buildPerception(dateTimeValue: string): PerceptionSettings {
  return {
    ...createDefaultPerceptionSettings(),
    enabled: true,
    dateTime: {
      enabled: true,
      value: dateTimeValue,
    },
  };
}

test('createCoupleSpacePromptCommonInput prefers explicit perception over coupleSpace perception', () => {
  const partner = DEFAULT_CHARACTERS[0]!;
  const explicitPerception = buildPerception('2099-12-31T23:59');
  const legacyCoupleSpacePerception = buildPerception('1999-01-01T08:00');
  const coupleSpace = createDefaultCoupleSpaceData({
    partnerId: partner.id,
    perception: legacyCoupleSpacePerception,
  });

  const envelope = createCoupleSpacePromptCommonInput({
    source: {
      user: DEFAULT_USER as UserProfileExtended,
      partner,
      coupleSpace,
      perception: explicitPerception,
      chatHistory: {},
      now: Date.parse('2026-05-10T04:09:00Z'),
    },
  });

  const sectionsText = (envelope.common.sections || []).join('\n');
  assert.match(sectionsText, /2099-12-31T23:59/);
  assert.doesNotMatch(sectionsText, /1999-01-01T08:00/);
});
