import { resolve } from 'node:path';
import type { GuideData } from './data.ts';
import { guideData } from './data.ts';
import { esc } from './html.ts';
import type { NavEntry, PageBody } from './layout.ts';
import { frame } from './layout.ts';
import type { BuildNotes } from './pages/build-page.ts';
import { buildHref, buildPage } from './pages/build-page.ts';
import { BUILD_NOTES } from './pages/build-notes.ts';
import { buildsPage } from './pages/builds.ts';
import { combatPage } from './pages/combat.ts';
import { homePage } from './pages/home.ts';
import { itemsPage } from './pages/items.ts';
import { skillsPage } from './pages/skills.ts';
import { startPage } from './pages/start.ts';
import { treePage } from './pages/tree.ts';

export interface GuidePage {
  readonly key: string;
  readonly href: string;
  readonly label: string;
  readonly render: (data: GuideData) => PageBody;
}

function buildEntry(notes: BuildNotes): GuidePage {
  return {
    key: `builds/${notes.id}`,
    href: buildHref(notes.id),
    label: notes.name,
    render: (data: GuideData): PageBody => ({ kicker: `Build · ${notes.kind}`, title: notes.name, lede: notes.forWho, description: `${notes.name}, a ${notes.kind.toLowerCase()} build for The Lost Storm: the route through the Skill Tree, the skill to lean on, gear and measured numbers.`, body: buildPage(data, notes) }),
  };
}

export const GUIDE_PAGES: readonly GuidePage[] = [
  { key: 'home', href: '/guide/', label: 'Guide', render: homePage },
  { key: 'start', href: '/guide/start/', label: 'Getting started', render: startPage },
  { key: 'combat', href: '/guide/combat/', label: 'Combat', render: combatPage },
  { key: 'skills', href: '/guide/skills/', label: 'Skills', render: skillsPage },
  { key: 'tree', href: '/guide/tree/', label: 'Skill Tree', render: treePage },
  { key: 'items', href: '/guide/items/', label: 'Items', render: itemsPage },
  { key: 'builds', href: '/guide/builds/', label: 'Builds', render: buildsPage },
  ...BUILD_NOTES.map(buildEntry),
];

export const MAIN_NAV: readonly NavEntry[] = GUIDE_PAGES.filter((page: GuidePage): boolean => !page.key.startsWith('builds/')).map((page: GuidePage): NavEntry => ({ href: page.href, label: page.label }));

export function guidePage(key: string): GuidePage {
  const found: GuidePage | undefined = GUIDE_PAGES.find((page: GuidePage): boolean => page.key === key);
  if (found === undefined) throw new Error(`no guide page ${key}`);
  return found;
}

export function shellPath(key: string): string {
  return key === 'home' ? 'guide/index.html' : `guide/${key}/index.html`;
}

export function guideInputs(root: string): Record<string, string> {
  return Object.fromEntries(GUIDE_PAGES.map((page: GuidePage): [string, string] => [`guide-${page.key.replace('/', '-')}`, resolve(root, shellPath(page.key))]));
}

function nextOf(page: GuidePage): NavEntry | null {
  const index: number = GUIDE_PAGES.indexOf(page);
  const next: GuidePage | undefined = GUIDE_PAGES[index + 1];
  return next === undefined ? null : { href: next.href, label: next.label };
}

function current(page: GuidePage): string {
  return page.key.startsWith('builds/') ? '/guide/builds/' : page.href;
}

export function renderGuideBody(data: GuideData, page: GuidePage): PageBody & { readonly html: string } {
  const body: PageBody = page.render(data);
  const html: string = frame({ href: page.href, kicker: body.kicker, title: body.title, lede: body.lede, body: body.body, nav: MAIN_NAV, next: nextOf(page), current: current(page) });
  return { ...body, html };
}

const MARK: RegExp = /<div id="guide" data-page="([a-z/-]+)"><\/div>/;
const TITLE: RegExp = /<title>[\s\S]*?<\/title>/;

export function shellHtml(key: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>The Lost Storm · Guide</title>
    <meta name="theme-color" content="#05070b" />
    <meta name="color-scheme" content="dark" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/src/guide/guide.css" />
    <link rel="stylesheet" href="/src/guide/guide-parts.css" />
  </head>
  <body>
    <div id="guide" data-page="${key}"></div>
  </body>
</html>
`;
}

export function fillShell(html: string, data: GuideData = guideData()): string {
  const match: RegExpExecArray | null = MARK.exec(html);
  const key: string | undefined = match?.[1];
  if (key === undefined) return html;
  const page: GuidePage = guidePage(key);
  const rendered = renderGuideBody(data, page);
  const title: string = page.key === 'home' ? 'The Lost Storm · Player’s guide' : `${rendered.title} · The Lost Storm guide`;
  return html
    .replace(TITLE, `<title>${esc(title)}</title>\n    <meta name="description" content="${esc(rendered.description)}" />\n    <link rel="canonical" href="https://theloststorm.com${esc(page.href)}" />`)
    .replace(MARK, rendered.html);
}
