import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SoundCue } from '../../sim/audio.ts';
import type { SeamSound } from '../../sim/content/audio.ts';
import type { SeamTimes } from '../../sim/content/glitches.ts';
import { SEAM_PHASES } from '../../sim/world/seam.ts';
import { createSeamAudio, SEAM_AUDIO, seamPart, worldLevel } from './seam-audio.ts';
import type { SeamAudioOut } from './seam-audio.ts';

interface Heard {
  readonly thins: { readonly level: number; readonly seconds: number }[];
  readonly synths: number[];
  readonly cues: string[];
}

const TIMES: SeamTimes = { buildUp: 2, guard: 0.5, tear: 0.36, tearBack: 0.36, settle: 0.8 };

function sound(synth: boolean): SeamSound {
  const cues: SeamSound['parts']['tear']['cues'] = synth ? [] : [{ sound: 'glitch_tear', volume: 1, maxVoices: 1, cooldown: 0, reach: 0 }];
  return {
    worldFloor: 0.18,
    parts: {
      buildUp: { synth, cues },
      tear: { synth, cues },
      tearBack: { synth, cues },
      settle: { synth, cues },
    },
  };
}

function listener(): { readonly out: SeamAudioOut; readonly heard: Heard } {
  const heard: Heard = { thins: [], synths: [], cues: [] };
  const out: SeamAudioOut = {
    playSeam(cue: SoundCue): void {
      heard.cues.push(cue.sound);
    },
    synth(): void {
      heard.synths.push(heard.thins.length);
    },
    thinWorld(level: number, seconds: number): void {
      heard.thins.push({ level, seconds });
    },
  };
  return { out, heard };
}

void test('the build-up thins the world to its floor over the build-up and starts the riser', (): void => {
  const { out, heard } = listener();
  createSeamAudio(out, sound(true), TIMES).phase('build_up');
  assert.deepEqual(heard.thins, [{ level: 0.18, seconds: TIMES.buildUp }]);
  assert.equal(heard.synths.length, 1);
});

void test('the mist is silent: the world stays out and no part plays', (): void => {
  const { out, heard } = listener();
  createSeamAudio(out, sound(true), TIMES).phase('mist');
  assert.equal(heard.thins[0]?.level, 0);
  assert.equal(heard.synths.length, 0);
  assert.equal(heard.cues.length, 0);
});

void test('each tear plays one hit and the settle brings the world back', (): void => {
  const { out, heard } = listener();
  const audio = createSeamAudio(out, sound(true), TIMES);
  for (const phase of SEAM_PHASES) audio.phase(phase);
  assert.equal(heard.synths.length, 4);
  assert.deepEqual(heard.thins.map((thin: { readonly level: number }): number => thin.level), [0.18, 0, 0, 0, 1]);
});

void test('a part made of samples plays its cues and no synth', (): void => {
  const { out, heard } = listener();
  createSeamAudio(out, sound(false), TIMES).phase('tear');
  assert.deepEqual(heard.cues, ['glitch_tear']);
  assert.equal(heard.synths.length, 0);
});

void test('the end always restores the world', (): void => {
  const { out, heard } = listener();
  createSeamAudio(out, sound(true), TIMES).end();
  assert.deepEqual(heard.thins, [{ level: 1, seconds: SEAM_AUDIO.restoreSeconds }]);
});

void test('only the mist has no sound part, and the world is out only while it is hidden', (): void => {
  assert.equal(seamPart('mist'), null);
  assert.equal(seamPart('tear_back'), 'tearBack');
  assert.equal(worldLevel('settle', sound(true)), 1);
  assert.equal(worldLevel('tear_back', sound(true)), 0);
});
