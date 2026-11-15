import type { Camera, Object3D, Scene } from 'three';
import { Group, Light } from 'three';
import { warnInConsole } from '../backend/console-log.ts';
import type { Timers } from '../backend/backend.ts';

export const WARM_UP = {
  zoneWaitMs: 2500,
} as const;

export interface ShaderCompiler {
  compileAsync(target: Object3D, viewer: Camera): Promise<Object3D>;
  drawOnce(target: Object3D, viewer: Camera): void;
}

export function revealHidden(root: Object3D): () => void {
  const lit: Set<Object3D> = new Set<Object3D>();
  root.traverseVisible((object: Object3D): void => {
    if (object instanceof Light) lit.add(object);
  });
  const shown: Object3D[] = [];
  root.traverse((object: Object3D): void => {
    if (object.visible) return;
    shown.push(object);
    object.visible = true;
  });
  const dark: Light[] = [];
  root.traverse((object: Object3D): void => {
    if (!(object instanceof Light) || lit.has(object) || !object.visible) return;
    dark.push(object);
    object.visible = false;
  });
  return (): void => {
    for (const light of dark) light.visible = true;
    for (const object of shown) object.visible = false;
  };
}

function staged<T>(scene: Scene, standIns: readonly Object3D[], culled: boolean, work: () => T): T {
  const holder: Group = new Group();
  const loose: Object3D[] = standIns.filter((standIn: Object3D): boolean => standIn.parent === null);
  for (const standIn of loose) holder.add(standIn);
  scene.add(holder);
  const restore: () => void = revealHidden(scene);
  const unculled: Object3D[] = [];
  if (!culled) {
    scene.traverse((object: Object3D): void => {
      if (!object.frustumCulled) return;
      unculled.push(object);
      object.frustumCulled = false;
    });
  }
  try {
    return work();
  } finally {
    for (const object of unculled) object.frustumCulled = true;
    restore();
    holder.removeFromParent();
    for (const standIn of loose) if (standIn.parent === holder) holder.remove(standIn);
  }
}

function drawEverything(compiler: ShaderCompiler, scene: Scene, camera: Camera, standIns: readonly Object3D[]): void {
  try {
    staged(scene, standIns, false, (): void => compiler.drawOnce(scene, camera));
  } catch (error: unknown) {
    warnInConsole(`Warming the scene by drawing it once failed: ${String(error)}`);
  }
}

export function warmUp(compiler: ShaderCompiler, scene: Scene, camera: Camera, standIns: readonly Object3D[], later: Promise<void> | null = null): Promise<void> {
  if (later !== null) void later.then((): Promise<void> => warmUp(compiler, scene, camera, standIns));
  let compiling: Promise<Object3D>;
  try {
    compiling = staged(scene, standIns, true, (): Promise<Object3D> => compiler.compileAsync(scene, camera));
  } catch {
    compiling = Promise.resolve(scene);
  }
  return compiling.then(
    (): void => drawEverything(compiler, scene, camera, standIns),
    (): void => undefined,
  );
}

export function warmUpWithin(compiler: ShaderCompiler, scene: Scene, camera: Camera, standIns: readonly Object3D[], timers: Timers, ms: number, later: Promise<void> | null = null): Promise<void> {
  const cancels: (() => void)[] = [];
  const waited: Promise<void> = new Promise<void>((resolve: () => void): void => {
    cancels.push(timers.after(ms, resolve));
  });
  const warmed: Promise<void> = warmUp(compiler, scene, camera, standIns, later).finally((): void => {
    for (const cancel of cancels) cancel();
  });
  return Promise.race([warmed, waited]);
}
