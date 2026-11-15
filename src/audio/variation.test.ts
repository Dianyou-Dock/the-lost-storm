import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VariantBag } from './variation.ts';
import { createVariantBag, delayBetween, pickVariant, pitchRate, VARIATION, volumeScale } from './variation.ts';

const SEED: { readonly start: number; readonly step: number; readonly mask: number } = { start: 12345, step: 1664525, mask: 0x7fffffff };

function seeded(): () => number {
  let state: number = SEED.start;
  return (): number => {
    state = (Math.imul(state, SEED.step) + 1013904223) & SEED.mask;
    return state / (SEED.mask + 1);
  };
}

void test('a single variation is always chosen', (): void => {
  assert.equal(pickVariant(1, [], (): number => 0.9), 0);
  assert.equal(pickVariant(1, [0], (): number => 0.1), 0);
  assert.equal(createVariantBag(seeded()).next('one', 1), 0);
});

void test('two variations alternate and never repeat', (): void => {
  const bag: VariantBag = createVariantBag(seeded());
  let previous: number = bag.next('pair', 2);
  for (let step: number = 0; step < 200; step += 1) {
    const next: number = bag.next('pair', 2);
    assert.notEqual(next, previous);
    previous = next;
  }
});

void test('with three or more variations none comes twice within the last two plays', (): void => {
  for (let count: number = 3; count <= 8; count += 1) {
    const bag: VariantBag = createVariantBag(seeded());
    const plays: number[] = [];
    for (let step: number = 0; step < 500; step += 1) {
      const next: number = bag.next('many', count);
      assert.ok(next >= 0 && next < count);
      assert.ok(!plays.slice(-2).includes(next), `${count} variations repeated ${next} after ${plays.slice(-2).join(',')}`);
      plays.push(next);
    }
  }
});

void test('every variation comes up and each sound keeps its own history', (): void => {
  const bag: VariantBag = createVariantBag(seeded());
  const seen: Set<number> = new Set<number>();
  for (let step: number = 0; step < 200; step += 1) {
    seen.add(bag.next('a', 5));
    bag.next('b', 5);
  }
  assert.equal(seen.size, 5);
  const fresh: VariantBag = createVariantBag((): number => 0);
  assert.equal(fresh.next('x', 4), 0);
  assert.equal(fresh.next('y', 4), 0);
  assert.equal(fresh.next('x', 4), 1);
  assert.equal(fresh.next('x', 4), 2);
  assert.equal(fresh.next('x', 4), 0);
  assert.equal(fresh.next('x', 4), 1);
});

void test('a sound whose file count shrinks still picks inside the new count', (): void => {
  const bag: VariantBag = createVariantBag((): number => 0.99);
  assert.equal(bag.next('s', 6), 5);
  assert.equal(bag.next('s', 3), 2);
  assert.equal(bag.next('s', 3), 1);
});

void test('pitch and volume stay inside their spread and are centred on one', (): void => {
  assert.equal(pitchRate((): number => 0.5), 1);
  assert.equal(volumeScale((): number => 0.5), 1);
  const high: number = pitchRate((): number => 1);
  const low: number = pitchRate((): number => 0);
  assert.ok(Math.abs(high - 2 ** (VARIATION.pitchCents / VARIATION.centsPerOctave)) < 1e-9);
  assert.ok(Math.abs(low - 2 ** (-VARIATION.pitchCents / VARIATION.centsPerOctave)) < 1e-9);
  assert.ok(Math.abs(volumeScale((): number => 1) - (1 + VARIATION.volumeSpread)) < 1e-9);
  assert.ok(Math.abs(volumeScale((): number => 0) - (1 - VARIATION.volumeSpread)) < 1e-9);
});

void test('a delay falls between its bounds', (): void => {
  assert.equal(delayBetween(10, 30, (): number => 0), 10);
  assert.equal(delayBetween(10, 30, (): number => 0.5), 20);
  assert.equal(delayBetween(10, 30, (): number => 1), 30);
});
