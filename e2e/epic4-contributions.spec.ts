import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { joinByLink } from './helpers';

// Epic 4 (participant contributions) with the REAL contributions module: the second e2e build on
// port 4174 does not load the Epic 3 test fixture. Facilitator F "Fiona", participants A "Alex" and
// B "Blake"; format Start-Stop-Continue, 50 minutes.
test.use({ baseURL: 'http://localhost:4174' });

interface Team {
  F: Page;
  A: Page;
  B: Page;
  ctxF: BrowserContext;
  all: Page[];
  close: () => Promise<void>;
}

async function createSession(page: Page): Promise<string> {
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

async function startedTeam(browser: Browser, opts: { mobileB?: boolean } = {}): Promise<Team> {
  const ctxF = await browser.newContext();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext(opts.mobileB ? { viewport: { width: 390, height: 844 } } : {});
  const [F, A, B] = await Promise.all([ctxF.newPage(), ctxA.newPage(), ctxB.newPage()]);
  const link = await createSession(F);
  await joinByLink(A, link, 'Alex', 'Developer');
  await joinByLink(B, link, 'Blake', 'Tester');
  await F.getByRole('button', { name: 'Start session' }).click();
  for (const p of [F, A, B]) await expect(p.getByRole('heading', { name: 'Check-in' })).toBeVisible();
  return {
    F,
    A,
    B,
    ctxF,
    all: [F, A, B],
    close: async () => {
      await Promise.all([ctxF.close(), ctxA.close(), ctxB.close()]);
    },
  };
}

/** The Facilitator moves everybody to a stop of the progress list. */
async function goTo(t: Team, stop: string, heading: string): Promise<void> {
  await t.F.locator(`[data-stop="${stop}"]`).click();
  for (const p of t.all) await expect(p.getByRole('heading', { name: heading })).toBeVisible();
}

const reveal = (page: Page) => page.getByRole('button', { name: 'Reveal', exact: true }).click();

async function addEntry(page: Page, column: string, text: string): Promise<void> {
  await page.getByLabel(`New entry for ${column}`).fill(text);
  await page.getByRole('button', { name: `Add entry to ${column}` }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

const card = (page: Page, text: string) => page.locator('li').filter({ hasText: text });

test('J1 Check-in: limit, hidden responses, reveal with names (AC-1, AC-3, AC-4, AC-13, AC-17)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  const field = A.getByLabel('Your check-in response');
  await expect(A.getByText('In one word: how are you arriving today?')).toBeVisible();

  await field.fill('x'.repeat(281));
  await expect(field).toHaveValue('x'.repeat(280));
  await expect(A.getByText('0 characters left')).toBeVisible();

  await field.fill('Alex is here');
  await A.getByRole('button', { name: 'Add response' }).click();
  await B.getByLabel('Your check-in response').fill('Blake is here');
  await B.getByRole('button', { name: 'Add response' }).click();

  await expect(F.getByText('2 of 3 have added something')).toBeVisible();
  await expect(A.getByText('Alex is here')).toBeVisible();
  await expect(A.getByText('Blake is here')).toHaveCount(0);
  await expect(F.getByText('Alex is here')).toHaveCount(0);

  await reveal(F);
  for (const p of t.all) {
    await expect(card(p, 'Alex is here').getByText('Alex', { exact: true })).toBeVisible();
    await expect(card(p, 'Blake is here').getByText('Blake', { exact: true })).toBeVisible();
  }
  await t.close();
});

test('J2 Retro entries: own controls, hidden until reveal, late entries, mobile, Facilitator delete (AC-2..AC-5, AC-15, AC-16, AC-18)', async ({
  browser,
}) => {
  const t = await startedTeam(browser, { mobileB: true });
  const { F, A, B } = t;
  await goTo(t, 'retro.write', 'Retrospective: Write silently');

  await addEntry(A, 'Start', 'alex start one');
  await addEntry(A, 'Stop', 'alex stop one');
  await addEntry(A, 'Stop', 'alex stop two');
  // edit one, delete one (own controls)
  await card(A, 'alex start one').getByRole('button', { name: 'Edit entry' }).click();
  await A.getByLabel('Entry text').fill('alex start edited');
  await A.getByRole('button', { name: 'Save' }).click();
  await expect(A.getByText('alex start edited')).toBeVisible();
  await expect(A.getByText('alex start one')).toHaveCount(0);
  await card(A, 'alex stop two').getByRole('button', { name: 'Delete entry' }).click();
  await expect(A.getByText('alex stop two')).toHaveCount(0);

  // B adds one to Continue with three interactions (390 x 844): tap the field, type, tap Add
  const field = B.getByLabel('New entry for Continue');
  await field.click();
  await field.fill('blake continue one');
  await B.getByRole('button', { name: 'Add entry to Continue' }).click();
  await expect(B.getByText('blake continue one')).toBeVisible();

  // hidden: A sees only own entries, F none
  await expect(A.getByText('blake continue one')).toHaveCount(0);
  await expect(F.getByText('alex start edited')).toHaveCount(0);

  await reveal(F);
  for (const p of t.all) {
    await expect(p.getByRole('heading', { name: 'Retrospective: Reveal' })).toBeVisible();
    const start = p.locator('.retro-column').filter({ has: p.getByRole('heading', { name: 'Start' }) });
    const stop = p.locator('.retro-column').filter({ has: p.getByRole('heading', { name: 'Stop' }) });
    const cont = p.locator('.retro-column').filter({ has: p.getByRole('heading', { name: 'Continue' }) });
    await expect(start.getByText('alex start edited')).toBeVisible();
    await expect(stop.getByText('alex stop one')).toBeVisible();
    await expect(cont.getByText('blake continue one')).toBeVisible();
    await expect(card(p, 'blake continue one').getByText('Blake', { exact: true })).toBeVisible();
  }
  // others' entries show no edit or delete controls to participants
  await expect(card(A, 'blake continue one').getByRole('button')).toHaveCount(0);

  // B adds another entry after the reveal: visible to A and F at once
  await addEntry(B, 'Stop', 'blake late entry');
  for (const p of [A, F]) await expect(p.getByText('blake late entry')).toBeVisible();

  // the Facilitator deletes an entry of A
  await card(F, 'alex stop one').getByRole('button', { name: 'Delete entry' }).click();
  for (const p of t.all) await expect(p.getByText('alex stop one')).toHaveCount(0);
  await t.close();
});

test('J3 Notes: shared items, note taker, edits replace, Facilitator deletes (AC-6, AC-7, AC-13, AC-16, AC-24)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  await goTo(t, 'notes', 'Discussion notes');

  await A.getByLabel('New note').fill('Alex note');
  await A.getByRole('button', { name: 'Add note' }).click();
  await B.getByLabel('New note').fill('Blake note');
  await B.getByRole('button', { name: 'Add note' }).click();
  for (const p of t.all) {
    await expect(p.getByText('Alex note')).toBeVisible();
    await expect(p.getByText('Blake note')).toBeVisible();
  }

  await F.getByLabel('Note taker').selectOption({ label: 'Blake' });
  for (const p of t.all) await expect(p.getByText('Note taker: Blake')).toBeVisible();
  await expect(A.getByLabel('Note taker')).toHaveCount(0);

  // A can still add, and edits B's item: the new text replaces the old one everywhere
  await A.getByLabel('New note').fill('Alex adds more');
  await A.getByRole('button', { name: 'Add note' }).click();
  await expect(B.getByText('Alex adds more')).toBeVisible();
  await card(A, 'Blake note').getByRole('button', { name: 'Edit note' }).click();
  await A.getByLabel('Note text').fill('Blake note, edited by Alex');
  await A.getByRole('button', { name: 'Save' }).click();
  for (const p of t.all) {
    await expect(p.getByText('Blake note, edited by Alex')).toBeVisible();
    await expect(p.getByText('Blake note', { exact: true })).toHaveCount(0);
  }

  // A has no delete control; F deletes an item and it disappears for everybody
  await expect(A.getByRole('button', { name: 'Delete note' })).toHaveCount(0);
  await card(F, 'Alex adds more').getByRole('button', { name: 'Delete note' }).click();
  for (const p of t.all) await expect(p.getByText('Alex adds more')).toHaveCount(0);
  await t.close();
});

test('J4 Action items: validation, owners, due date, edit by anyone, delete by the Facilitator (AC-8, AC-9, AC-10, AC-16)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  await goTo(t, 'actions', 'Action items');

  await A.getByRole('button', { name: 'Save action item' }).click();
  await expect(A.getByText('Please describe the action.')).toBeVisible();
  await A.getByLabel('Action description').fill('Fix the build');
  await A.getByRole('button', { name: 'Save action item' }).click();
  await expect(A.getByText('Please choose at least one owner.')).toBeVisible();

  // owners can only be the three people of the session
  const owners = A.getByRole('group', { name: 'Owners' });
  await expect(owners.getByRole('checkbox')).toHaveCount(3);
  await owners.getByLabel('Alex').check();
  await owners.getByLabel('Blake').check();
  await A.getByLabel('Due date (optional)').fill('2026-03-01');
  await A.getByRole('button', { name: 'Save action item' }).click();
  for (const p of t.all) {
    const item = card(p, 'Fix the build');
    await expect(item.getByText('Owners: Alex, Blake')).toBeVisible();
    await expect(item.getByText('Due: 2026-03-01')).toBeVisible();
  }

  // B edits the description and the owner list
  await card(B, 'Fix the build').getByRole('button', { name: 'Edit action item' }).click();
  const form = B.getByRole('form', { name: 'Edit action item' });
  await form.getByLabel('Action description').fill('Fix the build and the tests');
  await form.getByLabel('Alex').uncheck();
  await form.getByRole('button', { name: 'Save action item' }).click();
  for (const p of t.all) {
    const item = card(p, 'Fix the build and the tests');
    await expect(item.getByText('Owners: Blake')).toBeVisible();
  }

  // only F can delete
  await expect(A.getByRole('button', { name: 'Delete action item' })).toHaveCount(0);
  await card(F, 'Fix the build and the tests').getByRole('button', { name: 'Delete action item' }).click();
  for (const p of t.all) await expect(p.getByText('Fix the build and the tests')).toHaveCount(0);
  await t.close();
});

