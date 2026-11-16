import type { Camera, Material, Object3D, Scene, WebGLRenderer } from 'three';
import { AdditiveBlending, BufferGeometry, Color, ConeGeometry, DataTexture, Euler, Group, InstancedMesh, LinearFilter, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, RGBAFormat, Vector3 } from 'three';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Content, PropDef } from '../../sim/content/types.ts';
import { loadModel } from '../render/character-loader.ts';
import { lookOf, withPropLook } from '../render/prop-surface.ts';
import type { PropLook } from '../render/prop-surface.ts';
import { dressedProp } from '../render/surfaces.ts';
import type { PropDressing } from '../render/surfaces.ts';
import { groundHeight } from './lobby-ground.ts';
import type { Mound } from './lobby-ground.ts';
import { stepSpring } from './lobby-orbit.ts';
import type { Spring } from './lobby-orbit.ts';
import type { Flash, Glow, LobbySet, Roost, SetPiece } from './lobby-sets.ts';
import { setMounds } from './lobby-sets.ts';
import { skylineGeometry } from './lobby-skyline.ts';

export const LOBBY_SCENERY = {
  wet: 0.12,
  swayHz: 0.21,
  roostSwayDegrees: 5,
  roostSwayHz: 0.27,
  roostColor: 0x15120f,
  roostWidth: 0.4,
  roostSides: 5,
  glowTexture: 64,
  skylineColor: 0x05070b,
  presence: { freq: 0.45, damping: 1 },
  solidAt: 0.999,
  flash: { rise: 0.05, fall: 0.42, echoAfter: 0.16, echo: 0.6 },
} as const;

const DEGREES: number = Math.PI / 180;

export function pieceSeat(piece: SetPiece, mounds: readonly Mound[]): number {
  return groundHeight(piece.x, piece.z, mounds) - piece.sink + piece.y;
}

export function pieceMatrix(piece: SetPiece, scale: number, mounds: readonly Mound[], swayRadians: number): Matrix4 {
  const turn: Quaternion = new Quaternion().setFromEuler(new Euler(piece.pitchDegrees * DEGREES, piece.yawDegrees * DEGREES + swayRadians, piece.rollDegrees * DEGREES, 'YXZ'));
  return new Matrix4().compose(new Vector3(piece.x, pieceSeat(piece, mounds), piece.z), turn, new Vector3().setScalar(scale * piece.size));
}

export function swayAngle(piece: SetPiece, seconds: number, index: number): number {
  return Math.sin(seconds * LOBBY_SCENERY.swayHz * Math.PI * 2 + index * 1.7) * piece.swayDegrees * DEGREES;
}

export interface FlashState {
  wait: number;
  since: number;
}

export function strikeShape(since: number): number {
  const spec = LOBBY_SCENERY.flash;
  const pulse = (age: number): number => (age < 0 ? 0 : age < spec.rise ? age / spec.rise : Math.exp(-(age - spec.rise) / spec.fall));
  return Math.min(1, pulse(since) + spec.echo * pulse(since - spec.echoAfter));
}

export function stepFlash(state: FlashState, flash: Flash, dt: number, random: () => number): number {
  state.since += dt;
  state.wait -= dt;
  if (state.wait <= 0) {
    state.since = 0;
    state.wait = flash.everyMin + (flash.everyMax - flash.everyMin) * random();
  }
  return strikeShape(state.since) * flash.strength;
}

export function featherShare(radius: number): number {
  const inside: number = Math.max(0, 1 - radius * radius);
  return inside * inside;
}

