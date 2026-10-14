import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { joinByLink } from './helpers';

// Epic 3 (guided session flow): Facilitator F "Fiona", participants A "Alex" (whose clock is 5 minutes
// ahead) and B "Blake". Every device gets a fake clock (page.clock) and a spy on the Web Audio beep.
// The e2e build registers a fake contributions module (e2e/fixtures/fakeContributions.tsx) that stands
// in for Epic 4: an "Add test entry" button, entries hidden until revealed, and the counters.

const FIVE_MIN_AHEAD = 5 * 60_000;

const BEEP_SPY = `
  window.__beeps = 0;
  class FakeOscillator {
    constructor() { this.type = ''; this.frequency = { value: 0 }; }
    connect() {}
    start() { window.__beeps++; }
    stop() {}
  }
  class FakeContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createOscillator() { return new FakeOscillator(); }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
    resume() { return Promise.resolve(); }
  }
  window.AudioContext = FakeContext;
  window.webkitAudioContext = FakeContext;
`;

async function newPlayer(browser: Browser, ahead = 0): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(BEEP_SPY);
  await page.clock.install({ time: Date.now() + ahead });
  return { ctx, page };
}

const beeps = (page: Page) => page.evaluate(() => (window as unknown as { __beeps: number }).__beeps);

/** Moves the clocks of several devices forward by the same amount. */
async function runAll(pages: Page[], ms: number): Promise<void> {
  await Promise.all(pages.map((p) => p.clock.runFor(ms)));
}

/** The remaining time shown by the timer, in seconds. */
async function seconds(page: Page): Promise<number> {
  const text = (await page.getByRole('timer').textContent()) ?? '';
  const [m, s] = text.split(':').map(Number);
  return m! * 60 + s!;
}

async function createFlowSession(page: Page): Promise<string> {
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
  await page.getByRole('button', { name: 'Create session' }).last().click();
  await expect(page.getByRole('heading', { name: /^Lobby/ })).toBeVisible();
  return page.getByRole('textbox', { name: 'Join link' }).inputValue();
}

interface Team {
  F: Page;
  A: Page;
  B: Page;
  ctxF: BrowserContext;
  link: string;
  all: Page[];
  close: () => Promise<void>;
}

/** F creates a Start-Stop-Continue session for 50 minutes, A and B join, F starts it. */
async function startedTeam(browser: Browser): Promise<Team> {
  const f = await newPlayer(browser);
  const a = await newPlayer(browser, FIVE_MIN_AHEAD);
  const b = await newPlayer(browser);
  const link = await createFlowSession(f.page);
  await joinByLink(a.page, link, 'Alex', 'Developer');
  await joinByLink(b.page, link, 'Blake', 'Tester');
  await f.page.getByRole('button', { name: 'Start session' }).click();
  for (const p of [f.page, a.page, b.page])
    await expect(p.getByRole('heading', { name: 'Check-in' })).toBeVisible();
  return {
    F: f.page,
    A: a.page,
    B: b.page,
    ctxF: f.ctx,
    link,
    all: [f.page, a.page, b.page],
    close: async () => {
      await Promise.all([f.ctx.close(), a.ctx.close(), b.ctx.close()]);
    },
  };
}

const STOP_HEADINGS = [
  'Check-in',
  'Review of previous action items',
  'Retrospective: Write silently',
  'Retrospective: Reveal',
  'Retrospective: Discuss',
  'Discussion notes',
  'Action items',
  'Check-out',
];

