import { expect, test } from '@playwright/test';

test.describe('E2E: post-game persistence', () => {
  test.skip(
    process.env.CI !== 'true' && process.env.PW_REAL_E2E !== '1',
    'Set PW_REAL_E2E=1 (or run in CI) to execute real browser journey.'
  );

  test('winner applies scar/city and game 2 loads persisted map effects', async ({ browser }) => {
    const campaignName = `PW Persist ${Date.now()}`;

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto('/?e2e=1');
    await guestPage.goto('/?e2e=1');

    await hostPage.getByRole('button', { name: '+ Create Campaign' }).click();
    await hostPage.getByPlaceholder('Enter campaign name...').fill(campaignName);
    await hostPage.getByRole('button', { name: /^Create$/ }).click();

    await hostPage.getByRole('heading', { name: campaignName }).click();
    await hostPage.getByPlaceholder('Enter your guest name...').fill('Alice');
    await hostPage.getByRole('button', { name: 'Join Lobby' }).click();

    await guestPage.getByRole('heading', { name: campaignName }).click();
    await guestPage.getByPlaceholder('Enter your guest name...').fill('Bob');
    await guestPage.getByRole('button', { name: 'Join Lobby' }).click();

    await guestPage.getByRole('button', { name: 'Click to Ready Up' }).click();
    await hostPage.getByRole('button', { name: 'Start Game' }).click();

    await hostPage.getByRole('button', { name: /Die Mechaniker/i }).click();
    await hostPage.getByRole('button', { name: /Fortify HQ/i }).click();
    await hostPage.getByRole('button', { name: 'Confirm Selection' }).click();

    await guestPage.getByRole('button', { name: /Enclave of the Bear/i }).click();
    await guestPage.getByRole('button', { name: /Ferocity/i }).click();
    await guestPage.getByRole('button', { name: 'Confirm Selection' }).click();

    await hostPage.locator('svg #alaska').first().click({ force: true });
    await hostPage.getByRole('button', { name: 'Place Headquarters' }).click();

    await guestPage.locator('svg #brazil').first().click({ force: true });
    await guestPage.getByRole('button', { name: 'Place Headquarters' }).click();

    await expect(hostPage.getByText('Troops to place:')).toBeVisible();

    await hostPage.evaluate(() => {
      window.__RISK_LEGACY_E2E__?.declareVictory('player-1', 'stars');
    });

    await expect(hostPage.getByRole('heading', { name: 'Victory!' })).toBeVisible();

    await hostPage.getByRole('button', { name: /Found or Upgrade a City/i }).click();
    await hostPage.getByRole('button', { name: /^Alaska/i }).click();
    await hostPage.getByPlaceholder('Enter city name...').fill('New Anchorage');
    await hostPage.getByRole('button', { name: /Continue to Scar/i }).click();

    await hostPage.getByRole('button', { name: /Bunker/i }).click();
    await hostPage.getByRole('button', { name: /^Brazil$/i }).click();
    await hostPage.getByRole('button', { name: /^Continue$/i }).click();
    await hostPage.getByRole('button', { name: /Finish Game/i }).click();

    // Reset socket/lobby session after game-complete transition to avoid stale "already in lobby" joins.
    await hostPage.reload();
    await guestPage.reload();

    await expect(hostPage.getByRole('heading', { name: 'Campaign Browser' })).toBeVisible();
    await hostPage.getByRole('heading', { name: campaignName }).click();
    const hostPromptVisible = await hostPage.getByRole('heading', { name: 'Join Campaign' }).isVisible().catch(() => false);
    if (hostPromptVisible) {
      await hostPage.getByPlaceholder('Enter your guest name...').fill('Alice');
      await hostPage.getByRole('button', { name: 'Join Lobby' }).click();
    }
    await expect(hostPage.getByRole('heading', { name: 'Game Lobby' })).toBeVisible({ timeout: 15000 });

    const guestInLobby = await guestPage.getByRole('heading', { name: 'Game Lobby' }).isVisible().catch(() => false);
    if (!guestInLobby) {
      await guestPage.getByRole('heading', { name: 'Campaign Browser' }).waitFor({ state: 'visible' });
      await guestPage.getByRole('heading', { name: campaignName }).click();
      const guestPromptVisible = await guestPage.getByRole('heading', { name: 'Join Campaign' }).isVisible().catch(() => false);
      if (guestPromptVisible) {
        await guestPage.getByPlaceholder('Enter your guest name...').fill('Bob');
        await guestPage.getByRole('button', { name: 'Join Lobby' }).click();
      }
      await expect(guestPage.getByRole('heading', { name: 'Game Lobby' })).toBeVisible();
    }

    await guestPage.getByRole('button', { name: 'Click to Ready Up' }).click();
    await hostPage.getByRole('button', { name: 'Start Game' }).click();

    await expect(hostPage.getByRole('heading', { name: 'CHOOSE YOUR FACTION' })).toBeVisible();

    const persisted = await hostPage.evaluate(() => {
      const state = window.__RISK_LEGACY_E2E__?.getGameState();
      return {
        cityTier: state?.territories?.alaska?.cityTier ?? 0,
        cityName: state?.territories?.alaska?.cityName ?? null,
        scarId: state?.territories?.brazil?.scarId ?? null,
      };
    });

    expect(persisted.cityTier).toBe(1);
    expect(persisted.cityName).toBe('New Anchorage');
    expect(persisted.scarId).toBe('bunker');

    await hostContext.close();
    await guestContext.close();
  });
});