test('J5 Survey: anonymous, changeable until closed, final results without names (AC-11, AC-12, AC-21, AC-22)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  await goTo(t, 'checkOut', 'Check-out');

  for (const p of t.all) await expect(p.getByText('0 of 3 answered')).toBeVisible();
  await A.getByRole('radio', { name: 'Retro rating 4' }).check();
  await A.getByRole('radio', { name: 'Tool rating 5' }).check();
  await A.getByLabel('Comment about the retrospective (optional)').fill('liked the pacing');
  await A.getByRole('button', { name: 'Submit answers' }).click();
  await B.getByRole('radio', { name: 'Retro rating 2' }).check();
  await B.getByRole('radio', { name: 'Tool rating 3' }).check();
  await B.getByLabel('Comment about the tool (optional)').fill('felt a bit slow');
  await B.getByRole('button', { name: 'Submit answers' }).click();
  for (const p of t.all) await expect(p.getByText('2 of 3 answered')).toBeVisible();
  for (const p of t.all) await expect(p.getByText('Survey results')).toHaveCount(0);

  // A changes the rating: the count stays 2
  await A.getByRole('radio', { name: 'Retro rating 5' }).check();
  await A.getByRole('button', { name: 'Update answers' }).click();
  await expect(A.getByRole('button', { name: 'Update answers' })).toBeVisible();
  for (const p of t.all) await expect(p.getByText('2 of 3 answered')).toBeVisible();

  // F closes the survey and confirms: read-only forms and final results, without names
  await expect(A.getByRole('button', { name: 'Close survey' })).toHaveCount(0);
  await F.getByRole('button', { name: 'Close survey' }).click();
  await F.getByRole('dialog').getByRole('button', { name: 'Close survey' }).click();
  for (const p of t.all) {
    await expect(p.getByText('Survey results')).toBeVisible();
    await expect(p.getByRole('radio', { name: 'Retro rating 5' })).toBeDisabled();
    const results = p.locator('.survey-results');
    await expect(results.getByText('liked the pacing')).toBeVisible();
    await expect(results.getByText('felt a bit slow')).toBeVisible();
    await expect(results.getByText('Retrospective: average 3.5 (2 answers)')).toBeVisible();
    expect(await results.textContent()).not.toMatch(/Alex|Blake|Fiona/);
  }

  // the Facilitator's record keeps no participant ID or token next to any answer
  const record = await F.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('retro.host.'))!;
    return JSON.parse(localStorage.getItem(key)!).data;
  });
  const survey = JSON.stringify(record.state.extensions.contrib.survey);
  expect(survey).toContain('liked the pacing');
  for (const id of Object.keys(record.state.participants)) expect(survey).not.toContain(id);
  for (const token of Object.keys(record.tokens)) expect(survey).not.toContain(token);
  expect(Object.keys(record.state.extensions.contrib.survey.answers)).toHaveLength(2);
  await t.close();
});

