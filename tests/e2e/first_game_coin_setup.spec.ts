import { expect, test } from '@playwright/test';

test.describe('E2E: first game setup invariants across game 1 -> game 2', () => {
  test.skip(
    process.env.CI !== 'true' && process.env.PW_REAL_E2E !== '1',
    'Set PW_REAL_E2E=1 (or run in CI) to execute real browser journey.'
  );

  test('game 1 setup state is stable and game 2 increments campaign game number once', async ({ browser }) => {
    const campaignName = `PW First Game ${Date.now()}`;

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

    const game1Snapshot = await hostPage.evaluate(() => {
      const state = window.__RISK_LEGACY_E2E__?.getGameState();
      return {
        gameNumber: state?.gameNumber ?? -1,
        phase: state?.phase,
        status: state?.status,
        cardCounts: state?.players?.map((p) => p.cards.length) ?? [],
      };
    });

    expect(game1Snapshot.gameNumber).toBe(1);
    expect(game1Snapshot.phase).toBe('RECRUIT');
    expect(game1Snapshot.status).toBe('active');
    expect(game1Snapshot.cardCounts.every((count) => count === 0)).toBe(true);

    await hostPage.evaluate(() => {
      window.__RISK_LEGACY_E2E__?.declareVictory('player-1', 'stars');
    });

    await expect(hostPage.getByRole('heading', { name: 'Victory!' })).toBeVisible();
    await hostPage.getByRole('button', { name: /Continue to Write Phase/i }).click();
    await hostPage.getByRole('button', { name: /Skip Rewards/i }).click();
    await hostPage.getByRole('button', { name: /Finish Game/i }).click();

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

    const game2Snapshot = await hostPage.evaluate(() => {
      const state = window.__RISK_LEGACY_E2E__?.getGameState();
      return {
        gameNumber: state?.gameNumber ?? -1,
        phase: state?.phase,
        subPhase: state?.subPhase,
        cardCounts: state?.players?.map((p) => p.cards.length) ?? [],
      };
    });

    expect(game2Snapshot.gameNumber).toBe(2);
    expect(game2Snapshot.phase).toBe('SETUP');
    expect(game2Snapshot.subPhase).toBe('FACTION_SELECTION');
    expect(game2Snapshot.cardCounts.every((count) => count === 0)).toBe(true);

    await hostContext.close();
    await guestContext.close();
  });
});
