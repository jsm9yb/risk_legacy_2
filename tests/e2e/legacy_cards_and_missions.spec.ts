import { expect, test } from '@playwright/test';

test.describe('E2E: multiplayer setup journey', () => {
  test.skip(
    process.env.CI !== 'true' && process.env.PW_REAL_E2E !== '1',
    'Set PW_REAL_E2E=1 (or run in CI) to execute real browser journey.'
  );

  test('create campaign, two players join, start game, complete faction + HQ setup', async ({ browser }) => {
    const nameSuffix = `${Date.now()}`;
    const campaignName = `PW Campaign ${nameSuffix}`;

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto('/');
    await expect(hostPage.getByRole('heading', { name: 'Campaign Browser' })).toBeVisible();

    await hostPage.getByRole('button', { name: '+ Create Campaign' }).click();
    await hostPage.getByPlaceholder('Enter campaign name...').fill(campaignName);
    await hostPage.getByRole('button', { name: /^Create$/ }).click();

    await hostPage.getByRole('heading', { name: campaignName }).click();
    await hostPage.getByPlaceholder('Enter your guest name...').fill('Alice');
    await hostPage.getByRole('button', { name: 'Join Lobby' }).click();

    await expect(hostPage.getByRole('heading', { name: campaignName })).toBeVisible();
    await expect(hostPage.getByRole('heading', { name: 'Game Lobby' })).toBeVisible();

    await guestPage.goto('/');
    await expect(guestPage.getByRole('heading', { name: 'Campaign Browser' })).toBeVisible();

    await guestPage.getByRole('heading', { name: campaignName }).click();
    await guestPage.getByPlaceholder('Enter your guest name...').fill('Bob');
    await guestPage.getByRole('button', { name: 'Join Lobby' }).click();

    await expect(guestPage.getByRole('heading', { name: campaignName })).toBeVisible();
    await guestPage.getByRole('button', { name: 'Click to Ready Up' }).click();

    await hostPage.getByRole('button', { name: 'Start Game' }).click();

    await expect(hostPage.getByRole('heading', { name: 'CHOOSE YOUR FACTION' })).toBeVisible();
    await hostPage.getByRole('button', { name: /Die Mechaniker/i }).click();
    await hostPage.getByRole('button', { name: /Fortify HQ/i }).click();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();

    await expect(guestPage.getByRole('heading', { name: 'CHOOSE YOUR FACTION' })).toBeVisible();
    await guestPage.getByRole('button', { name: /Enclave of the Bear/i }).click();
    await guestPage.getByRole('button', { name: /Ferocity/i }).click();
    await guestPage.getByRole('button', { name: 'Confirm Selection' }).click();

    await expect(hostPage.getByRole('heading', { name: /PLACE YOUR HEADQUARTERS/i })).toBeVisible();
    await hostPage.locator('svg #alaska').first().click({ force: true });
    await hostPage.getByRole('button', { name: 'Place Headquarters' }).click();

    await expect(guestPage.getByRole('heading', { name: /PLACE YOUR HEADQUARTERS/i })).toBeVisible();
    await guestPage.locator('svg #brazil').first().click({ force: true });
    await guestPage.getByRole('button', { name: 'Place Headquarters' }).click();

    await expect(hostPage.getByText('Troops to place:')).toBeVisible();
    await expect(guestPage.getByText("It's not your turn")).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });
});
