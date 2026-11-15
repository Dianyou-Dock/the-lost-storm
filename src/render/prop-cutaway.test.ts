import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, ShaderLib, Vector2, Vector3 } from 'three';
import type { CutHero, CutSpring } from './prop-cutaway.ts';
import { aimCutaway, claimCutaway, clickThrough, CUTAWAY, CUTAWAY_UNIFORMS, cutawayChunk, cutawayCompany, frontWeight, ghostKeep, heroBehind, highWeight, isTall, patchCutawayShader, radiusFor, resetCutaway, ringWeight, setCutawayCompany, setOccluders, setTerrainSight, springCut, throughWindow, windowMetres, withCutaway } from './prop-cutaway.ts';
import type { TerrainSight } from './terrain-sight.ts';

function rock(x: number, z: number, height: number, floor: number = 0): Mesh {
  const mesh: Mesh = new Mesh(new BoxGeometry(2, height, 2), new MeshStandardMaterial());
  mesh.position.set(x, floor + height / 2, z);
  mesh.updateMatrixWorld(true);
  return mesh;
}

const EYE: Vector3 = new Vector3(20, 21, 20);

function cutLevel(): number {
  return CUTAWAY_UNIFORMS.uCutLevel.value;
}

void test('a prop material is set up for the cutaway once and stays opaque, so it sorts by depth with the hero', (): void => {
  const material: MeshStandardMaterial = new MeshStandardMaterial();
  const key: string = material.customProgramCacheKey();
  assert.equal(withCutaway(material), material);
  assert.equal(material.transparent, false);
  const once: string = material.customProgramCacheKey();
  assert.notEqual(once, key);
  withCutaway(material);
  assert.equal(material.customProgramCacheKey(), once);
  const basic: MeshBasicMaterial = new MeshBasicMaterial();
  assert.equal(withCutaway(basic), basic);
  assert.equal(basic.customProgramCacheKey(), new MeshBasicMaterial().customProgramCacheKey());
});

void test('the cutaway opens a dithered window in the real standard shader, only in front of the hero and only as far as the spring has opened it', (): void => {
  const shader: { fragmentShader: string; uniforms: Record<string, { value: unknown }> } = { fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} };
  patchCutawayShader(shader);
  assert.match(shader.fragmentShader, /uniform vec2 uCutCentre;/);
  assert.match(shader.fragmentShader, /uniform float uCutLevel;/);
  assert.ok(shader.fragmentShader.indexOf('discard;') > shader.fragmentShader.indexOf('#include <dithering_fragment>'));
  assert.doesNotMatch(shader.fragmentShader, /gl_FragColor\.a \*=/);
  assert.match(shader.fragmentShader, /vViewPosition\.z/);
  assert.equal(shader.uniforms['uCutLevel'], CUTAWAY_UNIFORMS.uCutLevel);
});

void test('only a prop that can hide his head and chest is tall enough to cut away', (): void => {
  assert.equal(isTall(0.47), false);
  assert.equal(isTall(1.2), false);
  assert.equal(isTall(2.42), true);
  assert.equal(isTall(5.28), true);
});

void test('he is behind a rock only where it rises between his chest or head and the camera, never behind a low one, one at his back, or a hidden one', (): void => {
  const hero: CutHero = { x: 0, z: 0, floor: 0 };
  assert.equal(heroBehind(hero, EYE, [rock(1.5, 1.5, 3.4)]), true);
  assert.equal(heroBehind(hero, EYE, [rock(1.5, 1.5, 1)]), false);
  assert.equal(heroBehind(hero, EYE, [rock(-1.5, -1.5, 5)]), false);
  assert.equal(heroBehind(hero, EYE, []), false);
  const hidden: Mesh = rock(1.5, 1.5, 3.4);
  const holder: Group = new Group();
  holder.add(hidden);
  holder.visible = false;
  assert.equal(heroBehind(hero, EYE, [hidden]), false);
});

