import { expect, type Page } from '@playwright/test';

export interface Invitation {
  link: string;
  code: string;
}

/** The Facilitator creates a session and lands in the lobby. */
export async function createSession(
  page: Page,
  options: { name: string; role: string; title?: string },
): Promise<Invitation> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create session' }).first().click();
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
