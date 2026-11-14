import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SoundCue } from '../../sim/audio.ts';
import { CENTRE } from './mix.ts';
import type { HeldCue, VoiceHold } from './voice-hold.ts';
import { createVoiceHold } from './voice-hold.ts';

const PLAIN: SoundCue = { sound: 'bone_hit', volume: 1, maxVoices: 2, cooldown: 0, reach: 30, holdForVoice: 0, position: null };
const PATIENT: SoundCue = { sound: 'opening_alien', volume: 0.55, maxVoices: 1, cooldown: 30, reach: 30, holdForVoice: 8, position: null };

function sounds(ready: readonly HeldCue[]): readonly string[] {
  return ready.map((entry: HeldCue): string => entry.cue.sound);
}

void test('a cue that does not wait for voices plays at once, even over a voice', (): void => {
  const hold: VoiceHold = createVoiceHold();
  assert.equal(hold.offer(PLAIN, CENTRE, 0, true), true);
  assert.equal(hold.waiting(), 0);
});

void test('a waiting cue plays at once when nothing is being spoken', (): void => {
  const hold: VoiceHold = createVoiceHold();
  assert.equal(hold.offer(PATIENT, CENTRE, 0, false), true);
  assert.equal(hold.waiting(), 0);
});

void test('a waiting cue is held while a voice speaks and plays on the first silent frame', (): void => {
  const hold: VoiceHold = createVoiceHold();
  assert.equal(hold.offer(PATIENT, CENTRE, 10, true), false);
  assert.deepEqual(sounds(hold.release(11, true)), []);
  assert.deepEqual(sounds(hold.release(13, true)), []);
  assert.deepEqual(sounds(hold.release(14, false)), ['opening_alien']);
  assert.deepEqual(sounds(hold.release(15, false)), []);
  assert.equal(hold.waiting(), 0);
});

void test('a voice that outlasts the hold drops the cue, so it never plays over the voice or late', (): void => {
  const hold: VoiceHold = createVoiceHold();
  hold.offer(PATIENT, CENTRE, 10, true);
  assert.deepEqual(sounds(hold.release(18, true)), []);
  assert.equal(hold.waiting(), 1);
  assert.deepEqual(sounds(hold.release(18.5, false)), []);
  assert.equal(hold.waiting(), 0);
});

void test('the same sound offered twice while held waits once and plays once', (): void => {
  const hold: VoiceHold = createVoiceHold();
  hold.offer(PATIENT, CENTRE, 0, true);
  assert.equal(hold.offer(PATIENT, CENTRE, 1, true), false);
  assert.equal(hold.waiting(), 1);
  assert.deepEqual(sounds(hold.release(2, false)), ['opening_alien']);
});
