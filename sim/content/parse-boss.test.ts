import assert from 'node:assert/strict';
import { test } from 'node:test';
import { must } from '../../test/support.ts';
import type { BossDef } from './boss-types.ts';
import { boss, pieceStrikes } from './parse-boss.ts';

const BASE = {
  title: 'Timekeeper',
  poise: { knockback: 0.1 },
  drop: { items: 1, rarity: 'rare', goldMin: 1, goldMax: 2 },
  barks: { aggro: [], death: [] },
};

void test('a boss written the old way reads with no measure, no holders, no break and no yield', (): void => {
  const read: BossDef = must(boss({ ...BASE, phases: [{ below: 1, skills: [{ skill: 'a', weight: 1 }], barks: [] }] }, 'b'), 'boss');
  assert.deepEqual(read.phases[0], { below: 1, skills: [{ skill: 'a', weight: 1 }], barks: [], measure: [], beat: 0, holds: [], unseal: [], anchor: null });
  assert.equal(read.countBreak, null);
  assert.equal(read.yields, false);
});

void test('a phase may play a measure instead of weighted skills, held, unsealing and anchored', (): void => {
  const read: BossDef = must(boss(
    {
      ...BASE,
      phases: [
        { below: 1, measure: ['a', 'b'], beat: 1.5, holds: ['clock'], barks: [] },
        { below: 0.4, measure: ['c'], beat: 1.1, holds: ['book'], unseal: ['book'], anchor: { monster: 'book', radius: 5 }, barks: [] },
      ],
      countBreak: { stagger: 2.5, open: 5, damageTaken: 1.5 },
      yields: true,
    },
    'b',
    ),
    'boss',
  );
  assert.deepEqual(read.phases[1]?.anchor, { monster: 'book', radius: 5 });
  assert.deepEqual(read.phases[0]?.holds, ['clock']);
  assert.deepEqual(read.countBreak, { stagger: 2.5, open: 5, damageTaken: 1.5 });
  assert.equal(read.yields, true);
});

void test('a phase with neither skills nor a measure, or a negative beat, is refused', (): void => {
  assert.throws(() => boss({ ...BASE, phases: [{ below: 1, barks: [] }] }, 'b'), /skill or a measure/);
  assert.throws(() => boss({ ...BASE, phases: [{ below: 1, measure: ['a'], beat: -1, barks: [] }] }, 'b'), /zero or more/);
});

void test('strikes are a whole count of one or more and a gap above zero', (): void => {
  assert.deepEqual(pieceStrikes({ count: 8, gap: 4 }, 'p'), { count: 8, gap: 4 });
  assert.throws(() => pieceStrikes({ count: 2.5, gap: 4 }, 'p'), /whole number/);
  assert.throws(() => pieceStrikes({ count: 3, gap: 0 }, 'p'), /p\.gap/);
});
