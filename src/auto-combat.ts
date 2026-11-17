import type { Command, World } from '../sim/world/types.ts';
import { createAutoCombatState, planAutoCombat } from './auto-combat-plan.ts';
import type { AutoCombat, AutoCombatState } from './auto-combat-plan.ts';
import { el } from './hud/dom.ts';
import css from './auto-combat.css?inline';
export type { AutoCombat } from './auto-combat-plan.ts';

export function createAutoCombat(root: HTMLElement, world: World, send: (command: Command) => void): AutoCombat {
  const state: AutoCombatState = createAutoCombatState(world.zone.id);
  const style: HTMLStyleElement = el('style', '', root);
  style.textContent = css;
  const desktop: HTMLButtonElement = el('button', 'hud-menu-btn auto-combat-button', root.querySelector<HTMLElement>('.hud-row') ?? root);
  const mobile: HTMLButtonElement = el('button', 'auto-combat-button auto-combat-mobile', root);
  const buttons: readonly HTMLButtonElement[] = [desktop, mobile];
  const update = (): void => {
    for (const button of buttons) {
      button.textContent = state.enabled ? '自动刷图：开' : '自动刷图：关';
      button.title = '自动寻找小怪、随机施放可用技能、拾取掉落并在低血量时使用药剂';
      button.setAttribute('aria-pressed', String(state.enabled));
      button.classList.toggle('open', state.enabled);
    }
  };
  for (const button of buttons) {
    button.type = 'button';
    button.addEventListener('click', (): void => {
      if (state.enabled && world.player.intent.type === 'attack' && world.player.intent.targetId === state.focus) send({ type: 'stop' });
      state.enabled = !state.enabled;
      state.focus = null;
      state.home = null;
      state.lastSlot = null;
      state.delay = 0;
      update();
    });
  }
  update();
  return { collect: (dt: number, manual: readonly Command[], blocked: boolean): Command[] => planAutoCombat(world, state, dt, manual, blocked) };
}
