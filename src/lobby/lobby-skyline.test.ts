import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { LOBBY_SKYLINE, skylineGeometry, stepHash } from './lobby-skyline.ts';
import { SKYLINE_KINDS } from './lobby-sets.ts';
import type { Skyline, SkylineKind } from './lobby-sets.ts';

function one(kind: SkylineKind, angle: number = 0): Skyline {
  return { radius: 30, sink: 2, pieces: [{ kind, angleDegrees: angle, width: 6, height: 8 }] };
}

void test('every skyline shape stands on the ring, sunk below the ground and as tall as its data asks', (): void => {
  for (const kind of SKYLINE_KINDS) {
    const geometry = skylineGeometry(one(kind));
    const position = geometry.getAttribute('position');
    assert.equal(position.count % 3, 0, kind);
    const box: Box3 = new Box3().setFromObject(new Mesh(geometry));
    assert.ok(Math.abs(box.min.y + 2) < 1e-6, `${kind} is not sunk`);
    assert.ok(Math.abs(box.max.y - 8) < 1e-6 || kind === 'broken', `${kind} top ${box.max.y}`);
    assert.ok(box.max.y <= 8 + 1e-6);
    const middle: Vector3 = box.getCenter(new Vector3());
    assert.ok(Math.abs(Math.hypot(middle.x, middle.z) - 30) < LOBBY_SKYLINE.maxDepth, `${kind} is off the ring`);
    assert.ok(middle.z < 0, `${kind} at angle 0 is not behind the hero`);
  }
});

void test('a skyline piece is placed by its angle around the hero, and the broken top is the same every time', (): void => {
  const box: Box3 = new Box3().setFromObject(new Mesh(skylineGeometry(one('block', 90))));
  const middle: Vector3 = box.getCenter(new Vector3());
  assert.ok(middle.x > 28 && Math.abs(middle.z) < 1e-6);
  assert.equal(stepHash(3, 40), stepHash(3, 40));
  assert.deepEqual(skylineGeometry(one('broken', 12)).getAttribute('position').array, skylineGeometry(one('broken', 12)).getAttribute('position').array);
});
