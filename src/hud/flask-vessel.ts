import type { FlaskResource } from '../../sim/content/flasks.ts';
import { el, pulseClass, setText } from './dom.ts';
import type { FlaskCue, FlaskGauge, FlaskReading } from './flask-gauge.ts';
import { flaskCue, flaskGauge, sameGauge } from './flask-gauge.ts';
import { svg } from './svg.ts';

const VESSEL = {
  width: 32,
  height: 40,
  shape: 'M12.5 3.6H19.5V13.2A13 13 0 1 1 12.5 13.2Z',
  shine: 'M6.8 23.5A9.6 9.6 0 0 1 10.4 16.6',
  fullTop: 13.6,
  emptyTop: 39,
  tipMs: 300,
  gainedMs: 520,
  refusedMs: 260,
} as const;

const LIQUID: Readonly<Record<FlaskResource, readonly [string, string]>> = {
  life: ['#b02a35', '#4c0a11'],
  mana: ['#5878aa', '#1b2840'],
};

export interface FlaskVessel {
  readonly root: HTMLElement;
  paint(reading: FlaskReading): FlaskCue;
  setKey(text: string, animate: boolean): void;
  refuse(): void;
}

let made: number = 0;

function liquidTop(level: number): number {
  return VESSEL.emptyTop - level * (VESSEL.emptyTop - VESSEL.fullTop);
}

function buildArt(parent: HTMLElement, resource: FlaskResource): SVGGElement {
  made += 1;
  const clipId: string = `fv-clip-${made}`;
  const fillId: string = `fv-fill-${made}`;
  const art: SVGSVGElement = svg('svg', 'fv-art', parent, { viewBox: `0 0 ${VESSEL.width} ${VESSEL.height}`, 'aria-hidden': 'true' });
  const defs: SVGDefsElement = svg('defs', '', art, {});
  const clip: SVGClipPathElement = svg('clipPath', '', defs, { id: clipId });
  svg('path', '', clip, { d: VESSEL.shape });
  const gradient: SVGLinearGradientElement = svg('linearGradient', '', defs, { id: fillId, x1: 0, y1: 0, x2: 0, y2: 1 });
  const [top, bottom] = LIQUID[resource];
  svg('stop', '', gradient, { offset: 0, 'stop-color': top });
  svg('stop', '', gradient, { offset: 1, 'stop-color': bottom });
  svg('path', 'fv-glass', art, { d: VESSEL.shape });
  const held: SVGGElement = svg('g', '', art, { 'clip-path': `url(#${clipId})` });
  const liquid: SVGGElement = svg('g', 'fv-liquid', held, {});
  svg('rect', 'fv-fill', liquid, { x: -2, y: 0, width: VESSEL.width + 4, height: VESSEL.height + 2, fill: `url(#${fillId})` });
  svg('rect', 'fv-surface', liquid, { x: -2, y: 0, width: VESSEL.width + 4, height: 1.2 });
  svg('path', 'fv-rim', art, { d: VESSEL.shape });
  svg('path', 'fv-shine', art, { d: VESSEL.shine });
  svg('rect', 'fv-cork', art, { x: 11.6, y: 0.6, width: 8.8, height: 3.6, rx: 1 });
  return liquid;
}

function paintPips(pips: HTMLElement, gauge: FlaskGauge): void {
  while (pips.childElementCount < gauge.maxUses) el('i', 'fv-pip', pips);
  while (pips.childElementCount > gauge.maxUses) pips.lastElementChild?.remove();
  Array.from(pips.children).forEach((pip: Element, index: number): void => {
    pip.classList.toggle('fv-on', index < gauge.uses);
  });
}

export function createVessel(parent: HTMLElement, resource: FlaskResource, keyed: boolean): FlaskVessel {
  const root: HTMLDivElement = el('div', `flask-vessel ${resource}`, parent);
  const tilt: HTMLDivElement = el('div', 'fv-tilt', root);
  const liquid: SVGGElement = buildArt(tilt, resource);
  const key: HTMLSpanElement | null = keyed ? el('span', 'fv-key', tilt) : null;
  const pips: HTMLDivElement = el('div', 'fv-pips', root);
  let shown: FlaskGauge | null = null;
  let last: FlaskReading | null = null;
  return {
    root,
    paint(reading: FlaskReading): FlaskCue {
      const cue: FlaskCue = flaskCue(last, reading);
      last = reading;
      if (cue === 'drank') pulseClass(root, 'fv-tipped', VESSEL.tipMs);
      if (cue === 'gained') pulseClass(root, 'fv-gained', VESSEL.gainedMs);
      const gauge: FlaskGauge = flaskGauge(reading);
      if (sameGauge(shown, gauge)) return cue;
      if (shown === null || shown.level !== gauge.level) liquid.style.transform = `translateY(${liquidTop(gauge.level).toFixed(2)}px)`;
      if (shown === null || shown.uses !== gauge.uses || shown.maxUses !== gauge.maxUses) paintPips(pips, gauge);
      root.classList.toggle('fv-empty', gauge.empty);
      root.classList.toggle('fv-pouring', gauge.restoring);
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