void test('on a raised terrace he is behind a rock standing on that terrace, a low rock there never hides him, and a probe from the zone floor would miss it', (): void => {
  const floor: number = 24;
  const eye: Vector3 = new Vector3(20, floor + 21, 20);
  const high: CutHero = { x: 0, z: 0, floor };
  assert.equal(heroBehind(high, eye, [rock(1.5, 1.5, 3.4, floor)]), true);
  assert.equal(heroBehind(high, eye, [rock(1.5, 1.5, 1, floor)]), false);
  assert.equal(heroBehind({ ...high, floor: 0 }, eye, [rock(1.5, 1.5, 3.4, floor)]), false);
});

void test('the window eases open on the spring and closes back to nothing', (): void => {
  let state: CutSpring = { level: 0, velocity: 0 };
  const opened: number[] = [];
  for (let frame: number = 0; frame < 60; frame += 1) {
    state = springCut(state, 1, 1 / 60);
    opened.push(state.level);
  }
  assert.ok((opened[0] ?? 1) < 0.1);
  assert.ok(opened.every((level: number, index: number): boolean => index === 0 || level >= (opened[index - 1] ?? 0) - 1e-9));
  assert.ok(state.level > 0.95);
  for (let frame: number = 0; frame < 120; frame += 1) state = springCut(state, 0, 1 / 60);
  assert.equal(state.level, 0);
});

void test('aiming at a hero in the middle of the view puts the cutaway in the middle of the screen at his depth, closed while nothing hides him', (): void => {
  setOccluders([]);
  const camera: PerspectiveCamera = new PerspectiveCamera(30, 2, 1, 220);
  camera.position.set(20, 20 + CUTAWAY.heroHeight, 20);
  camera.lookAt(0, CUTAWAY.heroHeight, 0);
  aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.ok(Math.abs(CUTAWAY_UNIFORMS.uCutCentre.value.x - 800) < 0.5);
  assert.ok(Math.abs(CUTAWAY_UNIFORMS.uCutCentre.value.y - 400) < 0.5);
  assert.ok(Math.abs(CUTAWAY_UNIFORMS.uCutDepth.value - Math.hypot(20, 20, 20)) < 1e-6);
  assert.equal(CUTAWAY_UNIFORMS.uCutRadius.value, CUTAWAY.radius * 800);
  assert.equal(cutLevel(), 0);
  setOccluders([rock(1.5, 1.5, 3.4)]);
  for (let frame: number = 0; frame < 30; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.ok(cutLevel() > 0.5);
  setOccluders([]);
});

void test('the window centres on a hero standing on a raised terrace and the waist is measured from his floor', (): void => {
  setOccluders([]);
  const floor: number = 30;
  const camera: PerspectiveCamera = new PerspectiveCamera(30, 2, 1, 220);
  camera.position.set(20, floor + 20 + CUTAWAY.heroHeight, 20);
  camera.lookAt(0, floor + CUTAWAY.heroHeight, 0);
  aimCutaway(camera, { x: 0, z: 0, floor }, 1600, 800, 1 / 60);
  assert.ok(Math.abs(CUTAWAY_UNIFORMS.uCutCentre.value.y - 400) < 0.5);
  assert.equal(CUTAWAY_UNIFORMS.uCutFloor.value, floor);
  assert.match(cutawayChunk(), /\.y - uCutFloor \)/);
  aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
});

void test('a prop narrower than the window has its remaining edge dimmed as a ghost, and a wide prop keeps its own colour', (): void => {
  assert.equal(ghostKeep(1.6, 3), CUTAWAY.ghost);
  assert.equal(ghostKeep(6, 3), 0);
  assert.equal(ghostKeep(Infinity, 3), 0);
  const camera: PerspectiveCamera = new PerspectiveCamera(30, 2, 1, 220);
  assert.ok(Math.abs(windowMetres(camera, 20) - (4 * CUTAWAY.radius * 20 * Math.tan(Math.PI / 12)) / CUTAWAY.narrow) < 1e-9);
  const shader: { fragmentShader: string; uniforms: Record<string, { value: unknown }> } = { fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} };
  const keep = { value: 0.2 };
  patchCutawayShader(shader, keep);
  assert.equal(shader.uniforms['uCutKeep'], keep);
  assert.match(shader.fragmentShader, /uniform float uCutKeep;/);
});

