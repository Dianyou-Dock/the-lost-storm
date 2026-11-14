import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PORTAL, checkLimits, describeReport, liftPage, localRefs, shipsInPortal, siteAnchors, withheldSet } from './portal.ts';

const LIMITS = { files: 3, totalBytes: 100, fileBytes: 60 } as const;

void test('the game page moves to the root: parent and root-relative URLs become relative to it', (): void => {
  const html: string = '<link rel="icon" href="/favicon.svg" /><script type="module" src="../assets/play-1.js"></script><link rel="stylesheet" href="../assets/play-2.css">';
  assert.equal(liftPage(html), '<link rel="icon" href="./favicon.svg" /><script type="module" src="./assets/play-1.js"></script><link rel="stylesheet" href="./assets/play-2.css">');
});

void test('absolute and protocol-relative URLs are left alone when the page moves', (): void => {
  const html: string = '<link rel="canonical" href="https://theloststorm.com/play/" /><script src="//cdn.example/x.js"></script>';
  assert.equal(liftPage(html), html);
});

void test('a page that would still point above its folder is refused', (): void => {
  assert.throws((): string => liftPage('<img src="../../x.png">'), /above its own folder/);
});

void test('the files the page points at are listed without query or fragment', (): void => {
  assert.deepEqual(localRefs('<link href="./favicon.svg"><script src="./assets/a.js?v=1"></script><a href="https://x.test/">x</a>'), ['favicon.svg', 'assets/a.js']);
});

void test('site pages linked from the title open on the site in a new tab', (): void => {
  const html: string = '<p><a href="/guide/">Guide</a><a class="l" href="/terms.html">Terms</a><a href="https://discord.gg/abc">D</a></p>';
  assert.equal(siteAnchors(html, 'https://theloststorm.com/'), '<p><a href="https://theloststorm.com/guide/" target="_blank" rel="noopener">Guide</a><a class="l" href="https://theloststorm.com/terms.html" target="_blank" rel="noopener">Terms</a><a href="https://discord.gg/abc">D</a></p>');
});

void test('local-only assets and site-only pages stay out of the portal', (): void => {
  assert.equal(shipsInPortal('models/local/fab/hero.glb'), false);
  assert.equal(shipsInPortal('audio/local/rain.ogg'), false);
  assert.equal(shipsInPortal('privacy.html'), false);
  assert.equal(shipsInPortal('og.jpg'), false);
  assert.equal(shipsInPortal('models/characters/man.glb'), true);
  assert.equal(shipsInPortal('favicon.svg'), true);
});

void test('a server address or an asset base set for the build is reported', (): void => {
  assert.deepEqual(withheldSet({ VITE_SERVER_URL: 'https://api.example', VITE_ASSET_BASE: ' ', VITE_BUILD_ID: 'x' }), ['VITE_SERVER_URL']);
  assert.deepEqual(withheldSet({}), []);
  assert.deepEqual(PORTAL.withheldEnv, ['VITE_SERVER_URL', 'VITE_ASSET_BASE']);
});

void test('a build inside the limits passes with its count and size', (): void => {
  const report = checkLimits([{ path: 'index.html', bytes: 40 }, { path: 'a.js', bytes: 50 }], LIMITS);
  assert.deepEqual(report, { files: 2, totalBytes: 90, problems: [] });
  assert.equal(describeReport({ files: 453, totalBytes: 44_564_480, problems: [] }), '453 files, 42.5 MB');
});

void test('too many files, too many bytes and one file too large are each reported', (): void => {
  const report = checkLimits(
    [
      { path: 'a', bytes: 10 },
      { path: 'b', bytes: 10 },
      { path: 'c', bytes: 10 },
      { path: 'big.glb', bytes: 80 },
    ],
    LIMITS,
  );
  assert.equal(report.problems.length, 3);
  assert.match(report.problems[0] ?? '', /^4 files/);
  assert.match(report.problems[1] ?? '', /in all/);
  assert.match(report.problems[2] ?? '', /^big\.glb/);
});

void test('the portal limits are the ones itch.io sets', (): void => {
  assert.deepEqual(PORTAL.limits, { files: 1000, totalBytes: 500 * 1024 * 1024, fileBytes: 200 * 1024 * 1024 });
});