test('J6 Offline writing: own entries stay, survive a reload and arrive once (AC-14, AC-20)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { A, B } = t;
  let { F } = t;
  await goTo(t, 'retro.write', 'Retrospective: Write silently');
  await addEntry(A, 'Start', 'before offline');

  await F.close();
  await expect(A.getByText(/The Facilitator is offline/)).toBeVisible({ timeout: 60_000 });

  await A.getByLabel('New entry for Stop').fill('while offline');
  await A.getByRole('button', { name: 'Add entry to Stop' }).click();
  await card(A, 'before offline').getByRole('button', { name: 'Edit entry' }).click();
  await A.getByLabel('Entry text').fill('before offline, edited');
  await A.getByRole('button', { name: 'Save' }).click();
  await expect(A.getByText('while offline')).toBeVisible();
  await expect(A.getByText('before offline, edited')).toBeVisible();

  await A.reload();
  await expect(A.getByText('while offline')).toBeVisible();
  await expect(A.getByText('before offline, edited')).toBeVisible();

  // the Facilitator resumes on the same device: the entries arrive once
  F = await t.ctxF.newPage();
  await F.goto('/');
  await F.getByRole('button', { name: 'Resume session' }).click();
  await expect(F.getByRole('heading', { name: 'Retrospective: Write silently' })).toBeVisible();
  await expect(A.getByText(/The Facilitator is offline/)).toHaveCount(0, { timeout: 60_000 });
  await reveal(F);
  await expect(B.getByText('while offline', { exact: true })).toHaveCount(1);
  await expect(B.getByText('before offline, edited', { exact: true })).toHaveCount(1);
  await expect(A.getByText('while offline', { exact: true })).toHaveCount(1);
  await t.close();
});

