import assert from 'node:assert/strict';
import { test } from 'node:test';
import { powerTrigger } from './parse-powers.ts';

void test('a trigger reads its effect: a cast, a stacking buff, or skill changes held for a while', (): void => {
  assert.deepEqual(powerTrigger({ on: 'use', skill: { group: 'motion' }, effect: { type: 'empower', skillMods: [{ skill: 'quarrel', field: 'pierce', value: 1 }], duration: 2 } }, 'x'), {
    on: 'use',
    skill: { type: 'group', group: 'motion' },
    target: 'any',
    every: 1,
    cooldown: 0,
    effect: { type: 'empower', skillMods: [{ target: { type: 'skill', skill: 'quarrel' }, field: 'pierce', value: 1 }], duration: 2 },
  });
  assert.equal(powerTrigger({ on: 'kill', effect: { type: 'cast', skill: 'forkline', at: 'target' } }, 'x').effect.type, 'cast');
  assert.throws((): unknown => powerTrigger({ on: 'use', effect: { type: 'empower', skillMods: [], duration: 0 } }, 'x'));
  assert.throws((): unknown => powerTrigger({ on: 'use', effect: { type: 'glow' } }, 'x'));
});
