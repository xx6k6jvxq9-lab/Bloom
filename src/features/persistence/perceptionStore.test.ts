import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultPerceptionSettings,
  hydratePerceptionSettings,
} from './perceptionStore';

test('hydratePerceptionSettings backfills missing nested fields', () => {
  const hydrated = hydratePerceptionSettings({
    enabled: true,
    location: {
      enabled: true,
      value: 'Neon Harbor',
    },
  });

  assert.equal(hydrated.enabled, true);
  assert.deepEqual(hydrated.dateTime, createDefaultPerceptionSettings().dateTime);
  assert.deepEqual(hydrated.weather, createDefaultPerceptionSettings().weather);
  assert.deepEqual(hydrated.temperature, createDefaultPerceptionSettings().temperature);
  assert.deepEqual(hydrated.climate, createDefaultPerceptionSettings().climate);
  assert.deepEqual(hydrated.location, {
    enabled: true,
    value: 'Neon Harbor',
  });
});