test('J1 Phases walkthrough (AC-1, AC-2, AC-3, AC-4, AC-6, AC-8, AC-13)', async ({ browser }) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;

  // F sees the full instruction and the controls; A sees only the one-line text and no controls
  await expect(F.getByText(/Ask everybody to answer the question of the format/)).toBeVisible();
  await expect(A.getByText(/Ask everybody to answer the question of the format/)).toHaveCount(0);
  await expect(A.getByText('Arrive together and share how everybody is doing.')).toBeVisible();
  for (const name of ['Previous', 'Next', 'Start timer']) {
    await expect(F.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(A.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(F.getByRole('timer')).toHaveText('5:00');
  await expect(A.getByRole('timer')).toHaveText('5:00');

  // F walks through the eight stops; A and B follow
  for (let i = 0; i < STOP_HEADINGS.length; i++) {
    for (const p of [F, A, B]) {
      await expect(p.getByRole('heading', { name: STOP_HEADINGS[i]!, exact: true })).toBeVisible();
    }
    await expect(A.getByText(`Step ${i + 1} of 8`)).toBeVisible();
    if (i === 3) {
      // a new context C joins late and lands on the current stop
      const c = await newPlayer(browser);
      await joinByLink(c.page, t.link, 'Casey', 'Developer');
      await expect(c.page.getByRole('heading', { name: STOP_HEADINGS[3]!, exact: true })).toBeVisible();
      await expect(c.page.getByText('Step 4 of 8')).toBeVisible();
      await c.ctx.close();
    }
    if (i < STOP_HEADINGS.length - 1) await F.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(F.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();

  // the progress overview lists planned minutes and used time and the total
  const overview = F.getByRole('navigation', { name: 'Session steps' });
  await expect(overview).toContainText('5 min planned');
  await expect(overview).toContainText('14 min planned');
  await expect(overview).toContainText('used 0:00');
  await expect(overview).toContainText('Used 0 min of 50 min planned');
  await t.close();
});

test('J2 Retro steps and reveal (AC-14, AC-15, AC-17, AC-23)', async ({ browser }) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  await F.locator('[data-stop="retro.write"]').click();
  for (const p of t.all)
    await expect(p.getByRole('heading', { name: 'Retrospective: Write silently' })).toBeVisible();
  await expect(F.getByText('Suggested time: 8 min')).toBeVisible();

  await A.getByRole('button', { name: 'Add test entry' }).click();
  await B.getByRole('button', { name: 'Add test entry' }).click();
  await expect(F.getByText('2 of 3 have added something')).toBeVisible();
  await expect(A.getByText(/have added something/)).toHaveCount(0);
  await expect(B.getByText(/have added something/)).toHaveCount(0);
  // others' entries stay hidden; names of the authors are not in the counter
  await expect(F.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(0);
  await expect(A.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(1);

  await F.getByRole('button', { name: 'Reveal', exact: true }).click();
  for (const p of t.all) {
    await expect(p.getByRole('heading', { name: 'Retrospective: Reveal' })).toBeVisible();
    const items = p.getByRole('list', { name: 'Entries' }).getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.filter({ hasText: 'Alex' })).toHaveCount(1);
    await expect(items.filter({ hasText: 'Blake' })).toHaveCount(1);
  }
  await expect(F.getByText('Suggested time: 5 min')).toBeVisible();
  await expect(A.getByRole('button', { name: 'Reveal', exact: true })).toHaveCount(0);

  await F.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(A.getByRole('heading', { name: 'Retrospective: Discuss' })).toBeVisible();
  await expect(F.getByText('Suggested time: 14 min')).toBeVisible();
  await t.close();
});

test('J2b Next from the write step reveals the retro entries and tells the Facilitator (AD-16)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  await F.locator('[data-stop="retro.write"]').click();
  await A.getByRole('button', { name: 'Add test entry' }).click();
  await B.getByRole('button', { name: 'Add test entry' }).click();
  await expect(F.getByText('Everybody can now see the entries')).toHaveCount(0);

  await F.getByRole('button', { name: 'Next', exact: true }).click();
  for (const p of t.all) {
    await expect(p.getByRole('heading', { name: 'Retrospective: Reveal' })).toBeVisible();
    await expect(p.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(2);
  }
  await expect(F.getByText('Everybody can now see the entries')).toBeVisible();
  await expect(A.getByText('Everybody can now see the entries')).toHaveCount(0);
  await t.close();
});

test('J2c Check-in entries are revealed with the Reveal button (AC-14, Journey 3)', async ({ browser }) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  await A.getByRole('button', { name: 'Add test entry' }).click();
  await B.getByRole('button', { name: 'Add test entry' }).click();
  await expect(F.getByText('2 of 3 have added something')).toBeVisible();
  await expect(A.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(1);
  await expect(A.getByRole('button', { name: 'Reveal', exact: true })).toHaveCount(0);

  await F.getByRole('button', { name: 'Reveal', exact: true }).click();
  for (const p of t.all) {
    await expect(p.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(2);
  }
  await expect(F.getByRole('heading', { name: 'Check-in' })).toBeVisible(); // the stop does not change
  await t.close();
});

test('J3 Review of previous action items (AC-12)', async ({ browser }) => {
  const t = await startedTeam(browser);
  await t.F.getByRole('button', { name: 'Next', exact: true }).click();
  for (const p of t.all) {
    await expect(p.getByText(/Open the documentation from your last retro/).first()).toBeVisible();
    await expect(p.getByText(/Confluence or Miro/).first()).toBeVisible();
    await expect(p.locator('main input, main textarea')).toHaveCount(0);
  }
  await t.close();
});

test('J4 Go back keeps the remaining time and Reset restores the full time (AC-5, AC-24)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { F, A } = t;
  await A.getByRole('button', { name: 'Add test entry' }).click();
  await F.getByRole('button', { name: 'Start timer' }).click();
  await expect(F.getByText('Running')).toBeVisible();
  await runAll(t.all, 60_000);
  await F.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(F.getByRole('heading', { name: 'Review of previous action items' })).toBeVisible();
  await F.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(F.getByText('Paused')).toBeVisible();
  await expect(F.getByRole('timer')).toHaveText(/^(4:00|3:59|3:58)$/);

  await F.getByRole('button', { name: 'Reset timer' }).click();
  await expect(F.getByRole('timer')).toHaveText('5:00');
  await expect(A.getByRole('timer')).toHaveText('5:00');
  // the earlier content is still there and still editable
  await expect(A.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(1);
  await A.getByRole('button', { name: 'Add test entry' }).click();
  await expect(A.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(2);
  await t.close();
});

test('J5 Timer runs out: banner, overtime, beep once, mute, and shared time across clocks (AC-9, AC-10, AC-11, AC-20, AC-22)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;

  // A's clock is 5 minutes ahead, yet everybody shows the same remaining time
  await F.getByRole('button', { name: 'Start timer' }).click();
  for (const p of t.all) await expect(p.getByText('Running')).toBeVisible();
  await runAll(t.all, 30_000);
  const [f1, a1, b1] = [await seconds(F), await seconds(A), await seconds(B)];
  expect(Math.abs(f1 - 270)).toBeLessThanOrEqual(3);
  expect(Math.abs(a1 - f1)).toBeLessThanOrEqual(2);
  expect(Math.abs(b1 - f1)).toBeLessThanOrEqual(2);
  await F.getByRole('button', { name: 'Pause timer' }).click();
  for (const p of t.all) await expect(p.getByText('Paused')).toBeVisible();
  const frozen = await seconds(A);
  await runAll(t.all, 20_000);
  expect(await seconds(A)).toBe(frozen);
  expect(Math.abs((await seconds(F)) - (await seconds(A)))).toBeLessThanOrEqual(1);
  await F.getByRole('button', { name: 'Reset timer' }).click();
  for (const p of t.all) await expect(p.getByRole('timer')).toHaveText('5:00');

  // run out: banner and one beep on each device, the phase does not change
  await F.getByRole('button', { name: 'Start timer' }).click();
  for (const p of t.all) await expect(p.getByText('Running')).toBeVisible();
  await runAll(t.all, 5 * 60_000 + 1_000);
  for (const p of t.all) await expect(p.getByText('Time is over')).toBeVisible();
  for (const p of t.all) await expect.poll(() => beeps(p)).toBe(1);
  await runAll(t.all, 135_000);
  for (const p of t.all) await expect(p.getByText(/^\+02:\d\d$/)).toBeVisible();
  for (const p of t.all) expect(await beeps(p)).toBe(1);
  await expect(F.getByRole('heading', { name: 'Check-in' })).toBeVisible();

  // A mutes their device: a second run gives A no beep
  await A.getByRole('button', { name: 'Mute sound on this device' }).click();
  await F.getByRole('button', { name: 'Reset timer' }).click();
  await F.getByRole('button', { name: 'Start timer' }).click();
  for (const p of t.all) await expect(p.getByText('Running')).toBeVisible();
  await runAll(t.all, 5 * 60_000 + 1_000);
  for (const p of t.all) await expect(p.getByText('Time is over')).toBeVisible();
  await expect.poll(() => beeps(F)).toBe(2);
  await expect.poll(() => beeps(B)).toBe(2);
  expect(await beeps(A)).toBe(1);

  // F mutes the sound for everybody: nobody beeps, participants are told
  await F.getByRole('button', { name: 'Mute sound for everybody' }).click();
  await expect(A.getByText('Sound is muted by the Facilitator')).toBeVisible();
  await expect(B.getByText('Sound is muted by the Facilitator')).toBeVisible();
  await F.getByRole('button', { name: 'Reset timer' }).click();
  await F.getByRole('button', { name: 'Start timer' }).click();
  for (const p of t.all) await expect(p.getByText('Running')).toBeVisible();
  await runAll(t.all, 5 * 60_000 + 1_000);
  for (const p of t.all) await expect(p.getByText('Time is over')).toBeVisible();
  expect([await beeps(F), await beeps(A), await beeps(B)]).toEqual([2, 1, 2]);
  await t.close();
});

test('J6 Reconnect and Facilitator offline (AC-11, AC-16)', async ({ browser }) => {
  const t = await startedTeam(browser);
  const { A, B } = t;
  let { F } = t;
  await F.getByRole('button', { name: 'Start timer' }).click();
  for (const p of t.all) await expect(p.getByText('Running')).toBeVisible();
  await runAll(t.all, 60_000);

  // A reloads while the timer runs and shows the correct remaining time
  await A.reload();
  await expect(A.getByRole('heading', { name: 'Check-in' })).toBeVisible();
  await expect(A.getByRole('timer')).toHaveText(/^(4:00|3:59|3:58|3:57)$/);

  // F closes its page: A and B show "Facilitator offline" and a not-synchronized timer that keeps counting
  await F.close();
  // the clients retry with growing pauses before they give up: move their clocks in small steps
  await expect
    .poll(
      async () => {
        await runAll([A, B], 5_000);
        return A.getByText(/The Facilitator is offline/).count();
      },
      { timeout: 60_000 },
    )
    .toBe(1);
  await expect(A.getByText('Not synchronized')).toBeVisible();
  await expect(B.getByText('Not synchronized')).toBeVisible();
  const before = await seconds(A);
  await runAll([A, B], 20_000);
  expect(before - (await seconds(A))).toBeGreaterThanOrEqual(19);

  // F resumes on the same device: stop and timer are restored and A is synchronized again
  const f2 = await t.ctxF.newPage();
  await f2.addInitScript(BEEP_SPY);
  await f2.clock.install({ time: Date.now() });
  F = f2;
  await F.goto('/');
  await F.getByRole('button', { name: 'Resume session' }).click();
  await expect(F.getByRole('heading', { name: 'Check-in' })).toBeVisible();
  await expect(F.getByText('Running')).toBeVisible();
  await runAll([A, B], 30_000);
  await expect(A.getByText('Not synchronized')).toHaveCount(0, { timeout: 60_000 });
  await expect(A.getByText('Running')).toBeVisible();
  await t.close();
});

test('J7 Facilitator guide: the role cannot be handed over (AC-18)', async ({ browser }) => {
  const t = await startedTeam(browser);
  const { F, A } = t;
  await F.getByRole('button', { name: 'Facilitator guide' }).click();
  const dialog = F.getByRole('dialog', { name: 'Facilitator guide' });
  await expect(dialog).toContainText('cannot be handed to somebody else');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(A.getByRole('button', { name: 'Facilitator guide' })).toHaveCount(0);
  for (const p of [F, A]) {
    await expect(
      p.getByRole('button', { name: /hand over|handover|transfer|make .* facilitator/i }),
    ).toHaveCount(0);
  }
  await t.close();
});

test('J8 Late entries after the reveal are visible at once (AC-25)', async ({ browser }) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  await F.locator('[data-stop="retro.write"]').click();
  await A.getByRole('button', { name: 'Add test entry' }).click();
  await F.getByRole('button', { name: 'Reveal', exact: true }).click();
  for (const p of t.all) {
    await expect(p.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(1);
  }

  // B adds an entry after the reveal: visible to F and A immediately, with B's name
  await B.getByRole('button', { name: 'Add test entry' }).click();
  for (const p of [F, A]) {
    const item = p.getByRole('list', { name: 'Entries' }).getByRole('listitem').filter({ hasText: 'Blake' });
    await expect(item).toHaveCount(1);
  }

  // F goes back to the write step: the reveal stays, so the next entry is visible at once too
  await F.locator('[data-stop="retro.write"]').click();
  await expect(A.getByRole('heading', { name: 'Retrospective: Write silently' })).toBeVisible();
  await B.getByRole('button', { name: 'Add test entry' }).click();
  await expect(
    F.getByRole('list', { name: 'Entries' }).getByRole('listitem').filter({ hasText: 'Blake' }),
  ).toHaveCount(2);
  await expect(
    A.getByRole('list', { name: 'Entries' }).getByRole('listitem').filter({ hasText: 'Blake' }),
  ).toHaveCount(2);
  await t.close();
});