test('J7 The Facilitator removes content of a participant (AC-16)', async ({ browser }) => {
  const t = await startedTeam(browser);
  const { F, A } = t;
  await goTo(t, 'retro.write', 'Retrospective: Write silently');
  await addEntry(A, 'Start', 'remove this entry');
  await reveal(F);
  await goTo(t, 'notes', 'Discussion notes');
  await A.getByLabel('New note').fill('remove this note');
  await A.getByRole('button', { name: 'Add note' }).click();
  await goTo(t, 'actions', 'Action items');
  await A.getByLabel('Action description').fill('remove this action');
  await A.getByRole('group', { name: 'Owners' }).getByLabel('Alex').check();
  await A.getByRole('button', { name: 'Save action item' }).click();

  await card(F, 'remove this action').getByRole('button', { name: 'Delete action item' }).click();
  await goTo(t, 'notes', 'Discussion notes');
  await card(F, 'remove this note').getByRole('button', { name: 'Delete note' }).click();
  await goTo(t, 'retro.discuss', 'Retrospective: Discuss');
  await card(F, 'remove this entry').getByRole('button', { name: 'Delete entry' }).click();

  for (const p of t.all) {
    await expect(p.getByText('remove this entry')).toHaveCount(0);
    await goTo(t, 'notes', 'Discussion notes');
    await expect(p.getByText('remove this note')).toHaveCount(0);
    await goTo(t, 'actions', 'Action items');
    await expect(p.getByText('remove this action')).toHaveCount(0);
    await goTo(t, 'retro.discuss', 'Retrospective: Discuss');
  }
  await t.close();
});

test('J8 An owner leaves the session: the action item keeps the name, their entries are hidden (AC-23)', async ({
  browser,
}) => {
  const t = await startedTeam(browser);
  const { F, A, B } = t;
  // B's check-in response, retro entry and note; A makes B an owner
  await B.getByLabel('Your check-in response').fill('blake check-in');
  await B.getByRole('button', { name: 'Add response' }).click();
  await reveal(F);
  await expect(A.getByText('blake check-in')).toBeVisible();
  await goTo(t, 'retro.write', 'Retrospective: Write silently');
  await addEntry(B, 'Start', 'blake retro entry');
  await reveal(F);
  await expect(A.getByText('blake retro entry')).toBeVisible();
  await goTo(t, 'notes', 'Discussion notes');
  await B.getByLabel('New note').fill('blake note stays');
  await B.getByRole('button', { name: 'Add note' }).click();
  await goTo(t, 'actions', 'Action items');
  await A.getByLabel('Action description').fill('Blake takes this');
  await A.getByRole('group', { name: 'Owners' }).getByLabel('Blake').check();
  await A.getByRole('button', { name: 'Save action item' }).click();
  await expect(F.getByText('Blake takes this')).toBeVisible();

  // F removes B
  await F.getByRole('button', { name: 'Remove Blake' }).click();
  await F.getByRole('dialog').getByRole('button', { name: 'Remove from session' }).click();
  await expect(B.getByRole('heading', { name: 'You were removed from the session' })).toBeVisible();

  await expect(card(A, 'Blake takes this').getByText('Owners: Blake')).toBeVisible();
  await expect(card(F, 'Blake takes this').getByText('Owners: Blake')).toBeVisible();
  await goTo({ ...t, all: [F, A] } as Team, 'notes', 'Discussion notes');
  await expect(A.getByText('blake note stays')).toBeVisible();
  await expect(F.getByText('blake note stays')).toBeVisible();
  await goTo({ ...t, all: [F, A] } as Team, 'retro.discuss', 'Retrospective: Discuss');
  await expect(A.getByText('blake retro entry')).toHaveCount(0);
  await expect(F.getByText('blake retro entry')).toHaveCount(0);
  await goTo({ ...t, all: [F, A] } as Team, 'checkIn', 'Check-in');
  await expect(A.getByText('blake check-in')).toHaveCount(0);
  await expect(F.getByText('blake check-in')).toHaveCount(0);
  await t.close();
});
