import type { LineDef } from '../../sim/content/types.ts';
import { lineSeconds } from '../../sim/world/reading.ts';
import type { HudContext } from './context.ts';
import { el, retrigger, setText } from './dom.ts';

const BARKS = {
  msPerSecond: 1000,
  leaveMs: 520,
} as const;

interface Bark {
  readonly speaker: string;
  readonly line: LineDef;
}

export interface BarkStrip {
  readonly element: HTMLElement;
  say(speaker: string, line: LineDef): void;
  clear(): void;
}

function readingTime(text: string): number {
  return lineSeconds(text) * BARKS.msPerSecond;
}

export function createBarkStrip(root: HTMLElement, context: HudContext): BarkStrip {
  const element: HTMLDivElement = el('div', 'hud-bark', root);
  const name: HTMLDivElement = el('div', 'bark-name', element);
  const text: HTMLDivElement = el('div', 'bark-text', element);
  const queue: Bark[] = [];
  let timer: number | null = null;
  let showing: boolean = false;

  const nameOf = (speaker: string): string => {
    const content = context.api.world.content;
    return content.monsters.get(speaker)?.name ?? content.npcs.get(speaker)?.name ?? speaker;
  };

  const next = (): void => {
    const bark: Bark | undefined = queue.shift();
    if (bark === undefined) {
      showing = false;
      timer = null;
      element.classList.remove('visible');
      return;
    }
    showing = true;
    setText(name, nameOf(bark.speaker), false);
    text.textContent = bark.line.text;
    retrigger(text, 'line');
    element.classList.add('visible');
    context.api.voice.play(bark.line);
    timer = window.setTimeout(next, readingTime(bark.line.text));
  };

  return {
    element,
    say(speaker: string, line: LineDef): void {
      queue.push({ speaker, line });
      if (!showing) next();
    },
    clear(): void {
      queue.length = 0;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      if (!showing) return;
      showing = false;
      element.classList.remove('visible');
      context.api.voice.stop();
    },
  };
}
