import { esc } from '../guide/html.ts';

export type Json = string | number | boolean | null | readonly Json[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: Json;
}

export interface ShareImage {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export interface Organization {
  readonly name: string;
  readonly url: string;
}

export interface SiteFacts {
  readonly origin: string;
  readonly name: string;
  readonly language: string;
  readonly description: string;
  readonly genres: readonly string[];
  readonly platform: string;
  readonly operatingSystem: string;
  readonly category: string;
  readonly currency: string;
  readonly playPath: string;
  readonly image: ShareImage;
  readonly publisher: Organization;
}

export const SITE: SiteFacts = {
  origin: 'https://theloststorm.com',
  name: 'The Lost Storm',
  language: 'en',
  description: 'The Lost Storm is a free hack-and-slash action RPG that runs in your browser: fight under a night storm, find loot and level up. Early alpha, no download.',
  genres: ['Action role-playing game', 'Hack and slash'],
  platform: 'Web browser',
  operatingSystem: 'Any',
  category: 'GameApplication',
  currency: 'USD',
  playPath: '/play/',
  image: { path: '/og.jpg', width: 1200, height: 630, alt: 'The hero stands with a sword in a shaft of pale light in the mist, beside the words The Lost Storm.' },
  publisher: { name: 'Mergestorm', url: 'https://mergestorm.ai' },
};

export type ShareKind = 'website' | 'article';

export interface SharePage {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly kind: ShareKind;
}

export interface Crumb {
  readonly name: string;
  readonly path: string;
}

export interface ArticlePage {
  readonly path: string;
  readonly headline: string;
  readonly description: string;
}

export const HOME_LD_MARK: string = '<script type="application/ld+json" data-ld="home"></script>';

export function absolute(path: string): string {
  return `${SITE.origin}${path}`;
}

function meta(attribute: 'name' | 'property', key: string, value: string): string {
  return `<meta ${attribute}="${key}" content="${esc(value)}" />`;
}

export function shareTags(page: SharePage): readonly string[] {
  const image: string = absolute(SITE.image.path);
  return [
    meta('property', 'og:type', page.kind),
    meta('property', 'og:site_name', SITE.name),
    meta('property', 'og:url', absolute(page.path)),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', String(SITE.image.width)),
    meta('property', 'og:image:height', String(SITE.image.height)),
    meta('property', 'og:image:alt', SITE.image.alt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', SITE.image.alt),
  ];
}

function organization(): JsonObject {
  return { '@type': 'Organization', name: SITE.publisher.name, url: SITE.publisher.url };
}

function siteRef(): JsonObject {
  return { '@type': 'WebSite', name: SITE.name, url: absolute('/') };
}

function gameRef(): JsonObject {
  return { '@type': 'VideoGame', name: SITE.name, url: absolute('/') };
}

export function webSite(): JsonObject {
  return { ...siteRef(), '@id': absolute('/#website'), description: SITE.description, inLanguage: SITE.language, publisher: organization() };
}

export function videoGame(): JsonObject {
  return {
    ...gameRef(),
    '@id': absolute('/#game'),
    description: SITE.description,
    image: absolute(SITE.image.path),
    genre: [...SITE.genres],
    gamePlatform: SITE.platform,
    operatingSystem: SITE.operatingSystem,
    applicationCategory: SITE.category,
    inLanguage: SITE.language,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: SITE.currency, url: absolute(SITE.playPath) },
    publisher: organization(),
  };
}

export function breadcrumbList(crumbs: readonly Crumb[]): JsonObject {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb: Crumb, index: number): JsonObject => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: absolute(crumb.path) })),
  };
}

export function article(page: ArticlePage): JsonObject {
  const url: string = absolute(page.path);
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: page.headline,
    description: page.description,
    url,
    mainEntityOfPage: url,
    image: [absolute(SITE.image.path)],
    inLanguage: SITE.language,
    author: organization(),
    publisher: organization(),
    isPartOf: siteRef(),
    about: gameRef(),
  };
}

export function ldScript(nodes: readonly JsonObject[]): string {
  const text: string = JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${text}</script>`;
}

export function fillHome(html: string): string {
  return html.replace(HOME_LD_MARK, ldScript([webSite(), videoGame()]));
}
