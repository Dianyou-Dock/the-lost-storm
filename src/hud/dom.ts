import { moves } from './order.ts';
import type { Move } from './order.ts';
import { localizeText } from '../i18n/zh.ts';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement | null): HTMLElementTagNameMap[K] {
  const node: HTMLElementTagNameMap[K] = document.createElement(tag);
  if (className !== '') node.className = className;
  if (parent !== null) parent.appendChild(node);
  return node;
}

export function retrigger(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  node.getBoundingClientRect();
  node.classList.add(className);
}

export function label(className: string, content: string, parent: HTMLElement | null): HTMLDivElement {
  const node: HTMLDivElement = el('div', className, parent);
  node.textContent = localizeText(content);
  return node;
}

const TICK_CLASS: string = 'tick';
const ticking: WeakSet<HTMLElement> = new WeakSet<HTMLElement>();

function settleTick(node: HTMLElement): void {
  if (ticking.has(node)) return;
  ticking.add(node);
  node.addEventListener('animationend', (event: AnimationEvent): void => {
    if (event.target === node) node.classList.remove(TICK_CLASS);
  });
}

export function tick(node: HTMLElement): void {
  settleTick(node);
  retrigger(node, TICK_CLASS);
}

export function setText(node: HTMLElement, value: string, animate: boolean): boolean {
  const localized: string = localizeText(value);
  if (node.textContent === localized) return false;
  node.textContent = localized;
  if (animate) tick(node);
  return true;
}

export function setClass(node: HTMLElement, className: string, on: boolean): boolean {
  if (node.classList.contains(className) === on) return false;
  node.classList.toggle(className, on);
  return true;
}

export function setAttr(node: HTMLElement, name: string, value: string): boolean {
  const localized: string = name === 'aria-label' || name === 'aria-description' || name === 'placeholder' ? localizeText(value) : value;
  if (node.getAttribute(name) === localized) return false;
  node.setAttribute(name, localized);
  return true;
}

export function setFlag(node: HTMLElement, name: string, on: boolean): boolean {
  if (node.hasAttribute(name) === on) return false;
  node.toggleAttribute(name, on);
  return true;
}

export function setData(node: HTMLElement, key: string, value: string): boolean {
  if (node.dataset[key] === value) return false;
  node.dataset[key] = value;
  return true;
}

export function setVar(node: HTMLElement, property: string, value: string): boolean {
  if (node.style.getPropertyValue(property) === value) return false;
  node.style.setProperty(property, value);
  return true;
}

export function arrange(parent: HTMLElement, desired: readonly HTMLElement[]): boolean {
  const wanted: Set<Node> = new Set<Node>(desired);
  const current: Node[] = [...parent.childNodes].filter((node: ChildNode): boolean => wanted.has(node));
  const planned: readonly Move<Node>[] = moves<Node>(current, desired);
  for (const step of planned) parent.insertBefore(step.item, step.before);
  return planned.length > 0;
}

export function pulseClass(node: HTMLElement, className: string, ms: number): void {
  node.classList.add(className);
  window.setTimeout((): void => {
    node.classList.remove(className);
  }, ms);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function approach(current: number, target: number, dt: number, rate: number): number {
  const next: number = current + (target - current) * (1 - Math.exp(-rate * dt));
  return Math.abs(target - next) < 0.5 ? target : next;
}