void test('the ghosted remainder of a cut prop is dimmed and capped, so wet highlights on it never sparkle over the hero', (): void => {
  const chunk: string = cutawayChunk();
  assert.match(chunk, /min\( gl_FragColor\.rgb, vec3\( /);
  assert.match(chunk, /cutWeight \* step\( 0\.0001, uCutKeep \)/);
});

function sightBlocking(blocked: boolean): TerrainSight {
  return { drawnHeight: (): number => 0, blocks: (): boolean => blocked };
}

void test('rock terrain between the hero and the camera opens the same sprung window as a tall prop, and a zone change forgets it', (): void => {
  setOccluders([]);
  const camera: PerspectiveCamera = new PerspectiveCamera(30, 2, 1, 220);
  camera.position.set(20, 21, 20);
  camera.lookAt(0, 1, 0);
  setTerrainSight(sightBlocking(false));
  for (let frame: number = 0; frame < 120; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.equal(cutLevel(), 0);
  setTerrainSight(sightBlocking(true));
  aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.ok(cutLevel() > 0 && cutLevel() < 0.5);
  for (let frame: number = 0; frame < 30; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.ok(cutLevel() > 0.9);
  resetCutaway();
  for (let frame: number = 0; frame < 120; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.equal(cutLevel(), 0);
});

void test('the cut weights match the shader: full in front of the hero, none at or behind him, none at his waist, none outside the window', (): void => {
  assert.equal(frontWeight(20, 20 - CUTAWAY.margin - CUTAWAY.depthFeather - 0.1), 1);
  assert.equal(frontWeight(20, 20), 0);
  assert.equal(highWeight(CUTAWAY.waist - 0.1), 0);
  assert.equal(highWeight(CUTAWAY.waist + CUTAWAY.waistFeather + 0.1), 1);
  assert.equal(ringWeight(0, 0), 1);
  assert.equal(ringWeight(0, CUTAWAY.radius * 1.1), 0);
  assert.match(cutawayChunk(), /smoothstep\( uCutDepth - 1\.800, uCutDepth - 0\.600, vViewPosition\.z \)/);
});

void test('a zone rebuilt before the old view is disposed keeps its own cutaway, because the old view can only reset what it claimed', (): void => {
  const camera: PerspectiveCamera = new PerspectiveCamera(30, 2, 1, 220);
  camera.position.set(20, 21, 20);
  camera.lookAt(0, 1, 0);
  const old: symbol = claimCutaway([], sightBlocking(false));
  claimCutaway([], sightBlocking(true));
  resetCutaway(old);
  for (let frame: number = 0; frame < 30; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.ok(cutLevel() > 0.9);
  resetCutaway();
  for (let frame: number = 0; frame < 120; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.equal(cutLevel(), 0);
});

void test('a click passes the rock only inside an open window, in front of the hero and above his waist', (): void => {
  const camera: PerspectiveCamera = new PerspectiveCamera(30, 2, 1, 220);
  camera.position.set(20, 21, 20);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  const depth: number = -new Vector3(0, CUTAWAY.heroHeight, 0).applyMatrix4(camera.matrixWorldInverse).z;
  const view = { level: 1, depth, floor: 0, across: 0, up: 0, radius: CUTAWAY.radius, inverse: camera.matrixWorldInverse };
  const pass = throughWindow(view);
  assert.ok(pass !== null);
  assert.equal(pass(8, 8, 8), true);
  assert.equal(pass(8, 0.5, 8), false);
  assert.equal(pass(-3, 3, -3), false);
  assert.equal(throughWindow({ ...view, level: 0.2 }), null);
  assert.equal(throughWindow({ ...view, across: CUTAWAY.radius * 2 }), null);
  resetCutaway();
  for (let frame: number = 0; frame < 120; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  assert.equal(clickThrough(new Vector2(0, 0)), null);
  claimCutaway([], sightBlocking(true));
  for (let frame: number = 0; frame < 60; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, 1600, 800, 1 / 60);
  const centre: Vector3 = new Vector3(0, CUTAWAY.heroHeight, 0).project(camera);
  assert.ok(clickThrough(new Vector2(centre.x, centre.y)) !== null);
  assert.equal(clickThrough(new Vector2(centre.x + 0.9, centre.y)), null);
  resetCutaway();
});

void test('the window edge is a noise-broken line with a one-pixel ordered step, never scattered random dither', (): void => {
  const chunk: string = cutawayChunk();
  assert.doesNotMatch(chunk, /1664525u|cutDither|43758/);
  assert.match(chunk, /vec2 cutSpot = \( gl_FragCoord\.xy - uCutCentre \) \/ uCutRadius/);
  assert.match(chunk, /\* \( 1\.0 \+ \( cutOutline\( cutSpot \) - 0\.5 \)/);
  assert.match(chunk, /\( float\( cutOrder \) \+ 0\.5 \) \/ 16\.0/);
  assert.ok(CUTAWAY.open - CUTAWAY.noiseDepth / 2 - CUTAWAY.soft >= 0);
  assert.ok(CUTAWAY.cleared >= CUTAWAY.open + CUTAWAY.noiseDepth / 2 + CUTAWAY.band / 2);
});

void test('only living enemies within the company reach of the hero are counted, each on its own floor', (): void => {
  const hero: CutHero = { x: 0, z: 0, floor: 0 };
  const company: CutHero[] = cutawayCompany(hero, [
    { pos: { x: 3, z: 1 }, alive: true },
    { pos: { x: 3, z: 1 }, alive: false },
    { pos: { x: CUTAWAY.company + 0.5, z: 0 }, alive: true },
  ], (x: number): number => x);
  assert.deepEqual(company, [{ x: 3, z: 1, floor: 3 }]);
});

void test('a hidden enemy beside a hidden hero springs the window wide enough to clear him, and it springs back when he is gone', (): void => {
  const camera: PerspectiveCamera = new PerspectiveCamera(30, 16 / 9, 1, 220);
  camera.position.set(20, 21, 20);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  const height: number = 720;
  const width: number = 1280;
  const base: number = CUTAWAY.radius * height;
  const enemy: CutHero = { x: 2.8, z: -2.8, floor: 0 };
  claimCutaway([], sightBlocking(true));
  setCutawayCompany([enemy]);
  aimCutaway(camera, { x: 0, z: 0, floor: 0 }, width, height, 1 / 60);
  const first: number = CUTAWAY_UNIFORMS.uCutRadius.value;
  assert.ok(first > base && first < base * 1.2);
  for (let frame: number = 0; frame < 120; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, width, height, 1 / 60);
  const open: number = CUTAWAY_UNIFORMS.uCutRadius.value / height;
  assert.ok(open > CUTAWAY.radius * 2);
  const hero: Vector3 = new Vector3(0, CUTAWAY.heroHeight, 0).project(camera);
  const seen: Vector3 = new Vector3(enemy.x, CUTAWAY.heroHeight, enemy.z).project(camera);
  const across: number = ((seen.x - hero.x) / 2) * (width / height);
  const up: number = (seen.y - hero.y) / 2;
  assert.ok(ringWeight(across, up, open) >= CUTAWAY.cleared);
  assert.ok(Math.abs(radiusFor(across, up) - open) < 0.01);
  setCutawayCompany([]);
  for (let frame: number = 0; frame < 120; frame += 1) aimCutaway(camera, { x: 0, z: 0, floor: 0 }, width, height, 1 / 60);
  assert.ok(Math.abs(CUTAWAY_UNIFORMS.uCutRadius.value - base) < 1);
  assert.ok(radiusFor(10, 10) === CUTAWAY.widest);
  resetCutaway();
});
