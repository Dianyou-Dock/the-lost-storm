import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Camera, Object3D } from 'three';
import { Group, Mesh, PerspectiveCamera, PointLight, Scene } from 'three';
import type { Timers } from '../backend/backend.ts';
import type { ShaderCompiler } from './warm-up.ts';
import { revealHidden, warmUp, warmUpWithin } from './warm-up.ts';

interface Recorder extends ShaderCompiler {
  readonly seen: boolean[];
  finish(): void;
}

function recorder(standIn: Object3D): Recorder {
  const seen: boolean[] = [];
  const finishers: (() => void)[] = [];
  return {
    seen,
    finish: (): void => {
      for (const finish of finishers) finish();
    },
    compileAsync(scene: Object3D, _camera: Camera): Promise<Object3D> {
      let inScene: boolean = false;
      scene.traverse((object: Object3D): void => {
        if (object === standIn) inScene = true;
      });
      seen.push(inScene);
      return new Promise<Object3D>((resolve: (value: Object3D) => void): void => {
        finishers.push((): void => resolve(scene));
      });
    },
    drawOnce(): void {},
  };
}

interface ManualTimers {
  readonly timers: Timers;
  pending(): number;
  fire(): void;
}

function manualTimers(): ManualTimers {
  const tasks: (() => void)[] = [];
  return {
    timers: {
      after: (_ms: number, task: () => void): (() => void) => {
        tasks.push(task);
        return (): void => {
          const index: number = tasks.indexOf(task);
          if (index >= 0) tasks.splice(index, 1);
        };
      },
    },
    pending: (): number => tasks.length,
    fire: (): void => {
      for (const task of tasks.splice(0, tasks.length)) task();
    },
  };
}

function settle(): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setImmediate(resolve);
  });
}

function tracked(promise: Promise<void>): { settled(): boolean } {
  let done: boolean = false;
  void promise.finally((): void => {
    done = true;
  });
  return { settled: (): boolean => done };
}

void test('stand-ins are in the scene while their shaders are queued and gone from it afterwards', async (): Promise<void> => {
  const scene: Scene = new Scene();
  const standIn: Mesh = new Mesh();
  const compiler: Recorder = recorder(standIn);
  const done: Promise<void> = warmUp(compiler, scene, new PerspectiveCamera(), [standIn]);
  assert.deepEqual(compiler.seen, [true]);
  assert.equal(scene.children.length, 0);
  assert.equal(standIn.parent, null);
  compiler.finish();
  await done;
});

void test('a compiler that throws at once still ends the warm-up and leaves the scene clean', async (): Promise<void> => {
  const scene: Scene = new Scene();
  const standIn: Mesh = new Mesh();
  const throwing: ShaderCompiler = {
    compileAsync(_target: Object3D, _camera: Camera): Promise<Object3D> {
      throw new Error('no context');
    },
    drawOnce(): void {},
  };
  await warmUp(throwing, scene, new PerspectiveCamera(), [standIn]);
  assert.equal(scene.children.length, 0);
  assert.equal(standIn.parent, null);
});

void test('a warm-up that outlasts its wait holds the game only until the wait ends', async (): Promise<void> => {
  const compiler: Recorder = recorder(new Mesh());
  const clock: ManualTimers = manualTimers();
  const done: Promise<void> = warmUpWithin(compiler, new Scene(), new PerspectiveCamera(), [], clock.timers, 1);
  const watched: { settled(): boolean } = tracked(done);
  await settle();
  assert.equal(watched.settled(), false);
  assert.equal(clock.pending(), 1);
  clock.fire();
  await settle();
  assert.equal(watched.settled(), true);
  compiler.finish();
});

void test('a warm-up that finishes in time cancels its wait', async (): Promise<void> => {
  const compiler: Recorder = recorder(new Mesh());
  const clock: ManualTimers = manualTimers();
  const done: Promise<void> = warmUpWithin(compiler, new Scene(), new PerspectiveCamera(), [], clock.timers, 1);
  assert.equal(clock.pending(), 1);
  compiler.finish();
  await done;
  assert.equal(clock.pending(), 0);
});

