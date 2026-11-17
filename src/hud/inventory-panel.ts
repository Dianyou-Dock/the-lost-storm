import { bookOf } from '../../sim/content/story.ts';
import { isMoyu } from '../../sim/content/moyu.ts';
import type { ItemBaseDef, ItemSlot } from '../../sim/content/types.ts';
import { ITEM_SLOTS } from '../../sim/content/types.ts';
import { baseOf, rarityOf, slotOf } from '../../sim/items.ts';
import type { ItemInstance, PlayerState } from '../../sim/world/types.ts';
import type { HudContext, PanelView } from './context.ts';
import { el, label, retrigger } from './dom.ts';
import { arrivalOrder, setPicture } from './item-picture.ts';
import { itemTooltip } from './item-tooltip.ts';
import { attachTooltip } from './tooltip.ts';
import { promptText, use } from './prompts.ts';
import type { BagAction } from './trade-actions.ts';
import { bagAction, inventoryHint } from './trade-actions.ts';
import { pickupMinimum, setPickupMinimum } from '../loot-filter.ts';
import { buysBack, sellPrice } from '../../sim/world/trade.ts';

const INVENTORY = {
  hintEquipped: 'unequip',
  dropAsk: 'Drop?',
  dropConfirmMs: 2600,
  holdMs: 480,
  holdSlop: 10,
} as const;

interface Hold {
  readonly pointer: number;
  readonly x: number;
  readonly y: number;
  readonly timer: number;
}

const SLOT_TITLES: Readonly<Record<ItemSlot, string>> = {
  weapon: 'Weapon',
  head: 'Head',
  chest: 'Chest',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  charm: 'Charm',
};

interface CellView {
  readonly cell: HTMLElement;
  readonly item: HTMLElement;
  current: ItemInstance | null;
  image: string | null;
}

function buildCell(cellParent: HTMLElement, className: string): CellView {
  const cell: HTMLDivElement = el('div', className, cellParent);
  const item: HTMLDivElement = el('div', 'cell-item', cell);
  return { cell, item, current: null, image: null };
}

