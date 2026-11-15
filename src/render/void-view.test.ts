import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shadeSize, VOID_VIEW } from './void-view.ts';

void test('the mist layers shade at half the size of the frame they are drawn into', (): void => {
  assert.equal(VOID_VIEW.shadeScale, 0.5);
  assert.equal(shadeSize(2160), 1080);
  assert.equal(shadeSize(1351), 676);
  assert.equal(shadeSize(1), 1);
});
