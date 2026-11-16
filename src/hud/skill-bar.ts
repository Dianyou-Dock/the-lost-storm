import type { SkillDef } from '../../sim/content/types.ts';
import { usable } from '../../sim/world/hud.ts';
import { weaponNeed } from '../../sim/weapons.ts';
import type { Command, PlayerState } from '../../sim/world/types.ts';
import { rowPress } from './row-press.ts';
import { slotAction } from '../settings/bindings.ts';
import type { HudContext } from './context.ts';
import { clamp01, el, label, pulseClass, setText } from './dom.ts';
import { iconSvg } from './icons.ts';
import type { SkillPicker } from './skill-picker.ts';
import { clearDetails, createSkillPicker, pointerSlotOf, skillDetails } from './skill-picker.ts';
import { promptText, use } from './prompts.ts';
import { attachTooltip } from './tooltip.ts';
import type { MomentumMeter } from './momentum-meter.ts';
import { createMomentumMeter } from './momentum-meter.ts';
import { isMoyu, moyuSkillEffect } from '../../sim/content/moyu.ts';

const SKILL_BAR = {
  pressMs: 110,
  swapMs: 320,
  learnedMs: 1400,
  fullTurn: 360,
  coolingEpsilon: 0.001,
} as const;

const KEY_GLYPHS: ReadonlyMap<string, string> = new Map<string, string>([
  ['LMB', 'mouse_left'],
  ['RMB', 'mouse_right'],
]);

interface SlotView {
  readonly root: HTMLElement;
  readonly icon: HTMLElement;
  readonly cost: HTMLElement;
  readonly name: HTMLElement;
  readonly effect: HTMLElement;
  readonly cooldown: HTMLElement;
  readonly keyNode: HTMLElement;
  key: string | null;
  skill: SkillDef | null;
  empty: boolean | null;
  iconId: string;
  angle: number;
  cooling: boolean | null;
  dim: boolean | null;
}

export interface SkillBar {
  readonly element: HTMLElement;
  update(player: PlayerState): void;
  refreshKeys(): void;
  press(skillId: string): void;
  learned(slot: number): void;
  closePicker(): boolean;
}

function emptyTooltip(context: HudContext, index: number, key: string): HTMLElement {
  const root: HTMLElement = clearDetails(pointerSlotOf(context, index), key === '' ? 'Empty slot' : `Empty slot · ${key}`);
  label('tip-line', `${promptText(context.api.touch, use('choose a skill for this slot'))}.`, root);
  return root;
}

