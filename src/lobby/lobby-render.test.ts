import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ditheredOutputPass } from '../render/output-dither.ts';
import { bloomOutputFragment, LOBBY_RENDER, lobbyPixelRatio } from './lobby-render.ts';

void test('the lobby draws at the device ratio up to 2 on desktop and 1.5 on mobile', (): void => {
  assert.equal(lobbyPixelRatio('desktop', 3), 2);
  assert.equal(lobbyPixelRatio('desktop', 2), 2);
  assert.equal(lobbyPixelRatio('desktop', 1), 1);
  assert.equal(lobbyPixelRatio('mobile', 3), 1.5);
  assert.equal(lobbyPixelRatio('mobile', 0), 1);
});

void test('every lobby tier keeps multisampling on', (): void => {
  assert.ok(LOBBY_RENDER.tiers.desktop.samples >= 4);
  assert.ok(LOBBY_RENDER.tiers.mobile.samples >= 4);
});

void test('the bloom is added to the scene inside the output pass, before tone mapping and the dither, so the scene target is not drawn a second time', (): void => {
  const fragment: string = bloomOutputFragment(ditheredOutputPass().material.fragmentShader);
  assert.match(fragment, /uniform sampler2D tBloom;/);
  const added: number = fragment.indexOf('gl_FragColor = texture2D( tDiffuse, vUv ) + texture2D( tBloom, vUv );');
  assert.ok(added > 0);
  assert.ok(added < fragment.indexOf('ToneMapping( gl_FragColor.rgb )'));
  assert.ok(added < fragment.indexOf('ditherOutput( gl_FragColor.rgb )'));
});

void test('an output shader with no scene read is refused instead of silently dropping the bloom', (): void => {
  assert.throws((): string => bloomOutputFragment('void main() { gl_FragColor = vec4(1.0); }'));
});
