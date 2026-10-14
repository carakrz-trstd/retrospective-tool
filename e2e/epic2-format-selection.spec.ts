import { expect, test, type Page, type Request } from '@playwright/test';

// The format selection needs no signaling server and no network: it runs against the production
// build served by `vite preview`. The real 12 library formats are used.
const LIBRARY = [
  'Start-Stop-Continue',
  'Mad-Sad-Glad',
  '4Ls',
  'Sailboat',
  'Starfish',
  'Plus/Delta',
  'Rose-Thorn-Bud',
  'Timeline',
  'Three Little Pigs',
  'Hot Air Balloon',
  'Kudos Cards',
  'Speed Car',
];

const CALM = ['Tired', 'Reflect on the period since the last retro', '30 minutes', 'Lean', 'Remote'];
const LIVELY = ['Energized', 'Bond as a team', '80 minutes', 'Extensive', 'In the same room'];

async function answer(page: Page, names: string[]) {
  for (const name of names) await page.getByRole('radio', { name }).check();
}

async function expectHandover(page: Page, formatName: string, minutes: number) {
  const section = page.getByRole('heading', { name: 'Chosen format' }).locator('xpath=ancestor::section');
  await expect(section).toContainText(formatName);
  await expect(section).toContainText(`${minutes} min`);
}

