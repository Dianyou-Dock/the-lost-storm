import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadGlitches } from '../content/glitches.ts';
import type { SeamMoment, SeamPhase, SeamPlan } from './seam.ts';
import { guardStart, hidesWorld, phaseLength, SEAM_PHASES, seamAt, seamLength } from './seam.ts';

const PLAN: SeamPlan = { times: loadGlitches().seam, mist: 2 };

void test('a seam is its five phases end to end, with lengths from data', (): void => {
  const times = PLAN.times;
  assert.equal(seamLength(PLAN), times.buildUp + times.tear + PLAN.mist + times.tearBack + times.settle);
  assert.equal(phaseLength(PLAN, 'mist'), PLAN.mist);
  assert.ok(times.buildUp >= 1.5 && times.buildUp <= 3);
  assert.ok(times.tear < 1 && times.tearBack < 1 && times.settle < 1);
  assert.equal(guardStart(PLAN), times.buildUp - times.guard);
});

void test('the phase at any moment runs through every phase in order and ends settled', (): void => {
  const seen: SeamPhase[] = [];
  let last: number = -1;
  for (let at: number = 0; at < seamLength(PLAN) + 0.5; at += 1 / 60) {
    const moment: SeamMoment = seamAt(PLAN, at);
    if (seen.at(-1) !== moment.phase) {
      seen.push(moment.phase);
      last = -1;
    }
    assert.ok(moment.progress >= last && moment.progress <= 1);
    last = moment.progress;
  }
  assert.deepEqual(seen, [...SEAM_PHASES]);
  assert.deepEqual(seamAt(PLAN, seamLength(PLAN) + 1), { phase: 'settle', progress: 1, left: 0 });
  assert.equal(seamAt(PLAN, PLAN.times.buildUp).phase, 'tear');
});

void test('only the tear, the mist and the tear back hide the world', (): void => {
  assert.deepEqual(SEAM_PHASES.filter(hidesWorld), ['tear', 'mist', 'tear_back']);
});
