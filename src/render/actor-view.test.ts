import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Material } from 'three';
import { AnimationClip, BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { must } from '../../test/support.ts';
import { loadContent } from '../../sim/content/content.ts';
import type { Content, RigDef } from '../../sim/content/types.ts';
import { HERO } from '../../sim/hero.ts';
import { stepStride } from '../../sim/world/player.ts';
import type { ActorView } from './actor-view.ts';
import { ACTOR, createActorView, easeIn, fallAt, liftAt } from './actor-view.ts';
import type { CharacterLibrary, GaitClip, LoadedRig, RigClipSet } from './character-loader.ts';
import { instantiateRig } from './character-loader.ts';

const content: Content = loadContent();

const SPEEDS: readonly number[] = [0.5, 1.2, 2.2, 2.8, 3, 3.4, 4.5, 7, 9, 6, 3.4, 3, 2.8, 2.2, 1.2, 0, 2.8, 3, 0.05, 3, 9, 0.5];

function heroView(def: RigDef): { readonly view: ActorView; readonly gaits: readonly GaitClip[]; readonly idle: AnimationClip } {
  const gaits: GaitClip[] = def.gaits.map((gait): GaitClip => ({ clip: new AnimationClip(gait.clip, 1, []), groundSpeed: gait.groundSpeed }));
  const idle: AnimationClip = new AnimationClip('idle', 1, []);
  const clips: RigClipSet = { idle, run: new AnimationClip('run', 1, []), gaits, hit: [], death: [], rise: null, actions: new Map(), unarmed: null, stances: new Map() };
  const loaded: LoadedRig = { def, template: new Group(), clips, bodyParts: [], bodyMasks: new Map(), fitted: new Map() };
  const library: CharacterLibrary = { rigs: new Map([[def.id, loaded]]), attachments: new Map(), wearables: new Map() };
  const view: ActorView = createActorView(instantiateRig(loaded, library, { tint: '#ffffff', glow: '#ffffff', ghost: null, feather: false }), HERO.size, 0);
  return { view, gaits, idle };
}

function playing(view: ActorView, clips: readonly AnimationClip[]): number {
  const weights: number[] = clips.map((clip: AnimationClip): number => {
    const action = view.rig.mixer.existingAction(clip);
    return action === null || !action.isRunning() ? 0 : action.getEffectiveWeight();
  });
  return weights.indexOf(Math.max(...weights));
}

for (const hero of content.player.heroes) {
  void test(`the ${hero.id} hero's step sounds are counted for the gait his view is playing, at every speed and through every change`, (): void => {
    const def: RigDef = must(content.rigs.get(hero.rig), hero.rig);
    const { view, gaits, idle } = heroView(def);
    const clips: readonly AnimationClip[] = [idle, ...gaits.map((gait: GaitClip): AnimationClip => gait.clip)];
    let held: number = -1;
    let stepping: number = 0;
    for (const speed of SPEEDS) {
      const counted = stepStride(def, speed, held);
      held = counted.gait;
      for (let frame: number = 0; frame < 60; frame += 1) {
        view.sync(1 / 30, { pos: { x: 0, z: 0 }, facing: 0, motion: speed > 0 ? 'stride' : 'still', gait: speed, knockTime: 0, busy: false, deadTime: 0 }, { rise: 1, floor: 0, turnRate: 10, seen: true });
      }
      const shown: number = playing(view, clips) - 1;
      if (counted.metres === null) {
        assert.equal(shown, -1, `at ${speed} m/s the view plays a gait but no step is counted`);
        continue;
      }
      stepping += 1;
      assert.equal(shown, counted.gait, `at ${speed} m/s the view plays gait ${shown} but steps are counted for gait ${counted.gait}`);
      assert.equal(counted.metres, must(def.gaits[counted.gait], 'gait').stride);
    }
    assert.ok(stepping > SPEEDS.length / 2);
  });
}

function creatureView(lift: number, withClips: boolean): { readonly view: ActorView; readonly walk: AnimationClip; readonly hit: AnimationClip; readonly body: Mesh; readonly def: RigDef } {
  const hero: RigDef = must(content.rigs.get(content.player.hero.rig), 'hero rig');
  const def: RigDef = { ...hero, id: 'creature', lift, gaits: [{ clip: 'Walk', groundSpeed: 1, stride: null }], clips: { ...hero.clips, hit: withClips ? ['Hit'] : [], death: withClips ? ['Death'] : [] } };
  const walk: AnimationClip = new AnimationClip('Walk', 1, []);
  const hit: AnimationClip = new AnimationClip('Hit', 1, []);
  const template: Group = new Group();
  template.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
  const clips: RigClipSet = { idle: new AnimationClip('Idle', 1, []), run: walk, gaits: [{ clip: walk, groundSpeed: 1 }], hit: withClips ? [hit] : [], death: withClips ? [new AnimationClip('Death', 1, [])] : [], rise: null, actions: new Map(), unarmed: null, stances: new Map() };
  const loaded: LoadedRig = { def, template, clips, bodyParts: [], bodyMasks: new Map(), fitted: new Map() };
  const library: CharacterLibrary = { rigs: new Map([[def.id, loaded]]), attachments: new Map(), wearables: new Map() };
  const view: ActorView = createActorView(instantiateRig(loaded, library, { tint: '#ffffff', glow: '#ffffff', ghost: null, feather: false }), 1, 0, ACTOR.hostileHover, (): number => 0);
  const stage: Group = new Group();
  stage.add(view.rig.root);
  let body: Mesh | undefined;
  view.rig.root.traverse((object): void => {
    if (object instanceof Mesh && body === undefined) body = object;
  });
  return { view, walk, hit, body: must(body, 'body mesh'), def };
}

function opacityOf(body: Mesh): number {
  const material: Material | Material[] = body.material;
  return Array.isArray(material) ? 1 : material.opacity;
}

const RUNNING = { pos: { x: 0, z: 0 }, facing: 0, motion: 'stride', gait: 1, knockTime: 0, busy: false, deadTime: 0 } as const;
const OPTIONS = { rise: 1, floor: 0, turnRate: 10, seen: true } as const;

void test('a creature with no hit clip keeps its stride when struck: the flash and the squash show the hit, not a jump to idle', (): void => {
  const { view, walk } = creatureView(0, false);
  for (let frame: number = 0; frame < 10; frame += 1) view.sync(1 / 30, RUNNING, OPTIONS);
  view.hit(new Color(0xffffff), 1, true);
  view.sync(1 / 30, RUNNING, OPTIONS);
  assert.equal(view.rig.mixer.existingAction(walk)?.isRunning(), true);
  const { view: clipped, hit } = creatureView(0, true);
  for (let frame: number = 0; frame < 10; frame += 1) clipped.sync(1 / 30, RUNNING, OPTIONS);
  clipped.hit(new Color(0xffffff), 1, true);
  assert.equal(clipped.rig.mixer.existingAction(hit)?.isRunning(), true);
});

void test('a creature with no death clip holds its last pose, then sinks and fades out, and comes back whole when pooled and revived', (): void => {
  const { view, body, def } = creatureView(0, false);
  view.sync(1 / 30, RUNNING, OPTIONS);
  view.die();
  view.sync(1 / 30, { ...RUNNING, motion: 'still', deadTime: ACTOR.fallTime / 2 }, OPTIONS);
  const halfway: number = view.rig.root.position.y;
  assert.ok(halfway < 0 && opacityOf(body) < 1 && opacityOf(body) > 0, `halfway at ${halfway} with opacity ${opacityOf(body)}`);
  view.sync(1 / 30, { ...RUNNING, motion: 'still', deadTime: ACTOR.fallTime }, OPTIONS);
  assert.ok(Math.abs(view.rig.root.position.y + ACTOR.fallDepth * def.height * def.scale) < 1e-9);
  assert.equal(opacityOf(body), 0);
  assert.equal(view.rig.root.parent?.children.find((child): boolean => child !== view.rig.root)?.visible, false);
  view.revive();
  assert.equal(opacityOf(body), 1);
});

void test('a lifted creature hovers its lift above the floor with a small bob, its shadow stays on the floor, and it drops when it dies', (): void => {
  const { view } = creatureView(1.5, true);
  for (let frame: number = 0; frame < 20; frame += 1) {
    view.sync(1 / 30, RUNNING, OPTIONS);
    assert.ok(Math.abs(view.rig.root.position.y - 1.5) <= ACTOR.bobHeight + 1e-9);
  }
  const shadow = view.rig.root.parent?.children.find((child): boolean => child !== view.rig.root);
  assert.ok(shadow !== undefined && shadow.position.y < 0.1);
  assert.equal(liftAt(1.5, 1, 0, 0), 1.5);
  assert.equal(liftAt(1.5, 1, ACTOR.dropTime, 0), 0);
  assert.equal(liftAt(0, 1, null, 3), 0);
  assert.equal(fallAt(0), 0);
  assert.equal(fallAt(ACTOR.fallTime * 2), 1);
  assert.equal(easeIn(0.5), 0.25);
});