export function createInventoryPanel(parent: HTMLElement, context: HudContext): PanelView {
  const element: HTMLDivElement = el('div', 'hud-panel right inventory-panel', parent);
  element.addEventListener('contextmenu', (event: MouseEvent): void => {
    event.preventDefault();
  });
  label('panel-title', 'Inventory', element);
  const moyu: boolean = isMoyu(context.api.world.content);
  if (moyu) {
    const picker: HTMLLabelElement = el('label', 'moyu-pickup-filter', element);
    label('moyu-pickup-label', '自动拾取', picker);
    const select: HTMLSelectElement = el('select', '', picker);
    context.api.world.content.rarities.forEach((rarity, rank): void => {
      const option: HTMLOptionElement = el('option', '', select);
      option.value = String(rank);
      option.textContent = rank === 0 ? '所有品质' : `${rarity.name}及以上`;
    });
    select.value = String(pickupMinimum());
    select.addEventListener('change', (): void => setPickupMinimum(Number(select.value)));
  }

  const detail: HTMLDivElement = el('div', 'moyu-item-detail', parent);
  const detailHead: HTMLDivElement = el('div', 'moyu-item-detail-head', detail);
  label('', '装备详情', detailHead);
  const detailStatus: HTMLSpanElement = el('span', 'moyu-item-detail-status', detailHead);
  const cancel: HTMLButtonElement = el('button', '', detailHead);
  cancel.type = 'button';
  cancel.textContent = '取消';
  const detailBody: HTMLDivElement = el('div', 'moyu-item-detail-body', detail);
  const detailActions: HTMLDivElement = el('div', 'moyu-item-detail-actions', detail);
  const sellOne: HTMLButtonElement = el('button', '', detailActions);
  sellOne.type = 'button';
  const drop: HTMLButtonElement = el('button', 'moyu-item-drop', detailActions);
  drop.type = 'button';
  drop.textContent = '丢弃';
  let detailItem: ItemInstance | null = null;
  let detailIndex: number | null = null;
  let previewTimer: number | null = null;
  const clearPreview = (): void => {
    if (previewTimer !== null) window.clearTimeout(previewTimer);
    previewTimer = null;
  };
  const closeDetail = (): void => {
    clearPreview();
    detail.classList.remove('shown');
    detailItem = null;
    detailIndex = null;
  };
  cancel.addEventListener('click', closeDetail);
  sellOne.addEventListener('click', (): void => {
    const index: number | null = detailIndex;
    const item: ItemInstance | null = index === null ? null : context.api.world.player.inventory[index] ?? null;
    if (index === null || item === null || item.uid !== detailItem?.uid || !buysBack(context.api.world, item)) return;
    context.api.send({ type: 'trade', action: { type: 'sell', inventoryIndex: index } });
    closeDetail();
  });
  drop.addEventListener('click', (): void => {
    const index: number | null = detailIndex;
    const item: ItemInstance | null = index === null ? null : context.api.world.player.inventory[index] ?? null;
    if (item === null || item.uid !== detailItem?.uid || bookOf(context.api.world.content, baseOf(context.api.world.content, item)) !== null) return;
    if (index === null) return;
    context.api.send({ type: 'drop', inventoryIndex: index });
    closeDetail();
  });
  const showDetail = (item: ItemInstance, index: number | null, showDrop: boolean): void => {
    clearPreview();
    const slot: ItemSlot | null = slotOf(context.api.world.content, item);
    const equipped: ItemInstance | null = index === null || slot === null ? null : context.api.world.player.equipped[slot];
    detailStatus.textContent = index === null ? '当前装备' : equipped === null ? '背包物品' : '背包物品 · 右侧为当前装备';
    detailBody.replaceChildren(itemTooltip(context.api, item, equipped, index === null ? '双击卸下' : '双击装备 · 长按可丢弃'));
    detailBody.scrollTop = 0;
    detailItem = item;
    detailIndex = index;
    const canSell: boolean = index !== null && context.api.world.service?.kind === 'vendor' && buysBack(context.api.world, item);
    sellOne.hidden = !canSell;
    if (canSell) sellOne.textContent = `出售此物 · ${sellPrice(context.api.world.content, item)} 金币`;
    drop.hidden = !showDrop || index === null || bookOf(context.api.world.content, baseOf(context.api.world.content, item)) !== null;
    detail.classList.add('shown');
    context.tooltip.hide();
  };
  const preview = (item: ItemInstance, index: number | null): void => {
    clearPreview();
    previewTimer = window.setTimeout((): void => showDetail(item, index, false), 430);
  };

  const equipRow: HTMLDivElement = el('div', 'equip-row', element);
  const grid: HTMLDivElement = el('div', 'inv-grid', element);

  const setItem = (view: CellView, item: ItemInstance | null): boolean => {
    if (item === null && view.current === null) return false;
    const image: string | null = item === null ? null : context.api.itemImage(item);
    if (item !== null && view.current !== null && item.uid === view.current.uid && image === view.image) {
      view.current = item;
      return false;
    }
    const arriving: boolean = item !== null && view.current !== null && item.uid === view.current.uid && view.image === null && image !== null;
    view.current = item;
    view.image = image;
    if (item === null) {
      view.item.classList.remove('filled');
      return true;
    }
    const base: ItemBaseDef | null = baseOf(context.api.world.content, item);
    setPicture(view.item, image, base, arriving ? arrivalOrder(item.uid) : null);
    view.item.style.setProperty('--rarity', rarityOf(context.api.world.content, item).color);
    view.item.classList.add('filled');
    if (!arriving) retrigger(view.item, 'pop');
    return true;
  };

  const equipCells: Map<ItemSlot, CellView> = new Map<ItemSlot, CellView>();
  for (const slot of ITEM_SLOTS) {
    const holder: HTMLDivElement = el('div', 'equip', equipRow);
    holder.style.gridArea = slot;
    const view: CellView = buildCell(holder, 'cell big');
    label('equip-name', SLOT_TITLES[slot], holder);
    equipCells.set(slot, view);
    if (!moyu) attachTooltip(context.tooltip, view.cell, (): HTMLElement | null =>
      view.current === null ? null : itemTooltip(context.api, view.current, null, promptText(context.api.touch, use(INVENTORY.hintEquipped))),
    );
    let lastClick: number = 0;
    view.cell.addEventListener('click', (event: MouseEvent): void => {
      if (view.current === null) return;
      const double: boolean = event.detail >= 2 || (lastClick > 0 && performance.now() - lastClick < 420);
      lastClick = performance.now();
      if (moyu && !double) {
        preview(view.current, null);
        return;
      }
      clearPreview();
      context.tooltip.hide();
      context.api.send({ type: 'unequip', slot });
    });
  }

  const inventoryCells: CellView[] = [];
  let armed: { readonly index: number; readonly uid: number; readonly timer: number } | null = null;
  const disarm = (): void => {
    if (armed === null) return;
    window.clearTimeout(armed.timer);
    inventoryCells[armed.index]?.cell.classList.remove('arming');
    armed = null;
  };
  const arm = (index: number, view: CellView, item: ItemInstance): void => {
    disarm();
    view.cell.classList.add('arming');
    armed = { index, uid: item.uid, timer: window.setTimeout(disarm, INVENTORY.dropConfirmMs) };
  };
  const act = (index: number, view: CellView, action: BagAction): void => {
    switch (action.kind) {
      case 'send':
        context.api.send(action.command);
        return;
      case 'offer':
        context.sale.set(context.sale.uid() === action.uid ? null : action.uid);
        return;
      case 'pick':
        if (context.api.auction === null) retrigger(view.cell, 'deny');
        else context.api.auction.pick({ place: 'bag', index });
        return;
      case 'deny':
        retrigger(view.cell, 'deny');
        return;
    }
  };
  const addCell = (index: number): void => {
    const view: CellView = buildCell(grid, 'cell');
    label('cell-drop', INVENTORY.dropAsk, view.cell);
    inventoryCells.push(view);
    if (!moyu) attachTooltip(context.tooltip, view.cell, (): HTMLElement | null => {
      const item: ItemInstance | null = view.current;
      if (item === null) return null;
      const content = context.api.world.content;
      const slot: ItemSlot | null = slotOf(content, item);
      const equipped: ItemInstance | null = slot === null ? null : context.api.world.player.equipped[slot];
      return itemTooltip(context.api, item, equipped, inventoryHint(context.api.world, item, context.api.touch, context.api.unverified(item)));
    });
    let hold: Hold | null = null;
    let held: boolean = false;
    let lastClick: number = 0;
    const release = (): void => {
      if (hold === null) return;
      window.clearTimeout(hold.timer);
      hold = null;
    };
    view.cell.addEventListener('pointerdown', (event: PointerEvent): void => {
      release();
      held = false;
      if (event.button !== 0 || view.current === null) return;
      const timer: number = window.setTimeout((): void => {
        hold = null;
        if (moyu) {
          const item: ItemInstance | null = view.current;
          if (item === null) return;
          held = true;
          showDetail(item, index, true);
          return;
        }
        const action: BagAction = bagAction(context.api.world, index, 'right');
        if (action.kind !== 'offer') return;
        held = true;
        context.tooltip.hide();
        act(index, view, action);
      }, INVENTORY.holdMs);
      hold = { pointer: event.pointerId, x: event.clientX, y: event.clientY, timer };
    });
    view.cell.addEventListener('pointermove', (event: PointerEvent): void => {
      if (hold !== null && hold.pointer === event.pointerId && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > INVENTORY.holdSlop) release();
    });
    view.cell.addEventListener('pointerup', release);
    view.cell.addEventListener('pointercancel', release);
    view.cell.addEventListener('click', (event: MouseEvent): void => {
      disarm();
      if (held) {
        held = false;
        return;
      }
      if (view.current === null) return;
      if (moyu && !(event.ctrlKey || event.metaKey)) {
        const double: boolean = event.detail >= 2 || (lastClick > 0 && performance.now() - lastClick < 420);
        lastClick = performance.now();
        if (!double) {
          preview(view.current, index);
          return;
        }
        closeDetail();
      }
      context.tooltip.hide();
      if (bookOf(context.api.world.content, baseOf(context.api.world.content, view.current)) !== null) {
        context.api.readBook(view.current);
        return;
      }
      act(index, view, bagAction(context.api.world, index, event.ctrlKey || event.metaKey ? 'ctrl' : 'click'));
    });
    view.cell.addEventListener('contextmenu', (): void => {
      const item: ItemInstance | null = view.current;
      if (item === null || held) return;
      if (moyu) {
        showDetail(item, index, true);
        return;
      }
      context.tooltip.hide();
      const action: BagAction = bagAction(context.api.world, index, 'right');
      if (action.kind === 'send' && action.command.type === 'drop' && (armed === null || armed.index !== index || armed.uid !== item.uid)) {
        arm(index, view, item);
        return;
      }
      disarm();
      act(index, view, action);
    });
  };
  for (let index: number = 0; index < context.api.world.player.inventory.length; index += 1) addCell(index);

  const markOffered = (uid: number | null): void => {
    for (const view of inventoryCells) view.cell.classList.toggle('offered', uid !== null && view.current !== null && view.current.uid === uid);
  };
  context.sale.watch(markOffered);

  return {
    element,
    refresh(): void {
      const player: PlayerState = context.api.world.player;
      while (inventoryCells.length < player.inventory.length) addCell(inventoryCells.length);
      let changed: boolean = false;
      for (const slot of ITEM_SLOTS) {
        const view: CellView | undefined = equipCells.get(slot);
        if (view !== undefined && setItem(view, player.equipped[slot])) changed = true;
      }
      inventoryCells.forEach((view: CellView, index: number): void => {
        if (setItem(view, player.inventory[index] ?? null)) changed = true;
      });
      markOffered(context.sale.uid());
      if (armed !== null && (player.inventory[armed.index]?.uid !== armed.uid || !element.classList.contains('open'))) disarm();
      if (changed) context.tooltip.hide();
    },
  };
}
