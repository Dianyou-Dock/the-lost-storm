import type { FlaskResource } from '../../sim/content/flasks.ts';
import { el, pulseClass, setText } from './dom.ts';
import type { FlaskCue, FlaskGauge, FlaskReading } from './flask-gauge.ts';
import { flaskCue, flaskGauge, flaskTicks, sameGauge } from './flask-gauge.ts';
import type { FlaskArt, FlaskLayer } from './flask-glass.ts';
import { buildFlaskArt, liquidTop } from './flask-glass.ts';

const VESSEL = {
  scale: 6,
  refusedMs: 220,
  percent: 100,
} as const;

interface PreparedArt {
  readonly art: FlaskArt;
  readonly mask: string;
}

export interface FlaskVessel {
  readonly root: HTMLElement;
  paint(reading: FlaskReading): FlaskCue;
  setKey(text: string, animate: boolean): void;
  refuse(): void;
}

const prepared: Map<string, PreparedArt> = new Map<string, PreparedArt>();

function drawn(layer: FlaskLayer, className: string, parent: HTMLElement): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = el('canvas', className, parent);
  canvas.width = layer.width;
  canvas.height = layer.height;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.getContext('2d')?.putImageData(new ImageData(layer.data, layer.width, layer.height), 0, 0);
  return canvas;
}

function maskOf(layer: FlaskLayer): string {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = layer.width;
  canvas.height = layer.height;
  canvas.getContext('2d')?.putImageData(new ImageData(layer.data, layer.width, layer.height), 0, 0);
  return `url(${canvas.toDataURL('image/png')})`;
}

function artFor(resource: FlaskResource, reading: FlaskReading): PreparedArt {
  const ticks: readonly number[] = flaskTicks(reading.maxCharges, reading.chargesPerUse);
  const key: string = `${resource}|${ticks.join(',')}`;
  const known: PreparedArt | undefined = prepared.get(key);
  if (known !== undefined) return known;
  const art: FlaskArt = buildFlaskArt(resource, ticks, VESSEL.scale);
  const made: PreparedArt = { art, mask: maskOf(art.inner) };
  prepared.set(key, made);
  return made;
}

function describe(resource: FlaskResource, gauge: FlaskGauge): string {
  return `${resource === 'life' ? 'Life' : 'Mana'} flask, ${gauge.uses} of ${gauge.maxUses} uses`;
}

export function createVessel(parent: HTMLElement, resource: FlaskResource, keyed: boolean, first: FlaskReading): FlaskVessel {
  const { art, mask } = artFor(resource, first);
  const root: HTMLDivElement = el('div', `flask-vessel ${resource}`, parent);
  root.setAttribute('role', 'img');
  const stage: HTMLDivElement = el('div', 'fv-art', root);
  drawn(art.body, 'fv-layer fv-body', stage);
  const fluid: HTMLDivElement = el('div', 'fv-fluid', stage);
  fluid.style.setProperty('mask-image', mask);
  fluid.style.setProperty('-webkit-mask-image', mask);
  const liquid: HTMLCanvasElement = drawn(art.liquid, 'fv-layer fv-liquid', fluid);
  const surface: HTMLCanvasElement = drawn(art.surface, 'fv-surface', fluid);
  surface.style.height = `${(art.surfaceHeight / art.height) * VESSEL.percent}%`;
  drawn(art.gloss, 'fv-layer fv-gloss', stage);
  drawn(art.stopper, 'fv-layer fv-stopper', stage);
  const key: HTMLSpanElement | null = keyed ? el('span', 'fv-key', root) : null;
  el('i', 'fv-bar', root);
  root.classList.toggle('fv-keyed', keyed);
  let shown: FlaskGauge | null = null;
  let last: FlaskReading | null = null;

  const place = (level: number): void => {
    liquid.style.clipPath = `inset(${((liquidTop(level) / art.height) * VESSEL.percent).toFixed(3)}% 0 0 0)`;
    surface.style.translate = `0 ${(((liquidTop(level) + art.lens) / art.surfaceHeight - 0.5) * VESSEL.percent).toFixed(3)}%`;
    surface.style.opacity = level <= 0 ? '0' : '1';
  };

  return {
    root,
    paint(reading: FlaskReading): FlaskCue {
      const cue: FlaskCue = flaskCue(last, reading);
      last = reading;
      const gauge: FlaskGauge = flaskGauge(reading);
      if (sameGauge(shown, gauge)) return cue;
      if (shown === null || shown.level !== gauge.level) place(gauge.level);
      root.classList.toggle('fv-empty', gauge.empty);
      root.classList.toggle('fv-pouring', gauge.restoring);
      root.setAttribute('aria-label', describe(resource, gauge));
      shown = gauge;
      return cue;
    },
    setKey(text: string, animate: boolean): void {
      if (key !== null) setText(key, text, animate);
    },
    refuse(): void {
      pulseClass(root, 'fv-refused', VESSEL.refusedMs);
    },
  };
}