export function createSkillBar(parent: HTMLElement, context: HudContext, track: (element: HTMLElement) => void): SkillBar {
  const element: HTMLDivElement = el('div', 'hud-skillbar', parent);
  element.classList.toggle('moyu', isMoyu(context.api.world.content));
  track(element);
  const meter: MomentumMeter = createMomentumMeter(parent.parentElement ?? parent);
  const picker: SkillPicker = createSkillPicker(element, context, track);
  document.addEventListener('pointerdown', (event: PointerEvent): void => {
    if (!(event.target instanceof Node) || !element.contains(event.target)) picker.close();
  });
  const slots: SlotView[] = [];

  const keyOf = (index: number): string => context.api.settings.keys().labelOf(slotAction(index));

  const paintKey = (view: SlotView, key: string): void => {
    if (view.key === key) return;
    view.key = key;
    const glyph: string | undefined = KEY_GLYPHS.get(key);
    view.keyNode.classList.toggle('glyph', glyph !== undefined);
    if (glyph === undefined) setText(view.keyNode, key, true);
    else view.keyNode.innerHTML = iconSvg(glyph);
  };

  const buildSlot = (index: number): SlotView => {
    const root: HTMLDivElement = el('div', 'slot', element);
    root.addEventListener('click', (event: MouseEvent): void => {
      event.stopPropagation();
      const instead: Command | null = rowPress(context.api.world);
      if (instead !== null) {
        picker.close();
        context.api.send(instead);
      } else if (picker.slot === index) picker.close();
      else picker.open(index, root);
    });
    const icon: HTMLDivElement = el('div', 'slot-icon', root);
    const cooldown: HTMLDivElement = el('div', 'slot-cd', root);
    const keyNode: HTMLDivElement = el('div', 'slot-key', root);
    const cost: HTMLDivElement = el('div', 'slot-cost', root);
    const name: HTMLDivElement = el('div', 'slot-name', root);
    const effect: HTMLDivElement = el('div', 'slot-effect', root);
    const view: SlotView = { root, icon, cost, name, effect, cooldown, keyNode, key: null, skill: null, empty: null, iconId: '', angle: -1, cooling: null, dim: null };
    paintKey(view, keyOf(index));
    attachTooltip(context.tooltip, root, (): HTMLElement | null => (picker.slot !== null ? null : view.skill === null ? emptyTooltip(context, index, keyOf(index)) : skillDetails(view.skill, `Skill · ${keyOf(index)} · click to change`, null, weaponNeed(context.api.world.content, view.skill.weapons, context.api.world.player.wielding))));
    return view;
  };

  const applySkill = (view: SlotView, skill: SkillDef | null): void => {
    view.skill = skill;
    const iconId: string = skill?.icon ?? '';
    if (view.iconId !== iconId) {
      view.iconId = iconId;
      view.icon.innerHTML = skill === null ? '' : iconSvg(iconId);
      if (skill !== null) pulseClass(view.root, 'swap', SKILL_BAR.swapMs);
    }
    const empty: boolean = skill === null;
    if (empty !== view.empty) {
      view.empty = empty;
      view.root.classList.toggle('empty', empty);
    }
    setText(view.cost, skill !== null && skill.manaCost > 0 ? String(skill.manaCost) : '', true);
    setText(view.name, skill?.name ?? '', true);
  };

  return {
    element,
    learned(slot: number): void {
      const view: SlotView | undefined = slots[slot];
      if (view !== undefined) pulseClass(view.root, 'learned', SKILL_BAR.learnedMs);
    },
    refreshKeys(): void {
      slots.forEach((view: SlotView, index: number): void => paintKey(view, keyOf(index)));
    },
    update(player: PlayerState): void {
      const elemental = isMoyu(context.api.world.content) ? moyuSkillEffect(player.allocated) : null;
      if (slots.length !== player.skills.length) {
        for (const view of slots) view.root.remove();
        slots.length = 0;
        player.skills.forEach((_skill: SkillDef | null, index: number): void => {
          slots.push(buildSlot(index));
        });
      }
      picker.refresh(player);
      meter.update(player);
      element.classList.toggle('spare', player.learned.some((skill: string): boolean => !player.bar.includes(skill)));
      slots.forEach((view: SlotView, index: number): void => {
        const held: SkillDef | null = player.skills[index] ?? null;
        const skill: SkillDef | null = held !== null && usable(player, held) ? held : null;
        if (view.skill !== skill || view.empty === null) applySkill(view, skill);
        setText(view.effect, skill === null ? '' : elemental?.label ?? '', true);
        view.root.style.setProperty('--moyu-effect', elemental?.color ?? 'transparent');
        view.root.classList.toggle('elemental', skill !== null && elemental !== null);
        if (skill === null) return;
        const remaining: number = player.cooldowns[skill.id] ?? 0;
        const cooling: boolean = remaining > SKILL_BAR.coolingEpsilon;
        const fraction: number = skill.cooldown > 0 ? clamp01(remaining / skill.cooldown) : 0;
        const angle: number = Math.round((1 - fraction) * SKILL_BAR.fullTurn);
        if (angle !== view.angle) {
          view.angle = angle;
          view.cooldown.style.setProperty('--cd', `${angle}deg`);
        }
        if (cooling !== view.cooling) {
          view.cooling = cooling;
          view.root.classList.toggle('cooling', cooling);
        }
        const dim: boolean = player.mana < skill.manaCost || weaponNeed(context.api.world.content, skill.weapons, player.wielding) !== null;
        if (dim !== view.dim) {
          view.dim = dim;
          view.root.classList.toggle('dim', dim);
        }
      });
    },
    closePicker(): boolean {
      return picker.close();
    },
    press(skillId: string): void {
      for (const view of slots) {
        if (view.skill?.id === skillId) pulseClass(view.root, 'press', SKILL_BAR.pressMs);
      }
    },
  };
}
