import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';
import { joinByLink, localStorageKeys } from './helpers';

// Epic 5 (documentation and export) with the real contributions module (second e2e build, port 4174).
// Facilitator F "Fiona", participants A "Alex" and B "Blake".
test.use({ baseURL: 'http://localhost:4174' });

const TITLE = 'Team Alpha';

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Team {
  F: Page;
  A: Page;
  B: Page;
  ctxF: BrowserContext;
  ctxA: BrowserContext;
  ctxB: BrowserContext;
  link: string;
  close: () => Promise<void>;
}

async function createSession(page: Page, title?: string): Promise<string> {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Browse all formats' }).click();
  await page
    .getByRole('article', { name: 'Start-Stop-Continue' })
    .getByRole('button', { name: 'Use this format' })
    .click();
  await page.getByRole('radio', { name: '50 min' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Your name').fill('Fiona');
  await page.getByLabel('Your role').fill('Scrum Master');
  if (title) await page.getByLabel('Session title (optional)').fill(title);
  await page.getByRole('button', { name: 'Create session' }).last().click();
  await expect(page.getByRole('heading', { name: /^Lobby/ })).toBeVisible();
  return page.getByRole('textbox', { name: 'Join link' }).inputValue();
}

async function startedTeam(
  browser: Browser,
  title?: string,
  extra?: (ctx: BrowserContext) => Promise<void>,
): Promise<Team> {
  const [ctxF, ctxA, ctxB] = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  for (const ctx of [ctxF, ctxA, ctxB]) await extra?.(ctx);
  const [F, A, B] = await Promise.all([ctxF.newPage(), ctxA.newPage(), ctxB.newPage()]);
  const link = await createSession(F, title);
  await joinByLink(A, link, 'Alex', 'Developer');
  await joinByLink(B, link, 'Blake', 'Tester');
  await F.getByRole('button', { name: 'Start session' }).click();
  for (const p of [F, A, B]) await expect(p.getByRole('heading', { name: 'Check-in' })).toBeVisible();
  return {
    F,
    A,
    B,
    ctxF,
    ctxA,
    ctxB,
    link,
    close: async () => {
      await Promise.all([ctxF.close(), ctxA.close(), ctxB.close()]);
    },
  };
}

const reveal = (page: Page) => page.getByRole('button', { name: 'Reveal', exact: true }).click();

async function goTo(t: Team, stop: string, heading: string): Promise<void> {
  await t.F.locator(`[data-stop="${stop}"]`).click();
  for (const p of [t.F, t.A, t.B]) await expect(p.getByRole('heading', { name: heading })).toBeVisible();
}

async function addEntry(page: Page, column: string, text: string): Promise<void> {
  await page.getByLabel(`New entry for ${column}`).fill(text);
  await page.getByRole('button', { name: `Add entry to ${column}` }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

/** A finished session: everybody wrote, F revealed, notes, an action item and the survey (closed). Not ended yet. */
async function fullSession(browser: Browser, title?: string): Promise<Team> {
  const t = await startedTeam(browser, title);
  const { F, A, B } = t;
  await A.getByLabel('Your check-in response').fill('Alex check-in');
  await A.getByRole('button', { name: 'Add response' }).click();
  await B.getByLabel('Your check-in response').fill('Blake check-in');
  await B.getByRole('button', { name: 'Add response' }).click();
  await expect(F.getByText('2 of 3 have added something')).toBeVisible();
  await reveal(F);

  await goTo(t, 'retro.write', 'Retrospective: Write silently');
  await addEntry(A, 'Start', '*bold*');
  await addEntry(A, 'Start', 'comma, "quote"');
  await addEntry(A, 'Stop', '<b>x</b>');
  await addEntry(A, 'Continue', '=SUM(A1)');
  await addEntry(B, 'Stop', 'blake entry');
  await reveal(F);

  await goTo(t, 'notes', 'Discussion notes');
  await A.getByLabel('New note').fill('agreed on X');
  await A.getByRole('button', { name: 'Add note' }).click();
  await expect(F.getByText('agreed on X')).toBeVisible();

  await goTo(t, 'actions', 'Action items');
  await A.getByLabel('Action description').fill('Ship it');
  const owners = A.getByRole('group', { name: 'Owners' });
  await owners.getByLabel('Alex').check();
  await owners.getByLabel('Blake').check();
  await A.getByLabel('Due date (optional)').fill('2026-03-15');
  await A.getByRole('button', { name: 'Save action item' }).click();
  await expect(F.getByText('Ship it')).toBeVisible();

  await goTo(t, 'checkOut', 'Check-out');
  await A.getByRole('radio', { name: 'Retro rating 4' }).check();
  await A.getByRole('radio', { name: 'Tool rating 5' }).check();
  await A.getByLabel('Comment about the retrospective (optional)').fill('liked the pacing');
  await A.getByRole('button', { name: 'Submit answers' }).click();
  await B.getByRole('radio', { name: 'Retro rating 2' }).check();
  await B.getByRole('radio', { name: 'Tool rating 3' }).check();
  await B.getByRole('button', { name: 'Submit answers' }).click();
  await expect(F.getByText('2 of 3 answered')).toBeVisible();
  await F.getByRole('button', { name: 'Close survey' }).click();
  await F.getByRole('dialog').getByRole('button', { name: 'Close survey' }).click();
  await expect(F.getByText('Survey results')).toBeVisible();
  return t;
}

async function endSession(F: Page): Promise<void> {
  await F.getByRole('button', { name: 'End session', exact: true }).click();
  await F.getByRole('dialog').getByRole('button', { name: 'End session', exact: true }).click();
}

async function expectDocumentation(...pages: Page[]): Promise<void> {
  for (const p of pages) {
    await expect(p.getByRole('heading', { name: 'The session has ended' })).toBeVisible();
    await expect(p.getByRole('article', { name: 'Preview of the documentation' })).toBeVisible();
  }
}

async function downloadOf(page: Page, buttonName: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  const path = await download.path();
  return { name: download.suggestedFilename(), content: readFileSync(path, 'utf8'), path };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  return rows;
}

function isAllowed(req: Request): boolean {
  const url = req.url();
  return (
    url.startsWith('http://localhost:4174') ||
    url.startsWith('http://localhost:9000') ||
    url.startsWith('ws://localhost:9000') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  );
}

test('J1 End and documentation: content, hidden entries warning, preview equals export (AC-1..AC-4, AC-11, AC-19..AC-21)', async ({
  browser,
}) => {
  const foreign: string[] = [];
  const t = await fullSession(browser, TITLE);
  const { F, A, B } = t;
  for (const p of [F, A, B]) p.on('request', (r) => !isAllowed(r) && foreign.push(r.url()));
  await endSession(F);
  await expectDocumentation(F, A, B);

  for (const p of [F, A, B]) {
    await expect(
      p.getByText(
        'This session is not saved. Save or download the documentation to your device before you leave.',
      ),
    ).toBeVisible();
    const preview = p.getByRole('article', { name: 'Preview of the documentation' });
    await expect(preview.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(preview.getByText('Fiona (Scrum Master), Facilitator')).toBeVisible();
    await expect(preview.getByText('Alex (Developer)')).toBeVisible();
    await expect(preview.getByText('Alex: Alex check-in')).toBeVisible();
    await expect(preview.getByText('*bold* (Alex)')).toBeVisible();
    await expect(preview.getByText('<b>x</b> (Alex)')).toBeVisible();
    await expect(preview.getByText('blake entry (Blake)')).toBeVisible();
    await expect(preview.getByText('agreed on X (Alex)')).toBeVisible();
    const table = preview.getByRole('table');
    await expect(table.getByRole('columnheader')).toHaveText(['Action', 'Owner(s)', 'Due date']);
    await expect(table.getByRole('cell')).toHaveText(['Ship it', 'Alex, Blake', '2026-03-15']);
    await expect(preview.getByText('liked the pacing')).toBeVisible();
    const text = (await preview.textContent())!;
    expect(text.slice(text.indexOf('Check-out'))).not.toMatch(/Alex|Blake/);
  }

  // the preview equals the downloaded HTML
  const html = await downloadOf(A, 'Download HTML');
  const previewText = await A.locator('.doc-preview').textContent();
  const exportedText = await A.evaluate(
    (source) => new DOMParser().parseFromString(source, 'text/html').body.textContent,
    html.content,
  );
  expect(exportedText).toBe(previewText);
  expect(foreign).toEqual([]);
  await t.close();
});

test('J1b Entries that were never revealed: the Facilitator is warned and can reveal first (AC-19)', async ({
  browser,
}) => {
  // first run: reveal first, then end
  const first = await startedTeam(browser, TITLE);
  await first.B.getByLabel('Your check-in response').fill('hidden check-in');
  await first.B.getByRole('button', { name: 'Add response' }).click();
  await expect(first.F.getByText('1 of 3 have added something')).toBeVisible();
  await first.F.getByRole('button', { name: 'End session', exact: true }).click();
  const dialog = first.F.getByRole('dialog');
  await expect(dialog).toContainText('1 entry is still hidden and will not be in the documentation');
  await expect(dialog.getByRole('button', { name: 'End session anyway' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await reveal(first.F);
  await endSession(first.F);
  await expectDocumentation(first.F, first.A, first.B);
  await expect(first.A.locator('.doc-preview').getByText('Blake: hidden check-in')).toBeVisible();
  await first.close();

  // second run: end anyway, the entry stays out
  const second = await startedTeam(browser, TITLE);
  await second.B.getByLabel('Your check-in response').fill('stays hidden');
  await second.B.getByRole('button', { name: 'Add response' }).click();
  await expect(second.F.getByText('1 of 3 have added something')).toBeVisible();
  await second.F.getByRole('button', { name: 'End session', exact: true }).click();
  await second.F.getByRole('dialog').getByRole('button', { name: 'End session anyway' }).click();
  await expectDocumentation(second.F, second.A, second.B);
  for (const p of [second.F, second.A, second.B]) {
    await expect(p.locator('.doc-preview').getByText('stays hidden')).toHaveCount(0);
  }
  await second.close();
});

test('J2 Exporting in several formats (AC-5..AC-10, AC-13, AC-14, AC-18, AC-20)', async ({ browser }) => {
  const t = await fullSession(browser, TITLE);
  const { F, A } = t;
  await t.ctxA.grantPermissions(['clipboard-read', 'clipboard-write']);
  await endSession(F);
  await expectDocumentation(A);

  // Markdown
  const md = await downloadOf(A, 'Download Markdown');
  expect(md.name).toBe(`team-alpha-${today()}.md`);
  expect(md.content).toContain('# Team Alpha');
  expect(md.content).toContain('\\*bold\\* (Alex)');
  expect(md.content).toContain('\\<b\\>x\\</b\\> (Alex)');
  expect(md.content).toContain('| Action | Owner(s) | Due date |');
  expect(md.content).toContain('| Ship it | Alex, Blake | 2026-03-15 |');

  // rich text: HTML with a table and plain text
  await A.getByRole('button', { name: 'Copy for Confluence' }).click();
  await expect(A.getByText('Copied. Paste it into your Confluence page.')).toBeVisible();
  const clip = await A.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const types = items.flatMap((i) => [...i.types]);
    const html = await (await items[0]!.getType('text/html')).text();
    return { types, html };
  });
  expect(clip.types).toEqual(expect.arrayContaining(['text/html', 'text/plain']));
  expect(clip.html).toContain('<table>');
  expect(clip.html).toContain('<h1>Team Alpha</h1>');

  // HTML: opens as a page, the special text is text and no script runs
  const html = await downloadOf(A, 'Download HTML');
  expect(html.name).toBe(`team-alpha-${today()}.html`);
  const viewer = await t.ctxA.newPage();
  await viewer.setContent(html.content); // the downloaded file is opened as a page
  await expect(viewer.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(viewer.getByText('<b>x</b> (Alex)')).toBeVisible();
  expect(await viewer.evaluate(() => document.querySelectorAll('b, script').length)).toBe(0);
  await viewer.close();

  // CSV
  const csv = await downloadOf(A, 'Download CSV for Miro');
  expect(csv.name).toBe(`team-alpha-${today()}.csv`);
  expect(csv.content.charCodeAt(0)).not.toBe(0xfeff);
  const rows = parseCsv(csv.content);
  expect(rows[0]).toEqual(['Type', 'Column', 'Text', 'Author', 'Owner(s)', 'Due date']);
  expect(rows.length).toBe(1 + 2 + 5 + 1 + 1); // check-in 2, retro 5, note 1, action 1
  expect(rows).toContainEqual(['Retro entry', 'Continue', "'=SUM(A1)", 'Alex', '', '']);
  expect(rows).toContainEqual(['Retro entry', 'Start', 'comma, "quote"', 'Alex', '', '']);
  expect(rows).toContainEqual(['Action item', 'Action items', 'Ship it', '', 'Alex, Blake', '2026-03-15']);

  // all four marks, the data is still on the device
  const status = A.getByRole('list', { name: 'Completed exports' });
  await expect(status).toContainText('Markdown ✓');
  await expect(status).toContainText('Copied for Confluence ✓');
  await expect(status).toContainText('HTML ✓');
  await expect(status).toContainText('CSV ✓');
  const keys = await localStorageKeys(A);
  expect(keys.some((k) => k.startsWith('retro.final.'))).toBe(true);
  expect(keys.some((k) => k.startsWith('retro.participant.'))).toBe(true);
  await t.close();
});

test('J2b Copy for Confluence without the clipboard feature uses the fallback (AC-7)', async ({
  browser,
}) => {
  const t = await startedTeam(browser, TITLE, async (ctx) => {
    await ctx.addInitScript(() => {
      // like a browser without rich clipboard support
      (window as unknown as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    });
  });
  await endSession(t.F);
  await expectDocumentation(t.A);
  await t.A.getByRole('button', { name: 'Copy for Confluence' }).click();
  await expect(
    t.A.getByText('Copied with the fallback method. Paste it into your Confluence page.'),
  ).toBeVisible();
  await expect(t.A.getByRole('list', { name: 'Completed exports' })).toContainText('Copied for Confluence ✓');
  await t.close();
});

test('J3 Leaving without exporting (AC-12, AC-14, AD-14)', async ({ browser }) => {
  const t = await startedTeam(browser, TITLE);
  const { F, B } = t;
  await endSession(F);
  await expectDocumentation(B);

  // closing the tab asks the browser to warn
  const closing = B.waitForEvent('dialog');
  await B.close({ runBeforeUnload: true });
  const warning = await closing;
  expect(warning.type()).toBe('beforeunload');
  await warning.dismiss();

  // a reload keeps the documentation
  B.on('dialog', (d) => void d.accept());
  await B.reload();
  await expectDocumentation(B);
  B.removeAllListeners('dialog');

  // "Done" asks, and confirming removes the data
  await B.getByRole('button', { name: 'Done: remove this session from this device' }).click();
  const dialog = B.getByRole('dialog');
  await expect(dialog).toContainText('You have not exported anything. The documentation will be lost.');
  await dialog.getByRole('button', { name: 'Leave without exporting' }).click();
  await expect(B.getByRole('button', { name: 'Create session' })).toBeVisible();
  const keys = await localStorageKeys(B);
  expect(keys.filter((k) => k.startsWith('retro.participant.') || k.startsWith('retro.final.'))).toEqual([]);
  await t.close();
});

test('J4 Participants export on their own devices, also after the Facilitator left (AC-15, AC-16)', async ({
  browser,
}) => {
  const t = await startedTeam(browser, TITLE);
  const { F, A, B } = t;
  // Casey joins and goes offline before the end
  const ctxC = await browser.newContext();
  const C = await ctxC.newPage();
  await joinByLink(C, t.link, 'Casey', 'Designer');
  // wait until the join is stored on Casey's device before the page goes away
  await expect
    .poll(async () => (await localStorageKeys(C)).some((k) => k.startsWith('retro.participant.')))
    .toBe(true);
  await C.close();
  await A.getByLabel('Your check-in response').fill('alex says hi');
  await A.getByRole('button', { name: 'Add response' }).click();
  await reveal(F);
  await expect(B.getByText('alex says hi')).toBeVisible();

  await endSession(F);
  await expectDocumentation(F, A, B);

  // Casey comes back with the stored token and gets the documentation
  const C2 = await ctxC.newPage();
  await C2.goto('/');
  await C2.getByRole('button', { name: 'Rejoin session' }).click();
  await expectDocumentation(C2);
  await expect(C2.locator('.doc-preview').getByText('Alex: alex says hi')).toBeVisible();

  // a brand-new device cannot join the ended session
  const ctxN = await browser.newContext();
  const N = await ctxN.newPage();
  await N.goto(t.link);
  await N.getByLabel('Your name').fill('Nora');
  await N.getByLabel('Your role').fill('Guest');
  await N.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(N.getByText(/already ended/)).toBeVisible();

  // the Facilitator leaves: A and B reload and still export everything
  await F.close();
  for (const p of [A, B]) {
    p.on('dialog', (d) => void d.accept());
    await p.reload();
    await expectDocumentation(p);
    p.removeAllListeners('dialog');
    for (const name of ['Download Markdown', 'Download HTML', 'Download CSV for Miro']) {
      const file = await downloadOf(p, name);
      expect(file.content.length).toBeGreaterThan(50);
    }
  }

  await Promise.all([ctxC.close(), ctxN.close(), t.close()]);
});

test('J5 The Facilitator drops out before the session ends (AC-17)', async ({ browser }) => {
  const t = await startedTeam(browser, TITLE);
  const { A, B } = t;
  const { F } = t;
  await A.getByLabel('Your check-in response').fill('Alex check-in');
  await A.getByRole('button', { name: 'Add response' }).click();
  await reveal(F);
  await expect(B.getByText('Alex check-in')).toBeVisible();
  // the retro entries are never revealed
  await goTo(t, 'retro.write', 'Retrospective: Write silently');
  await addEntry(A, 'Start', 'never revealed idea');
  await addEntry(B, 'Stop', 'blake never revealed');

  await A.clock.install();
  await A.reload();
  await expect(A.getByRole('heading', { name: 'Retrospective: Write silently' })).toBeVisible();
  await F.close();
  await expect(A.getByText(/The Facilitator is offline/)).toBeVisible({ timeout: 60_000 });
  await A.clock.fastForward('15:00');
  await expect(A.getByTestId('long-offline-hint')).toBeVisible();
  await A.getByRole('button', { name: 'Open documentation (may be incomplete)' }).click();

  await expect(
    A.getByText('Some content may be missing because the Facilitator left before the session was ended.'),
  ).toBeVisible();
  const preview = A.locator('.doc-preview');
  await expect(preview.getByText('Alex: Alex check-in')).toBeVisible();
  // only revealed content: not even the own entry that was never revealed
  await expect(preview.getByText('never revealed idea')).toHaveCount(0);
  await expect(preview.getByText('blake never revealed')).toHaveCount(0);
  await expect(A.getByRole('button', { name: 'Download Markdown' })).toBeVisible();
  await t.close();
});

test('J6 Session title: heading and file names (AC-21)', async ({ browser }) => {
  const plain = await startedTeam(browser);
  await endSession(plain.F);
  await expectDocumentation(plain.A);
  await expect(
    plain.A.locator('.doc-preview').getByRole('heading', {
      level: 1,
      name: `Retrospective, ${today()}, Start-Stop-Continue`,
    }),
  ).toBeVisible();
  const md = await downloadOf(plain.A, 'Download Markdown');
  const csv = await downloadOf(plain.A, 'Download CSV for Miro');
  expect([md.name, csv.name]).toEqual([
    `start-stop-continue-${today()}.md`,
    `start-stop-continue-${today()}.csv`,
  ]);
  await plain.close();

  const titled = await startedTeam(browser, 'Team Alpha: Q1 retro!');
  await endSession(titled.F);
  await expectDocumentation(titled.A);
  const html = await downloadOf(titled.A, 'Download HTML');
  expect(html.name).toBe(`team-alpha-q1-retro-${today()}.html`);
  await titled.close();
});

test('Privacy: only the app and the local signaling server are contacted during the session and the exports (AC-22)', async ({
  browser,
}) => {
  const foreign: string[] = [];
  const t = await startedTeam(browser, TITLE, async (ctx) => {
    ctx.on('request', (r) => !isAllowed(r) && foreign.push(r.url()));
  });
  await endSession(t.F);
  await expectDocumentation(t.A);
  await downloadOf(t.A, 'Download Markdown');
  await downloadOf(t.A, 'Download CSV for Miro');
  await t.A.getByRole('button', { name: 'Copy for Confluence' }).click();
  await expect(t.A.getByRole('list', { name: 'Completed exports' })).toContainText('Markdown ✓');
  expect(foreign).toEqual([]);
  await t.close();
});
