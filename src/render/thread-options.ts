import type { BufferGeometry, Material } from 'three';
import { ACESFilmicToneMapping, Box3, CatmullRomCurve3, Color, CylinderGeometry, DirectionalLight, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, OrthographicCamera, PMREMGenerator, Scene, SRGBColorSpace, TorusGeometry, TubeGeometry, Vector3, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { THUMBNAIL } from './item-thumbnails.ts';

export const THREAD_GLYPH: string = '<path d="M10.1 5.9A7 7 0 1 1 5.9 10.1"/><circle cx="7.6" cy="7.6" r="1.7" fill="currentColor" stroke="none"/><path d="M6.6 6.8C5.2 5.6 3.8 5.6 2.6 6.4M7.2 6.4C6.8 4.8 7.2 3.4 8.4 2.4" opacity="0.6"/><path d="M12.5 8.6c-.9 1.3.9 2.6 0 3.9s.9 2.6 0 3.9" opacity="0.55"/>';

interface Built {
  readonly group: Group;
  readonly geometries: BufferGeometry[];
  readonly materials: Material[];
}

function builder(): { readonly built: Built; readonly part: (geometry: BufferGeometry, material: Material) => Mesh } {
  const built: Built = { group: new Group(), geometries: [], materials: [] };
  return {
    built,
    part: (geometry: BufferGeometry, material: Material): Mesh => {
      built.geometries.push(geometry);
      if (!built.materials.includes(material)) built.materials.push(material);
      return new Mesh(geometry, material);
    },
  };
}

export function createSpool(): Built {
  const { built, part } = builder();
  const thread: MeshStandardMaterial = new MeshStandardMaterial({ color: new Color(0xb3a2ea), roughness: 0.85, emissive: new Color(0x3a2a80), emissiveIntensity: 0.5 });
  const wood: MeshStandardMaterial = new MeshStandardMaterial({ color: new Color(0x4a3322), roughness: 0.78 });
  const dark: MeshStandardMaterial = new MeshStandardMaterial({ color: new Color(0x1c130c), roughness: 0.9 });
  const spool: Group = new Group();
  const length: number = 0.2;
  const core: number = 0.1;
  spool.add(part(new CylinderGeometry(core, core, length * 0.92, 40), thread));
  const turns: number = 16;
  for (let index: number = 0; index < turns; index += 1) {
    const ring: Mesh = part(new TorusGeometry(core + 0.002, 0.0055, 8, 48), thread);
    ring.rotation.x = Math.PI / 2 + Math.sin(index * 1.7) * 0.06;
    ring.rotation.y = Math.cos(index * 2.3) * 0.05;
    ring.position.y = -length * 0.43 + (index / (turns - 1)) * length * 0.86;
    spool.add(ring);
  }
  for (const end of [-1, 1]) {
    const flange: Mesh = part(new CylinderGeometry(0.14, 0.14, 0.024, 40), wood);
    flange.position.y = (end * (length + 0.024)) / 2;
    spool.add(flange);
    const hole: Mesh = part(new CylinderGeometry(0.03, 0.03, 0.026, 20), dark);
    hole.position.y = flange.position.y + end * 0.002;
    spool.add(hole);
  }
  const loose: CatmullRomCurve3 = new CatmullRomCurve3([new Vector3(core, 0.02, 0.01), new Vector3(core + 0.06, -0.01, 0.06), new Vector3(core + 0.1, -0.08, 0.04), new Vector3(core + 0.07, -0.15, -0.02), new Vector3(core + 0.13, -0.21, 0.02)]);
  spool.add(part(new TubeGeometry(loose, 48, 0.0055, 8, false), thread));
  spool.rotation.set(0.35, 0.4, -1.05);
  built.group.add(spool);
  return built;
}

export function createRing(): Built {
  const { built, part } = builder();
  const strand: MeshStandardMaterial = new MeshStandardMaterial({ color: new Color(0xb8a8ff), roughness: 0.5, emissive: new Color(0x7a62f0), emissiveIntensity: 0.7 });
  const radius: number = 0.18;
  const steps: number = 160;
  const strandPoints = (phase: number): Vector3[] => {
    const points: Vector3[] = [];
    for (let index: number = 0; index < steps; index += 1) {
      const angle: number = (index / steps) * Math.PI * 2;
      const wobble: number = radius + Math.sin(angle * 3 + 0.6) * 0.008;
      const twist: number = angle * 14 + phase;
      const out: number = Math.cos(twist) * 0.008;
      points.push(new Vector3(Math.cos(angle) * (wobble + out), Math.sin(angle) * (wobble + out), Math.sin(twist) * 0.008));
    }
    return points;
  };
  const ring: Group = new Group();
  for (const phase of [0, Math.PI]) ring.add(part(new TubeGeometry(new CatmullRomCurve3(strandPoints(phase), true), 320, 0.0065, 8, true), strand));
  const glowMaterial: ShaderMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uRadius: { value: radius / 0.28 }, uColor: { value: new Color(0x9a86ff) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uRadius; uniform vec3 uColor; varying vec2 vUv; float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); } void main() { vec2 p = (vUv - 0.5) * 2.0; float r = length(p); float d = (r - uRadius) / 0.17; float band = exp(-d * d); float broken = 0.6 + 0.4 * n(p * 7.0); float alpha = band * broken * 0.85; gl_FragColor = vec4(uColor, alpha); }',
  });
  const glowPlane: Mesh = part(new PlaneGeometry(0.56, 0.56), glowMaterial);
  glowPlane.renderOrder = -1;
  ring.add(glowPlane);
  const top: Vector3 = new Vector3(0, radius, 0);
  const knot: Mesh = part(new TorusGeometry(0.02, 0.01, 10, 24), strand);
  knot.position.copy(top);
  knot.rotation.y = Math.PI / 2;
  ring.add(knot);
  const knot2: Mesh = part(new TorusGeometry(0.018, 0.01, 10, 24), strand);
  knot2.position.copy(top);
  knot2.rotation.set(0.5, Math.PI / 2, 1.2);
  ring.add(knot2);
  const tails: readonly (readonly Vector3[])[] = [
    [top.clone(), new Vector3(-0.03, radius + 0.03, 0.01), new Vector3(-0.07, radius + 0.02, 0.02), new Vector3(-0.1, radius + 0.05, 0)],
    [top.clone(), new Vector3(0.03, radius + 0.035, -0.01), new Vector3(0.05, radius + 0.08, 0), new Vector3(0.09, radius + 0.1, 0.01)],
  ];
  for (const tail of tails) ring.add(part(new TubeGeometry(new CatmullRomCurve3([...tail]), 32, 0.0065, 8, false), strand));
  ring.rotation.set(0.3, -0.5, 0.15);
  built.group.add(ring);
  return built;
}

