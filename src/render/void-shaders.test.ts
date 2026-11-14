import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIST_FRAGMENT, MIST_SKIP } from './void-shaders.ts';

void test('a mist layer skips its noise only where the land hides it whatever the noise says', (): void => {
  const body: number = MIST_SKIP.body * 2;
  assert.ok(MIST_FRAGMENT.includes(`(body - 0.5) * ${body.toFixed(1)}`));
  assert.match(MIST_FRAGMENT, /float ashore = dot\(q - uShore\.xy, uShore\.zw\) \+ \(voidFbm\(q \* 0\.09 \+ 3\.0\) - 0\.5\) \* uShoreLook\.z \+ \(body - 0\.5\) \* /);
  assert.match(MIST_FRAGMENT, /float land = uShoreLook\.y \* smoothstep\(uLand\.x, uLand\.y, ashore\);/);
  assert.match(MIST_FRAGMENT, /if \(uShoreLook\.y >= uLandGone\.x && dot\(q - uShore\.xy, uShore\.zw\) - uLandGone\.y >= uLand\.y\) discard;/);
  const main: string = MIST_FRAGMENT.slice(MIST_FRAGMENT.indexOf('void main()'));
  assert.ok(main.indexOf('discard;') < main.indexOf('voidFbm('));
});
