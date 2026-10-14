import { expect, type Page } from '@playwright/test';

export interface Invitation {
  link: string;
  code: string;
}

/** Answers the five questions, takes the suggestion and uses the recommended format. */
export async function pickRecommendedFormat(
  page: Page,
  answers = ['Tired', 'Reflect on the period since the last retro', '30 minutes', 'Lean', 'Remote'],
): Promise<string> {
  for (const name of answers) await page.getByRole('radio', { name }).check();
  await page.getByRole('button', { name: 'Show recommendation' }).click();
  await expect(page.getByRole('heading', { name: 'Our suggestion' })).toBeVisible();
  const first = page.getByRole('article').first();
  const name = (await first.getByRole('heading', { level: 3 }).textContent()) ?? '';
  await first.getByRole('button', { name: 'Use this format' }).click();
  await expect(page.getByRole('heading', { name: 'Chosen format' })).toBeVisible();
  return name;
}

/** The Facilitator chooses a format, creates a session and lands in the lobby. */
export async function createSession(
  page: Page,
  options: { name: string; role: string; title?: string },
): Promise<Invitation> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create session' }).first().click();
  await pickRecommendedFormat(page);
  await page.getByLabel('Your name').fill(options.name);
  await page.getByLabel('Your role').fill(options.role);
  if (options.title) await page.getByLabel('Session title (optional)').fill(options.title);
  await page.getByRole('button', { name: 'Create session' }).last().click();
  await expect(page.getByRole('heading', { name: /^Lobby/ })).toBeVisible();
  return {
    link: await page.getByRole('textbox', { name: 'Join link' }).inputValue(),
    code: await page.getByRole('textbox', { name: 'Join code' }).inputValue(),
  };
}

/** A participant joins through the join link (opened in the address bar). */
export async function joinByLink(page: Page, link: string, name: string, role: string): Promise<void> {
  await page.goto(link);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Your role').fill(role);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(
    page
      .getByText('Waiting for the Facilitator to start the session…')
      .or(page.getByRole('heading', { name: 'Session' })),
  ).toBeVisible();
}

/** A participant joins by typing the join code on the start page. */
export async function joinByCode(page: Page, code: string, name: string, role: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Join code or link').fill(code);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Your role').fill(role);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(
    page
      .getByText('Waiting for the Facilitator to start the session…')
      .or(page.getByRole('heading', { name: 'Session' })),
  ).toBeVisible();
}

export async function localStorageKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(localStorage));
}
