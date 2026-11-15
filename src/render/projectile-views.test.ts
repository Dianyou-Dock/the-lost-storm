import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BoltShape } from './projectile-views.ts';
import { boltShape, PROJECTILE_VIEWS } from './projectile-views.ts';

void test('a bright shot is drawn full size and full glow, a dim one slimmer, shorter and dimmer', (): void => {
  assert.deepEqual(boltShape('bolt', 1), { glow: 1, girth: 1, length: 1 });
  assert.deepEqual(boltShape('bolt', 3), boltShape('bolt', 1));
  const dim: BoltShape = boltShape('bolt', 0);
  assert.deepEqual(dim, { glow: PROJECTILE_VIEWS.dimFrom, girth: PROJECTILE_VIEWS.slimFrom, length: PROJECTILE_VIEWS.shortFrom });
  const half: BoltShape = boltShape('bolt', 0.5);
  assert.ok(half.girth > dim.girth && half.girth < 1);
});

void test('an orb shrinks evenly in every direction', (): void => {
  const orb: BoltShape = boltShape('orb', 0.2);
  assert.equal(orb.length, orb.girth);
  assert.ok(orb.girth < 1);
});
