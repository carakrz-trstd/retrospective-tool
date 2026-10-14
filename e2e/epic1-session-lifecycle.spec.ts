import { expect, test, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';
import { createSession, joinByCode, joinByLink, localStorageKeys, type Invitation } from './helpers';

// One serial run through the journeys of Epic 1: Facilitator F "Fiona", participants A "Alex", B "Alex" (same name on
// purpose) and later C and D. The e2e build uses a local signaling server (see playwright.config.ts).
test.describe.configure({ mode: 'serial' });

let browser: Browser;
let ctxF: BrowserContext;
let ctxA: BrowserContext;
let ctxB: BrowserContext;
let F: Page;
let A: Page;
let B: Page;
let invitation: Invitation;
const foreignRequests: string[] = [];

function isAllowed(req: Request): boolean {
  const url = req.url();
  return (
    url.startsWith('http://localhost:4173') ||
    url.startsWith('http://localhost:9000') ||
    url.startsWith('ws://localhost:9000') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  );
}

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  ctxF = await browser.newContext();
  ctxA = await browser.newContext();
  ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  F = await ctxF.newPage();
  A = await ctxA.newPage();
  B = await ctxB.newPage();
  for (const p of [F, A, B]) p.on('request', (r) => !isAllowed(r) && foreignRequests.push(r.url()));
});

test.afterAll(async () => {
  await ctxF.close();
  await ctxA.close();
  await ctxB.close();
});

test('J1 Create: the Facilitator creates a session (AC-1, AC-2, AC-5, AC-16, AC-26)', async () => {
  await F.goto('/');
  await expect(F.getByText(/internal use only/i)).toBeVisible();
  await F.getByRole('button', { name: 'Create session' }).first().click();
  await F.getByRole('button', { name: 'Create session' }).last().click();
  await expect(F.getByText('Please enter your name.')).toBeVisible();
  await F.getByLabel('Your name').fill('Fiona');
  await F.getByRole('button', { name: 'Create session' }).last().click();
  await expect(F.getByText('Please enter your role.')).toBeVisible();
  await F.getByLabel('Your role').fill('Scrum Master');
  await F.getByLabel('Session title (optional)').fill('Team Alpha');
  await F.getByRole('button', { name: 'Create session' }).last().click();
  await expect(F.getByRole('heading', { name: /Lobby: Team Alpha/ })).toBeVisible();

  const link = await F.getByRole('textbox', { name: 'Join link' }).inputValue();
  const code = await F.getByRole('textbox', { name: 'Join code' }).inputValue();
  expect(link).toContain('#/join/');
  expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
  await expect(F.getByRole('button', { name: 'Copy join link' })).toBeVisible();
  await expect(F.getByRole('button', { name: 'Copy join code' })).toBeVisible();
  await expect(F.getByText('Facilitator', { exact: true })).toBeVisible();
  invitation = { link, code };
});

test('J2 Join: participants join by link and by code (AC-3, AC-4, AC-6, AC-19, AC-20, AC-27)', async () => {
  await A.goto(invitation.link);
  await expect(A.getByText(/invitation link/)).toBeVisible();
  await A.getByLabel('Your name').fill('Alex');
  await A.getByLabel('Your role').fill('Developer');
  await A.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(A.getByText('Waiting for the Facilitator to start the session…')).toBeVisible();
  await expect(A.getByText('Fiona')).toBeVisible();
  expect(A.url()).not.toContain(invitation.link.split('#/join/')[1]!);
  await expect(F.getByText('Alex', { exact: true })).toBeVisible(); // appears without reload

  // an unknown code
  await B.goto('/');
  await B.getByLabel('Join code or link').fill('ZZZZZZ');
  await B.getByRole('button', { name: 'Join', exact: true }).click();
  await B.getByLabel('Your name').fill('Alex');
  await B.getByLabel('Your role').fill('Tester');
  await B.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(B.getByText(/This session cannot be found/)).toBeVisible();

  // the right code, same name as A: shown with a suffix
  await joinByCode(B, invitation.code, 'Alex', 'Tester');
  await expect(F.getByText('Alex (2)')).toBeVisible();
  await expect(B.getByText('Alex (2)')).toBeVisible();
  const noOverflow = await B.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);

  // name and role are remembered on this device, and "Forget me" clears them (same browser, new page)
  const A2 = await ctxA.newPage();
  await A2.goto(invitation.link);
  await expect(A2.getByLabel('Your name')).toHaveValue('Alex');
  await expect(A2.getByLabel('Your role')).toHaveValue('Developer');
  await A2.getByRole('button', { name: 'Forget me' }).click();
  await expect(A2.getByLabel('Your name')).toHaveValue('');
  await A2.close();
});

test('J3 Start: only the Facilitator can start; everybody moves into the session (AC-7)', async () => {
  await expect(A.getByRole('button', { name: 'Start session' })).toHaveCount(0);
  await F.getByRole('button', { name: 'Start session' }).click();
  for (const p of [F, A, B]) await expect(p.getByRole('heading', { name: /^Session/ })).toBeVisible();
});

