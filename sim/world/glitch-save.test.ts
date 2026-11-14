import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGlitchSave } from './glitch-save.ts';

void test('glitch progress, fired triggers and played seconds read back, and anything broken falls back to the start', (): void => {
  assert.deepEqual(readGlitchSave({ progress: 3, fired: ['first_seam', 4], played: 125.5 }), { progress: 3, fired: ['first_seam'], played: 125.5 });
  assert.deepEqual(readGlitchSave({ progress: -1, fired: 'x', played: -4 }), { progress: 0, fired: [], played: null });
  assert.deepEqual(readGlitchSave({ progress: 1, fired: [] }), { progress: 1, fired: [], played: null });
  assert.deepEqual(readGlitchSave(undefined), { progress: 0, fired: [], played: null });
});