function featherTexture(): DataTexture {
  const size: number = LOBBY_SCENERY.glowTexture;
  const data: Uint8Array = new Uint8Array(size * size * 4);
  for (let y: number = 0; y < size; y += 1) {
    for (let x: number = 0; x < size; x += 1) {
      const value: number = Math.round(featherShare(Math.hypot(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1)) * 255);
      data.fill(value, (y * size + x) * 4, (y * size + x) * 4 + 3);
      data[(y * size + x) * 4 + 3] = 255;
    }
  }
  const texture: DataTexture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

interface Fading {
  readonly material: MeshStandardMaterial | MeshBasicMaterial;
  readonly base: number;
  readonly keepsBlend: boolean;
}

interface Swaying {
  readonly mesh: InstancedMesh;
  readonly object: Matrix4;
  readonly piece: SetPiece;
  readonly scale: number;
  readonly slot: number;
  readonly index: number;
}

export interface SetDressing {
  load(renderer: WebGLRenderer, scene: Scene, camera: Camera): Promise<void>;
  step(dt: number, camera: Camera): number;
}

function ownMaterial(content: Content, set: LobbySet, def: PropDef, material: MeshStandardMaterial, ground: number): MeshStandardMaterial | null {
  const dress: Readonly<Record<string, string>> = set.stone === null ? def.surfaces : { [material.name]: set.stone };
  const dressing: PropDressing = { wet: LOBBY_SCENERY.wet, ground };
  const made: Material = dressedProp(content, dress, material, dressing);
  if (!(made instanceof MeshStandardMaterial)) return null;
  const look: PropLook | undefined = lookOf(made);
  const own: MeshStandardMaterial = look === undefined ? made.clone() : withPropLook(made.clone(), look);
  own.color.multiplyScalar(set.shade);
  if (def.tint !== null) own.color.multiply(new Color(def.tint));
  return own;
}

function isGeometry(value: unknown): value is BufferGeometry {
  return value instanceof BufferGeometry;
}

type RoostMesh = InstancedMesh<ConeGeometry, MeshStandardMaterial>;
type GlowMesh = InstancedMesh<PlaneGeometry, MeshBasicMaterial>;

function roostMesh(roosts: readonly Roost[]): RoostMesh {
  const geometry: ConeGeometry = new ConeGeometry(LOBBY_SCENERY.roostWidth / 2, 1, LOBBY_SCENERY.roostSides);
  geometry.rotateX(Math.PI);
  geometry.translate(0, -0.5, 0);
  const material: MeshStandardMaterial = new MeshStandardMaterial({ color: LOBBY_SCENERY.roostColor, roughness: 1 });
  return new InstancedMesh<ConeGeometry, MeshStandardMaterial>(geometry, material, roosts.length);
}

function glowMesh(glows: readonly Glow[]): GlowMesh {
  const material: MeshBasicMaterial = new MeshBasicMaterial({ alphaMap: featherTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
  const mesh: GlowMesh = new InstancedMesh<PlaneGeometry, MeshBasicMaterial>(new PlaneGeometry(1, 1), material, glows.length);
  glows.forEach((glow: Glow, index: number): void => {
    mesh.setColorAt(index, new Color(glow.color).multiplyScalar(glow.strength));
  });
  mesh.frustumCulled = false;
  return mesh;
}

export function createSetDressing(set: LobbySet, content: Content, loader: GLTFLoader, random: () => number = Math.random): SetDressing {
  const mounds: readonly Mound[] = setMounds(set);
  const group: Group = new Group();
  const fading: Fading[] = [];
  const swaying: Swaying[] = [];
  const presence: Spring = { x: 0, v: 0 };
  const flashState: FlashState = { wait: set.flash === null ? 0 : set.flash.everyMin * random(), since: Number.POSITIVE_INFINITY };
  let shown: boolean = false;
  let solid: boolean = false;
  let seconds: number = 0;
  let roosts: RoostMesh | null = null;
  let glows: GlowMesh | null = null;
  const toFade = (material: MeshStandardMaterial | MeshBasicMaterial, keepsBlend: boolean): void => {
    fading.push({ material, base: material.opacity, keepsBlend });
    material.transparent = true;
    material.opacity = 0;
  };

  const placeProp = (def: PropDef, gltf: GLTF, pieces: readonly SetPiece[]): void => {
    const ground: number = pieces.reduce((sum: number, piece: SetPiece): number => sum + groundHeight(piece.x, piece.z, mounds), 0) / pieces.length;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((object: Object3D): void => {
      if (!(object instanceof Mesh)) return;
      const geometry: unknown = object.geometry;
      const material: unknown = object.material;
      if (!(material instanceof MeshStandardMaterial) || !isGeometry(geometry)) return;
      const own: MeshStandardMaterial | null = ownMaterial(content, set, def, material, ground);
      if (own === null) return;
      toFade(own, false);
      const mesh: InstancedMesh = new InstancedMesh(geometry, own, pieces.length);
      mesh.castShadow = set.shadows;
      mesh.receiveShadow = set.shadows;
      const local: Matrix4 = object.matrixWorld.clone();
      pieces.forEach((piece: SetPiece, slot: number): void => {
        mesh.setMatrixAt(slot, new Matrix4().multiplyMatrices(pieceMatrix(piece, def.scale, mounds, 0), local));
        if (piece.swayDegrees > 0) swaying.push({ mesh, object: local, piece, scale: def.scale, slot, index: swaying.length });
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    });
  };

  const build = async (): Promise<void> => {
    const byProp: Map<string, SetPiece[]> = new Map<string, SetPiece[]>();
    for (const piece of set.pieces) byProp.set(piece.prop, [...(byProp.get(piece.prop) ?? []), piece]);
    await Promise.all(
      [...byProp.entries()].map(async ([id, pieces]: [string, SetPiece[]]): Promise<void> => {
        const def: PropDef | undefined = content.props.get(id);
        if (def === undefined) return;
        const gltf: GLTF | null = await loadModel(loader, def.model).catch((): null => null);
        if (gltf !== null) placeProp(def, gltf, pieces);
      }),
    );
    if (set.skyline !== null) {
      const material: MeshBasicMaterial = new MeshBasicMaterial({ color: LOBBY_SCENERY.skylineColor });
      toFade(material, false);
      group.add(new Mesh(skylineGeometry(set.skyline), material));
    }
    if (set.roosts.length > 0) {
      const hanging: RoostMesh = roostMesh(set.roosts);
      toFade(hanging.material, false);
      group.add(hanging);
      roosts = hanging;
    }
    if (set.glows.length > 0) {
      const lit: GlowMesh = glowMesh(set.glows);
      toFade(lit.material, true);
      group.add(lit);
      glows = lit;
    }
  };

  const at: Matrix4 = new Matrix4();
  const facing: Quaternion = new Quaternion();
  const point: Vector3 = new Vector3();
  const size: Vector3 = new Vector3();

  return {
    async load(renderer: WebGLRenderer, scene: Scene, camera: Camera): Promise<void> {
      await build();
      await renderer.compileAsync(group, camera, scene);
      scene.add(group);
      shown = true;
    },
    step(dt: number, camera: Camera): number {
      seconds += dt;
      if (shown && !solid) {
        const amount: number = Math.min(1, Math.max(0, stepSpring(presence, 1, LOBBY_SCENERY.presence.freq, LOBBY_SCENERY.presence.damping, dt)));
        solid = amount >= LOBBY_SCENERY.solidAt;
        for (const entry of fading) {
          entry.material.opacity = entry.base * (solid ? 1 : amount);
          if (solid && !entry.keepsBlend) entry.material.transparent = false;
        }
      }
      for (const sway of swaying) {
        sway.mesh.setMatrixAt(sway.slot, at.multiplyMatrices(pieceMatrix(sway.piece, sway.scale, mounds, swayAngle(sway.piece, seconds, sway.index)), sway.object));
        sway.mesh.instanceMatrix.needsUpdate = true;
      }
      const hanging: RoostMesh | null = roosts;
      if (hanging !== null) {
        set.roosts.forEach((roost: Roost, index: number): void => {
          const swing: number = Math.sin(seconds * LOBBY_SCENERY.roostSwayHz * Math.PI * 2 + index * 2.3) * LOBBY_SCENERY.roostSwayDegrees * DEGREES;
          hanging.setMatrixAt(index, at.compose(point.set(roost.x, roost.y, roost.z), facing.setFromEuler(new Euler(0, index, swing)), size.setScalar(roost.size)));
        });
        hanging.instanceMatrix.needsUpdate = true;
      }
      const lit: GlowMesh | null = glows;
      if (lit !== null) {
        set.glows.forEach((glow: Glow, index: number): void => {
          lit.setMatrixAt(index, at.compose(point.set(glow.x, glow.y, glow.z), camera.quaternion, size.setScalar(glow.size)));
        });
        lit.instanceMatrix.needsUpdate = true;
      }
      return set.flash === null ? 0 : stepFlash(flashState, set.flash, dt, random);
    },
  };
}
