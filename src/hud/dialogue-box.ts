import type { NpcDef } from '../../sim/content/types.ts';
import type { WorldEvent } from '../../sim/world/types.ts';
import type { HudContext } from './context.ts';
import { el, retrigger, setText } from './dom.ts';
import { promptText, use } from './prompts.ts';

const DIALOGUE_BOX = {
  next: 'continue',
  last: 'close',
  swapMs: 260,
} as const;

export function dialogueHint(last: boolean, touch: boolean): string {
  return promptText(touch, use(last ? DIALOGUE_BOX.last : DIALOGUE_BOX.next));
}

type LineEvent = Extract<WorldEvent, { readonly type: 'dialogue_line' }>;

export interface DialogueBox {
  readonly element: HTMLElement;
  show(event: LineEvent): void;
  close(): void;
}

export function createDialogueBox(root: HTMLElement, context: HudContext): DialogueBox {
  const element: HTMLDivElement = el('div', 'hud-dialogue', root);
  const head: HTMLDivElement = el('div', 'dialogue-head', element);
  const name: HTMLDivElement = el('div', 'dialogue-name', head);
  const title: HTMLDivElement = el('div', 'dialogue-title', head);
  const text: HTMLDivElement = el('div', 'dialogue-text', element);
  const foot: HTMLDivElement = el('div', 'dialogue-foot', element);
  const count: HTMLDivElement = el('div', 'dialogue-count', foot);
  const hint: HTMLDivElement = el('div', 'dialogue-hint', foot);
  let open: boolean = false;
  let swap: number | null = null;

  const write = (line: string): void => {
    text.textContent = line;
    text.classList.remove('leaving');
    retrigger(text, 'line');
  };

  let touched: boolean = false;
  element.addEventListener('pointerdown', (event: PointerEvent): void => {
    event.stopPropagation();
    touched = event.pointerType === 'touch';
    if (touched) return;
    event.preventDefault();
    if (event.button === 0 && open) context.api.send({ type: 'advance' });
  });
  element.addEventListener('click', (): void => {
    if (!touched) return;
    touched = false;
    if (open) context.api.send({ type: 'advance' });
  });

  return {
    element,
    show(event: LineEvent): void {
      const world = context.api.world;
      const speaker: NpcDef | undefined = world.content.npcs.get(event.line.speaker);
      const total: number = world.dialogue?.talk.lines.length ?? event.index + 1;
      const nameChanged: boolean = setText(name, speaker?.name ?? event.line.speaker, false);
      const titleChanged: boolean = setText(title, speaker?.title ?? '', false);
      setText(count, `${event.index + 1} / ${total}`, false);
      setText(hint, dialogueHint(event.last, context.api.touch), false);
      if (swap !== null) window.clearTimeout(swap);
      swap = null;
      if (open) {
        text.classList.add('leaving');
        swap = window.setTimeout((): void => {
          swap = null;
          write(event.line.text);
        }, DIALOGUE_BOX.swapMs);
      } else {
        write(event.line.text);
      }
      if (open) {
        retrigger(foot, 'tick');
        if (nameChanged || titleChanged) retrigger(head, 'tick');
      }
      if (!open) {
        open = true;
        element.classList.add('open');
      }
      context.api.voice.play(event.line);
    },
    close(): void {
      if (!open) return;
      open = false;
      if (swap !== null) window.clearTimeout(swap);
      swap = null;
      element.classList.remove('open');
      context.api.voice.stop();
    },
  };
}