void test('hidden meshes are compiled, then drawn once without culling, and are hidden and culled again afterwards', async (): Promise<void> => {
  const scene: Scene = new Scene();
  const later: Group = new Group();
  later.visible = false;
  const piece: Mesh = new Mesh();
  piece.visible = false;
  later.add(piece);
  scene.add(later);
  const compiledShown: boolean[] = [];
  const drawnShown: boolean[] = [];
  const seenBy = (target: Object3D, into: boolean[]): void => {
    let shown: boolean = false;
    target.traverseVisible((object: Object3D): void => {
      if (object === piece && !object.frustumCulled) shown = true;
    });
    into.push(shown);
  };
  const compiler: ShaderCompiler = {
    compileAsync(target: Object3D): Promise<Object3D> {
      let shown: boolean = false;
      target.traverseVisible((object: Object3D): void => {
        if (object === piece) shown = true;
      });
      compiledShown.push(shown);
      return Promise.resolve(target);
    },
    drawOnce(target: Object3D): void {
      seenBy(target, drawnShown);
    },
  };
  await warmUp(compiler, scene, new PerspectiveCamera(), []);
  assert.deepEqual(compiledShown, [true]);
  assert.deepEqual(drawnShown, [true]);
  assert.equal(later.visible, false);
  assert.equal(piece.visible, false);
  assert.equal(piece.frustumCulled, true);
});

void test('revealing hidden things for a warm-up never adds a light the frame would not have', (): void => {
  const scene: Scene = new Scene();
  const lit: PointLight = new PointLight();
  const off: PointLight = new PointLight();
  off.visible = false;
  const hiddenGroup: Group = new Group();
  hiddenGroup.visible = false;
  const tucked: PointLight = new PointLight();
  hiddenGroup.add(tucked);
  scene.add(lit, off, hiddenGroup);
  const restore: () => void = revealHidden(scene);
  const lights: Object3D[] = [];
  scene.traverseVisible((object: Object3D): void => {
    if (object instanceof PointLight) lights.push(object);
  });
  assert.deepEqual(lights, [lit]);
  assert.equal(hiddenGroup.visible, true);
  restore();
  assert.equal(lit.visible, true);
  assert.equal(off.visible, false);
  assert.equal(hiddenGroup.visible, false);
  assert.equal(tucked.visible, true);
});

void test('a warm-up told of things still loading warms again once they are in', async (): Promise<void> => {
  const scene: Scene = new Scene();
  const compiled: number[] = [];
  const compiler: ShaderCompiler = {
    compileAsync(target: Object3D): Promise<Object3D> {
      compiled.push(target.children.length);
      return Promise.resolve(target);
    },
    drawOnce(): void {},
  };
  const arrivals: (() => void)[] = [];
  const loading: Promise<void> = new Promise<void>((resolve: () => void): void => {
    arrivals.push(resolve);
  });
  await warmUp(compiler, scene, new PerspectiveCamera(), [], loading);
  assert.equal(compiled.length, 1);
  scene.add(new Mesh());
  for (const arrive of arrivals) arrive();
  await settle();
  assert.equal(compiled.length, 2);
});

void test('a stand-in that goes live while its shaders compile stays in the scene through the late draw and the later warm-up', async (): Promise<void> => {
  const scene: Scene = new Scene();
  const standIn: Mesh = new Mesh();
  const compiler: Recorder = recorder(standIn);
  const arrivals: (() => void)[] = [];
  const loading: Promise<void> = new Promise<void>((resolve: () => void): void => {
    arrivals.push(resolve);
  });
  const done: Promise<void> = warmUp(compiler, scene, new PerspectiveCamera(), [standIn], loading);
  assert.equal(standIn.parent, null);
  scene.add(standIn);
  compiler.finish();
  await done;
  assert.equal(standIn.parent, scene);
  for (const arrive of arrivals) arrive();
  await settle();
  compiler.finish();
  await settle();
  assert.deepEqual(compiler.seen, [true, true]);
  assert.equal(standIn.parent, scene);
});