test('J4 Late join: a team member joins a running session (AC-9)', async () => {
  const ctxC = await browser.newContext();
  const C = await ctxC.newPage();
  await joinByLink(C, invitation.link, 'Casey', 'Designer');
  await expect(C.getByRole('heading', { name: /^Session/ })).toBeVisible();
  await expect(F.getByText('Casey')).toBeVisible();
  await ctxC.close();
});

test('J5 Reload: a participant comes back as the same person (AC-10, AC-11)', async () => {
  await A.reload();
  await expect(A.getByRole('heading', { name: /^Session/ })).toBeVisible();
  await expect(F.getByText('Alex', { exact: true })).toHaveCount(1);
  await expect(F.getByText('online').first()).toBeVisible();
});

test('J6 Host resume, Facilitator offline and take over (AC-12, AC-13, AC-24, AC-25, AC-28)', async () => {
  // a browser without local data is not offered a resume (AC-25)
  const ctxX = await browser.newContext();
  const X = await ctxX.newPage();
  await X.goto('/');
  await expect(X.getByRole('button', { name: 'Resume session' })).toHaveCount(0);
  await ctxX.close();

  // the Facilitator closes the page; participants see "Facilitator offline" and, after 15 minutes, the hint
  await A.clock.install();
  await A.reload();
  await expect(A.getByRole('heading', { name: /^Session/ })).toBeVisible();
  await F.close();
  await expect(A.getByText(/The Facilitator is offline/)).toBeVisible();
  await A.clock.fastForward('15:00');
  await expect(A.getByTestId('long-offline-hint')).toBeVisible();
  await expect(
    A.getByTestId('long-offline-hint').getByRole('button', { name: 'Leave session' }),
  ).toBeVisible();

  // the Facilitator reopens the tool on the same device and resumes with the same link
  F = await ctxF.newPage();
  await F.goto('/');
  await F.getByRole('button', { name: 'Resume session' }).click();
  await expect(F.getByRole('heading', { name: /^Session/ })).toBeVisible();
  await expect(A.getByText(/The Facilitator is offline/)).toHaveCount(0, { timeout: 60_000 });
  await expect(A.getByTestId('long-offline-hint')).toHaveCount(0);

  // the same session in a second tab of the same browser: "Take over"
  const F2 = await ctxF.newPage();
  await F2.goto('/');
  await F2.getByRole('button', { name: 'Resume session' }).click();
  const dialog = F2.getByRole('dialog', { name: 'This session is open in another tab' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Take over' }).click();
  await expect(F2.getByRole('heading', { name: /^Session/ })).toBeVisible();
  await expect(F.getByText(/now hosted in another tab/)).toBeVisible();
  await F.close();
  F = F2;
  await expect(A.getByRole('heading', { name: /^Session/ })).toBeVisible();
});

test('J7 Remove: the Facilitator removes a participant (AC-29, AC-30)', async () => {
  await F.getByRole('button', { name: 'Remove Alex (2)' }).click();
  await F.getByRole('dialog').getByRole('button', { name: 'Remove from session' }).click();
  await expect(B.getByRole('heading', { name: 'You were removed from the session' })).toBeVisible();
  await expect(F.getByText('Alex (2)')).toHaveCount(0);
  await expect(A.getByText('Alex (2)')).toHaveCount(0);
  // the removed device has no record to rejoin with
  await B.getByRole('button', { name: 'Back to the start page' }).click();
  await expect(B.getByRole('button', { name: 'Rejoin session' })).toHaveCount(0);
  const keys = await localStorageKeys(B);
  expect(keys.filter((k) => k.startsWith('retro.participant.'))).toEqual([]);
});

test('J8 End: the Facilitator ends the session for everyone (AC-14, AC-15)', async () => {
  await F.getByRole('button', { name: 'End session' }).click();
  await F.getByRole('dialog').getByRole('button', { name: 'End session' }).click();
  await expect(A.getByRole('heading', { name: 'The session has ended' })).toBeVisible();
  await expect(F.getByRole('heading', { name: 'The session has ended' })).toBeVisible();
  expect((await localStorageKeys(A)).some((k) => k.startsWith('retro.participant.'))).toBe(true); // kept until the person leaves
  await A.getByRole('button', { name: 'Done: remove this session from this device' }).click();
  await expect(A.getByRole('button', { name: 'Create session' })).toBeVisible();
  expect((await localStorageKeys(A)).filter((k) => k.startsWith('retro.participant.'))).toEqual([]);
  // a new person cannot join an ended session
  const ctxN = await browser.newContext();
  const N = await ctxN.newPage();
  await N.goto(invitation.link);
  await N.getByLabel('Your name').fill('Nora');
  await N.getByLabel('Your role').fill('Dev');
  await N.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(N.getByText(/already ended|cannot be found/)).toBeVisible();
  await ctxN.close();
});

test('Privacy: only the app origin and the local signaling server are contacted (AC-17)', async () => {
  expect(foreignRequests).toEqual([]);
});
