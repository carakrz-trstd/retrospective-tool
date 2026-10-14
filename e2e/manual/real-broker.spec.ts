import { expect, test } from '@playwright/test';

// Manual check (see docs/network-check.md): create and join through the REAL public PeerJS broker.
// Run from the company network. Not part of the normal e2e run.
test('create and join through the real public broker', async ({ browser }) => {
  const ctxF = await browser.newContext();
  const ctxA = await browser.newContext();
  const F = await ctxF.newPage();
  const A = await ctxA.newPage();

  await F.goto('/');
  await F.getByRole('button', { name: 'Create session' }).first().click();
  await F.getByLabel('Your name').fill('Fiona');
  await F.getByLabel('Your role').fill('Scrum Master');
  await F.getByRole('button', { name: 'Create session' }).last().click();
  await expect(F.getByRole('heading', { name: /^Lobby/ })).toBeVisible({ timeout: 30_000 });
  const link = await F.getByRole('textbox', { name: 'Join link' }).inputValue();

  await A.goto(link);
  await A.getByLabel('Your name').fill('Alex');
  await A.getByLabel('Your role').fill('Developer');
  await A.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(A.getByText('Waiting for the Facilitator to start the session…')).toBeVisible({
    timeout: 30_000,
  });
  await expect(F.getByText('Alex', { exact: true })).toBeVisible();

  await ctxF.close();
  await ctxA.close();
});