test('J1 Recommendation: questions, suggestion with alternatives, details and hand-over (AC-1..AC-5, AC-14)', async ({
  page,
}) => {
  await page.goto('/#/new');
  await expect(page.getByRole('heading', { name: 'Choose a retrospective format' })).toBeVisible();

  // nothing answered: the button is disabled and the missing questions are marked (AC-2)
  await expect(page.getByRole('button', { name: 'Show recommendation' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  // aria-disabled keeps the button clickable for people: the click marks the missing questions
  await page.getByRole('button', { name: 'Show recommendation' }).click({ force: true });
  await expect(page.getByText('Please answer this question.')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Our suggestion' })).toHaveCount(0);
  await expect(page.getByRole('group')).toHaveCount(5); // AC-1: exactly 5 questions

  await answer(page, CALM);
  await page.getByRole('button', { name: 'Show recommendation' }).click();
  await expect(page.getByRole('heading', { name: 'Our suggestion' })).toBeVisible();

  // one recommended card and 1-2 alternatives, each with reasons and the 30-minute time split
  const cards = page.getByRole('article');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(3);
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i).getByText('Why it fits')).toBeVisible();
    await expect(cards.nth(i).getByText('Suggested time: 30 min')).toBeVisible();
  }
  await expect(cards.first().getByText('Recommended')).toBeVisible();
  const firstName = (await cards.first().getByRole('heading', { level: 3 }).textContent())!;

  // details of the recommended format
  await cards.first().getByRole('button', { name: 'See details' }).click();
  await expect(page.getByRole('heading', { level: 2, name: firstName })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Columns' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Check-in question' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tips for the Facilitator' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  // use it: the hand-over shows the format name, its columns and "30 min"
  await page.getByRole('article').first().getByRole('button', { name: 'Use this format' }).click();
  await expectHandover(page, firstName, 30);

  // a second, very different answer set recommends a different format that fits 80 minutes
  await page.getByRole('button', { name: 'Change format' }).click();
  await answer(page, LIVELY);
  await page.getByRole('button', { name: 'Show recommendation' }).click();
  await expect(page.getByRole('heading', { name: 'Our suggestion' })).toBeVisible();
  const secondName = (await page
    .getByRole('article')
    .first()
    .getByRole('heading', { level: 3 })
    .textContent())!;
  expect(secondName).not.toBe(firstName);
  await expect(page.getByRole('article').first().getByText('Suggested time: 80 min')).toBeVisible();
  await page.getByRole('article').first().getByRole('button', { name: 'Use this format' }).click();
  await expectHandover(page, secondName, 80);
});

test('J1b No weak-match note for a normal answer set (negative side of AC-20)', async ({ page }) => {
  await page.goto('/#/new');
  await answer(page, CALM);
  await page.getByRole('button', { name: 'Show recommendation' }).click();
  await expect(page.getByRole('heading', { name: 'Our suggestion' })).toBeVisible();
  await expect(page.getByText('Not a perfect fit, but closest to your answers')).toHaveCount(0);
});

test('J2 Library: 12 formats, details, and asking for the time (AC-6, AC-7, AC-8)', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Browse all formats' }).click();
  await expect(page.getByRole('heading', { name: 'All formats' })).toBeVisible();
  const names = await page.getByRole('article').getByRole('heading', { level: 3 }).allTextContents();
  expect([...names].sort()).toEqual([...LIBRARY].sort());

  await page.getByRole('article', { name: 'Starfish' }).getByRole('button', { name: 'See details' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Starfish' })).toBeVisible();
  for (const column of ['Keep doing', 'Less of', 'More of', 'Start doing', 'Stop doing']) {
    await expect(page.getByRole('listitem').filter({ hasText: column }).first()).toBeVisible();
  }
  await expect(page.getByText('Suggested time: 50 min')).toBeVisible();
  await expect(page.getByText('Suggested time: 80 min')).toBeVisible();
  await expect(page.getByText('Suggested time: 30 min')).toHaveCount(0);

  // no time answered yet: the time step offers only 50 and 80 for Starfish
  await page.getByRole('button', { name: 'Use this format' }).click();
  await expect(page.getByRole('heading', { name: 'How much time do you have?' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(2);
  await expect(page.getByRole('radio', { name: '30 min' })).toHaveCount(0);
  await page.getByRole('radio', { name: '50 min' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectHandover(page, 'Starfish', 50);
});

test('J3 Custom format: from scratch and as a copy of Starfish (AC-9..AC-13, AC-21)', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Create custom format' }).click();
  await expect(page.getByLabel('Column 1 name')).toHaveValue('');
  await expect(page.getByLabel('Column 2 name')).toHaveValue('');

  // empty names: inline messages and no hand-over (AC-10)
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByText('Please give this column a name.')).toHaveCount(2);

  // add columns until the button is disabled at 4 (AC-10)
  await page.getByRole('button', { name: 'Add column' }).click();
  await page.getByRole('button', { name: 'Add column' }).click();
  await expect(page.getByRole('button', { name: 'Add column' })).toBeDisabled();
  await expect(page.getByLabel('Column 5 name')).toHaveCount(0);
  for (const [i, name] of ['Ideas', 'Problems', 'Kudos', 'Questions'].entries()) {
    await page.getByLabel(`Column ${i + 1} name`).fill(name);
  }

  // another check-in question (AC-12)
  const select = page.getByLabel('Check-in question');
  const options = await select.locator('option').allTextContents();
  await select.selectOption({ index: 2 });
  await expect(select).toHaveValue(options[2]!);

  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'How much time do you have?' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(3); // a custom format offers all three
  await page.getByRole('radio', { name: '50 min' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  const section = page.getByRole('heading', { name: 'Chosen format' }).locator('xpath=ancestor::section');
  await expect(section).toContainText('Ideas · Problems · Kudos · Questions');

  // as a copy of Starfish: 5 columns kept, nothing can be added, one can be removed (AC-11, AC-21)
  await page.getByRole('button', { name: 'Change format' }).click();
  await page.getByRole('button', { name: 'Browse all formats' }).click();
  await page.getByRole('article', { name: 'Starfish' }).getByRole('button', { name: 'See details' }).click();
  await page.getByRole('button', { name: 'Use as basis' }).click();
  await expect(page.getByLabel('Column 5 name')).toHaveValue('Stop doing');
  await expect(page.getByRole('button', { name: 'Add column' })).toBeDisabled();
  await page.getByRole('button', { name: 'Remove column 5' }).click();
  await expect(page.getByLabel('Column 5 name')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add column' })).toBeDisabled(); // the limit is 4
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('radio', { name: '80 min' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  const copy = page.getByRole('heading', { name: 'Chosen format' }).locator('xpath=ancestor::section');
  await expect(copy).toContainText('Keep doing · Less of · More of · Start doing');
  await expect(copy).not.toContainText('Stop doing');

  // the library's Starfish still has 5 columns (AC-11)
  await page.getByRole('button', { name: 'Change format' }).click();
  await page.getByRole('button', { name: 'Browse all formats' }).click();
  await page.getByRole('article', { name: 'Starfish' }).getByRole('button', { name: 'See details' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Stop doing' }).first()).toBeVisible();

  // a reload loses the custom format: the flow starts again (AC-13)
  await page.goto('/#/create');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choose a retrospective format' })).toBeVisible();
});

test('Privacy: only the app origin is contacted and nothing is stored on the device (AC-13, AC-19)', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (r: Request) => {
    if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('data:')) foreign.push(r.url());
  });
  await page.goto('/#/new');
  await answer(page, CALM);
  await page.getByRole('button', { name: 'Show recommendation' }).click();
  await expect(page.getByRole('heading', { name: 'Our suggestion' })).toBeVisible();
  await page.getByRole('button', { name: 'Create custom format' }).click();
  await page.getByLabel('Column 1 name').fill('Ideas');
  await page.getByLabel('Column 2 name').fill('Problems');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Chosen format' })).toBeVisible();

  expect(foreign).toEqual([]);
  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(stored).toEqual({ local: [], session: [] });
});
