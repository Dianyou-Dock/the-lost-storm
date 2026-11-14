import type { IUniform, Texture, WebGLRenderer } from 'three';
import { HalfFloatType, ShaderMaterial, UniformsUtils, WebGLRenderTarget } from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import type { SeamLook } from '../glitch/seam-look.ts';

export const SEAM_PASS = {
  fastRate: 20,
  slowRate: 11,
  rowsMin: 70,
  rowsMax: 150,
  slicesMin: 7,
  slicesMax: 19,
  sliceDrift: 3,
  tearStill: 0.28,
  tearReach: 0.16,
  channelPull: 0.22,
  smearShare: 0.22,
  lagShare: 0.3,
  edgeStart: 0.25,
  edgeEnd: 0.95,
  blockRows: 26,
  blockShare: 0.2,
  blockJump: 0.12,
  blockPixelate: 0.8,
  blockDim: 0.72,
  whiteRows: 23,
  whiteSpread: 0.6,
  whiteSoft: 0.4,
} as const;

export interface SeamPass {
  readonly pass: ShaderPass;
  show(look: SeamLook, time: number): void;
  hold(): void;
  release(): void;
  dispose(): void;
}

function glsl(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

export const SEAM_VERTEX: string = ['varying vec2 vUv;', 'void main() {', '  vUv = uv;', '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);', '}'].join('\n');

const P = SEAM_PASS;

export const SEAM_FRAGMENT: string = [
  'uniform sampler2D tDiffuse;',
  'uniform sampler2D tHeld;',
  'uniform float uHeld;',
  'uniform float uAspect;',
  'uniform float uTime;',
  'uniform float uSeed;',
  'uniform float uSplit;',
  'uniform float uSlip;',
  'uniform float uDensity;',
  'uniform float uTear;',
  'uniform float uBlocks;',
  'uniform float uWhite;',
  'uniform float uBanded;',
  'varying vec2 vUv;',
  'float hash11(float p) {',
  '  p = fract(p * 0.1031);',
  '  p *= p + 33.33;',
  '  p *= p + p;',
  '  return fract(p);',
  '}',
  'float hash21(vec2 p) {',
  '  vec3 q = fract(vec3(p.xyx) * 0.1031);',
  '  q += dot(q, q.yzx + 33.33);',
  '  return fract((q.x + q.y) * q.z);',
  '}',
  'vec3 split3(sampler2D source, vec2 uv, vec2 shift) {',
  '  float r = texture2D(source, clamp(uv + shift, vec2(0.0), vec2(1.0))).r;',
  '  float g = texture2D(source, uv).g;',
  '  float b = texture2D(source, clamp(uv - shift, vec2(0.0), vec2(1.0))).b;',
  '  return vec3(r, g, b);',
  '}',
  'void main() {',
  '  vec2 uv = vUv;',
  `  float fast = floor(uTime * ${glsl(P.fastRate)}) + uSeed;`,
  `  float slow = floor(uTime * ${glsl(P.slowRate)}) + uSeed;`,
  `  float rows = mix(${glsl(P.rowsMin)}, ${glsl(P.rowsMax)}, hash11(fast * 1.7));`,
  '  float band = floor(uv.y * rows + hash11(fast) * rows);',
  '  float slipOn = step(hash21(vec2(band, fast)), uDensity);',
  '  float slipShift = (hash21(vec2(band, fast + 11.0)) - 0.5) * 2.0 * uSlip * slipOn;',
  `  float slices = floor(mix(${glsl(P.slicesMin)}, ${glsl(P.slicesMax)}, hash11(fast * 3.1 + 5.0)));`,
  `  float drift = hash11(fast + 3.0) * ${glsl(P.sliceDrift)};`,
  '  float slice = floor(uv.y * slices + drift);',
  `  float moved = step(${glsl(P.tearStill)}, hash21(vec2(slice, fast + 23.0)));`,
  `  float tearShift = (hash21(vec2(slice, fast + 41.0)) - 0.5) * 2.0 * ${glsl(P.tearReach)} * uTear * moved;`,
  '  vec2 torn = vec2(fract(uv.x + slipShift + tearShift), uv.y);',
  `  float smear = step(1.0 - ${glsl(P.smearShare)} * uTear, hash21(vec2(slice, fast + 59.0)));`,
  '  float row = clamp((slice - drift + hash21(vec2(slice, fast + 67.0))) / slices, 0.0, 1.0);',
  '  torn.y = mix(torn.y, row, smear);',
  `  float lag = uHeld * step(1.0 - ${glsl(P.lagShare)} * uTear, hash21(vec2(slice, fast + 71.0)));`,
  '  vec2 centred = (uv - 0.5) * vec2(uAspect, 1.0);',
  '  float reach = length(centred);',
  `  float edge = smoothstep(${glsl(P.edgeStart)}, ${glsl(P.edgeEnd)}, reach);`,
  '  vec2 outward = reach > 0.0001 ? centred / reach / vec2(uAspect, 1.0) : vec2(0.0);',
  `  vec2 shift = outward * uSplit * edge + vec2(tearShift * ${glsl(P.channelPull)} + uSplit * uTear, 0.0);`,
  '  vec3 colour = mix(split3(tDiffuse, torn, shift), split3(tHeld, torn, shift), lag);',
  `  vec2 grid = vec2(${glsl(P.blockRows)} * uAspect, ${glsl(P.blockRows)});`,
  '  vec2 cell = floor(uv * grid);',
  `  float blockOn = step(1.0 - uBlocks * ${glsl(P.blockShare)}, hash21(cell + slow * 7.13));`,
  '  vec2 cellUv = (cell + 0.5) / grid;',
  `  vec2 jump = floor((vec2(hash21(cell + slow), hash21(cell + slow + 5.0)) - 0.5) * ${glsl(P.blockJump)} * grid) / grid;`,
  `  vec2 blockSource = mix(fract(uv + jump), fract(cellUv + jump), step(${glsl(P.blockPixelate)}, hash21(cell + slow + 9.0)));`,
  '  vec3 block = texture2D(tDiffuse, blockSource).rgb;',
  `  block = mix(block, block.gbr, step(0.5, hash21(cell + slow + 3.0))) * ${glsl(P.blockDim)};`,
  '  colour = mix(colour, block, blockOn);',
  `  float whiteBand = floor(uv.y * ${glsl(P.whiteRows)} + hash11(uSeed) * ${glsl(P.whiteRows)});`,
  `  float threshold = hash21(vec2(whiteBand, uSeed + 97.0)) * ${glsl(P.whiteSpread)};`,
  `  float whiteHere = mix(uWhite, max(smoothstep(threshold, threshold + ${glsl(P.whiteSoft)}, uWhite), uWhite * uWhite * uWhite), uBanded);`,
  '  colour = mix(colour, vec3(1.0), whiteHere);',
  '  gl_FragColor = vec4(colour, 1.0);',
  '}',
].join('\n');

type SeamUniforms = Record<string, IUniform>;

function uniformsOf(): SeamUniforms {
  return {
    tDiffuse: { value: null },
    tHeld: { value: null },
    uHeld: { value: 0 },
    uAspect: { value: 1 },
    uTime: { value: 0 },
    uSeed: { value: 0 },
    uSplit: { value: 0 },
    uSlip: { value: 0 },
    uDensity: { value: 0 },
    uTear: { value: 0 },
    uBlocks: { value: 0 },
    uWhite: { value: 0 },
    uBanded: { value: 1 },
  };
}

function set(uniforms: SeamUniforms, name: string, value: number | Texture | null): void {
  const uniform: IUniform | undefined = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}

export function createSeamPass(): SeamPass {
  const pass: ShaderPass = new ShaderPass({ name: 'Seam', uniforms: uniformsOf(), vertexShader: SEAM_VERTEX, fragmentShader: SEAM_FRAGMENT });
  pass.enabled = false;
  const copy: ShaderMaterial = new ShaderMaterial({ uniforms: UniformsUtils.clone(CopyShader.uniforms), vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader });
  const quad: FullScreenQuad = new FullScreenQuad(copy);
  let held: WebGLRenderTarget | null = null;
  let capture: boolean = false;
  const draw = pass.render.bind(pass);
  const resize = pass.setSize.bind(pass);
  pass.setSize = (width: number, height: number): void => {
    resize(width, height);
    set(pass.uniforms, 'uAspect', height > 0 ? width / height : 1);
    held?.setSize(width, height);
  };
  pass.render = (renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean): void => {
    if (capture) {
      capture = false;
      held ??= new WebGLRenderTarget(readBuffer.width, readBuffer.height, { type: HalfFloatType });
      held.setSize(readBuffer.width, readBuffer.height);
      set(copy.uniforms, 'tDiffuse', readBuffer.texture);
      renderer.setRenderTarget(held);
      quad.render(renderer);
      set(pass.uniforms, 'tHeld', held.texture);
      set(pass.uniforms, 'uHeld', 1);
    }
    draw(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  };
  return {
    pass,
    show(look: SeamLook, time: number): void {
      const calm: boolean = look.split <= 0 && look.slip <= 0 && look.tear <= 0 && look.blocks <= 0 && look.white <= 0;
      pass.enabled = !calm;
      set(pass.uniforms, 'uTime', time);
      set(pass.uniforms, 'uSplit', look.split);
      set(pass.uniforms, 'uSlip', look.slip);
      set(pass.uniforms, 'uDensity', look.density);
      set(pass.uniforms, 'uTear', look.tear);
      set(pass.uniforms, 'uBlocks', look.blocks);
      set(pass.uniforms, 'uWhite', look.white);
      set(pass.uniforms, 'uBanded', look.banded ? 1 : 0);
      if (!look.held) set(pass.uniforms, 'uHeld', 0);
    },
    hold(): void {
      capture = true;
      set(pass.uniforms, 'uSeed', Math.floor(Math.random() * 997));
    },
    release(): void {
      held?.dispose();
      held = null;
      set(pass.uniforms, 'tHeld', null);
      set(pass.uniforms, 'uHeld', 0);
    },
    dispose(): void {
      held?.dispose();
      copy.dispose();
      quad.dispose();
      pass.dispose();
    },
  };
}