function studio(size: number): { readonly renderer: WebGLRenderer; readonly scene: Scene; readonly camera: OrthographicCamera } {
  const renderer: WebGLRenderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = THUMBNAIL.exposure;
  const scene: Scene = new Scene();
  const generator: PMREMGenerator = new PMREMGenerator(renderer);
  scene.environment = generator.fromScene(new RoomEnvironment(), THUMBNAIL.environmentBlur).texture;
  scene.environmentIntensity = THUMBNAIL.environment;
  const key: DirectionalLight = new DirectionalLight(THUMBNAIL.keyColor, THUMBNAIL.keyIntensity);
  key.position.set(THUMBNAIL.keyX, THUMBNAIL.keyY, THUMBNAIL.keyZ);
  const fill: DirectionalLight = new DirectionalLight(THUMBNAIL.fillColor, THUMBNAIL.fillIntensity);
  fill.position.set(THUMBNAIL.fillX, THUMBNAIL.fillY, THUMBNAIL.fillZ);
  scene.add(key, fill);
  const camera: OrthographicCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, THUMBNAIL.distance * 2);
  camera.position.set(0, 0, THUMBNAIL.distance);
  return { renderer, scene, camera };
}

function shoot(built: Built, size: number): string {
  const { renderer, scene, camera } = studio(size);
  scene.add(built.group);
  built.group.updateMatrixWorld(true);
  const bounds: Box3 = new Box3().setFromObject(built.group, true);
  built.group.position.sub(bounds.getCenter(new Vector3()));
  const extent: Vector3 = bounds.getSize(new Vector3());
  const half: number = (Math.max(extent.x, extent.y) / 2) * (1 + THUMBNAIL.padding);
  camera.left = -half;
  camera.right = half;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url: string = renderer.domElement.toDataURL('image/png');
  built.group.removeFromParent();
  built.group.position.set(0, 0, 0);
  renderer.dispose();
  return url;
}

export function renderOptions(): { readonly spool: string; readonly ring: string; readonly spoolBig: string; readonly ringBig: string } {
  return { spool: shoot(createSpool(), THUMBNAIL.size), ring: shoot(createRing(), THUMBNAIL.size), spoolBig: shoot(createSpool(), 512), ringBig: shoot(createRing(), 512) };
}
