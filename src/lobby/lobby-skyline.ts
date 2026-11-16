import { BufferAttribute, BufferGeometry } from 'three';
import type { Skyline, SkylinePiece } from './lobby-sets.ts';

export const LOBBY_SKYLINE = {
  depthShare: 0.35,
  maxDepth: 3,
  towerBody: 0.82,
  gableBody: 0.68,
  brokenSteps: 6,
  brokenLow: 0.55,
  wallBody: 0.86,
  merlons: 11,
} as const;

type Corner = readonly [number, number, number];

interface Builder {
  readonly points: number[];
  triangle(a: Corner, b: Corner, c: Corner): void;
  quad(a: Corner, b: Corner, c: Corner, d: Corner): void;
}

function builder(): Builder {
  const points: number[] = [];
  const triangle = (a: Corner, b: Corner, c: Corner): void => {
    points.push(...a, ...b, ...c);
  };
  return {
    points,
    triangle,
    quad(a: Corner, b: Corner, c: Corner, d: Corner): void {
      triangle(a, b, c);
      triangle(a, c, d);
    },
  };
}

export function stepHash(index: number, seed: number): number {
  const mixed: number = Math.sin(index * 91.7 + seed * 12.9898) * 43758.5453;
  return mixed - Math.floor(mixed);
}

function box(out: Builder, left: number, right: number, bottom: number, top: number, depth: number): void {
  const near: number = depth / 2;
  const far: number = -depth / 2;
  out.quad([left, bottom, near], [right, bottom, near], [right, top, near], [left, top, near]);
  out.quad([right, bottom, far], [left, bottom, far], [left, top, far], [right, top, far]);
  out.quad([left, bottom, far], [left, bottom, near], [left, top, near], [left, top, far]);
  out.quad([right, bottom, near], [right, bottom, far], [right, top, far], [right, top, near]);
  out.quad([left, top, near], [right, top, near], [right, top, far], [left, top, far]);
}

function pyramid(out: Builder, left: number, right: number, bottom: number, top: number, depth: number): void {
  const near: number = depth / 2;
  const far: number = -depth / 2;
  const apex: Corner = [(left + right) / 2, top, 0];
  out.triangle([left, bottom, near], [right, bottom, near], apex);
  out.triangle([right, bottom, far], [left, bottom, far], apex);
  out.triangle([left, bottom, far], [left, bottom, near], apex);
  out.triangle([right, bottom, near], [right, bottom, far], apex);
}

function prism(out: Builder, left: number, right: number, bottom: number, top: number, depth: number): void {
  const near: number = depth / 2;
  const far: number = -depth / 2;
  const middle: number = (left + right) / 2;
  out.triangle([left, bottom, near], [right, bottom, near], [middle, top, near]);
  out.triangle([right, bottom, far], [left, bottom, far], [middle, top, far]);
  out.quad([left, bottom, far], [left, bottom, near], [middle, top, near], [middle, top, far]);
  out.quad([right, bottom, near], [right, bottom, far], [middle, top, far], [middle, top, near]);
}

export function pieceDepth(piece: SkylinePiece): number {
  return Math.min(LOBBY_SKYLINE.maxDepth, piece.width * LOBBY_SKYLINE.depthShare);
}

export function shapePiece(out: Builder, piece: SkylinePiece, bottom: number): void {
  const half: number = piece.width / 2;
  const depth: number = pieceDepth(piece);
  const spec = LOBBY_SKYLINE;
  switch (piece.kind) {
    case 'block':
      box(out, -half, half, bottom, piece.height, depth);
      return;
    case 'broken':
      for (let step: number = 0; step < spec.brokenSteps; step += 1) {
        const left: number = -half + (piece.width * step) / spec.brokenSteps;
        const right: number = -half + (piece.width * (step + 1)) / spec.brokenSteps;
        const top: number = piece.height * (spec.brokenLow + (1 - spec.brokenLow) * stepHash(step, piece.angleDegrees));
        box(out, left, right, bottom, top, depth);
      }
      return;
    case 'tower':
      box(out, -half, half, bottom, piece.height * spec.towerBody, depth);
      pyramid(out, -half * 1.15, half * 1.15, piece.height * spec.towerBody, piece.height, depth * 1.15);
      return;
    case 'spire':
      pyramid(out, -half, half, bottom, piece.height, depth);
      return;
    case 'gable':
      box(out, -half, half, bottom, piece.height * spec.gableBody, depth);
      prism(out, -half, half, piece.height * spec.gableBody, piece.height, depth);
      return;
    case 'wall': {
      const body: number = piece.height * spec.wallBody;
      box(out, -half, half, bottom, body, depth);
      const merlon: number = piece.width / (spec.merlons * 2 - 1);
      for (let index: number = 0; index < spec.merlons; index += 1) box(out, -half + index * 2 * merlon, -half + (index * 2 + 1) * merlon, body, piece.height, depth);
      return;
    }
  }
}

export function skylineGeometry(skyline: Skyline): BufferGeometry {
  const all: number[] = [];
  for (const piece of skyline.pieces) {
    const out: Builder = builder();
    shapePiece(out, piece, -skyline.sink);
    const angle: number = (piece.angleDegrees * Math.PI) / 180;
    const across: readonly [number, number] = [Math.cos(angle), Math.sin(angle)];
    const outward: readonly [number, number] = [Math.sin(angle), -Math.cos(angle)];
    for (let at: number = 0; at < out.points.length; at += 3) {
      const x: number = out.points[at] ?? 0;
      const y: number = out.points[at + 1] ?? 0;
      const z: number = out.points[at + 2] ?? 0;
      const radial: number = skyline.radius - z;
      all.push(across[0] * x + outward[0] * radial, y, across[1] * x + outward[1] * radial);
    }
  }
  const geometry: BufferGeometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(all), 3));
  geometry.computeBoundingSphere();
  return geometry;
}
