import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unsafeGlsl } from '../../test/glsl-support.ts';
import { SEAM_FRAGMENT, SEAM_PASS, SEAM_VERTEX } from './seam-pass.ts';

void test('the seam shader is safe, white comes in through bands that do not move, and every band reaches white', (): void => {
  for (const source of [SEAM_VERTEX, SEAM_FRAGMENT]) assert.deepEqual(unsafeGlsl(source), []);
  assert.match(SEAM_FRAGMENT, /float whiteBand = floor\(uv\.y \* [\d.]+ \+ hash11\(uSeed\)/);
  assert.ok(SEAM_PASS.whiteSpread + SEAM_PASS.whiteSoft <= 1);
});
