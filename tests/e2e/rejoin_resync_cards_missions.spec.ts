import { expect, test } from '@playwright/test';

test.describe('E2E: rejoin and resync during setup transitions', () => {
  test.skip(
    process.env.CI !== 'true' && process.env.PW_REAL_E2E !== '1',
    'Set PW_REAL_E2E=1 (or run in CI) to execute real browser journey.'
  );

  test('dropped player rejoins during HQ setup and converges on authoritative state', async ({ browser }) => {
    const campaignName = `PW Rejoin ${Date.now()}`;

    const hostContext = await browser.newContext();
    let guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    let guestPage = await guestContext.newPage();

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
    await expect(guestPage.getByRole('heading', { name: /PLACE YOUR HEADQUARTERS/i })).toBeVisible();

    const guestStorageState = await guestContext.storageState();
    await guestContext.close();

    guestContext = await browser.newContext({ storageState: guestStorageState });
    guestPage = await guestContext.newPage();
    await guestPage.goto('/?e2e=1');

    await expect(guestPage.getByRole('heading', { name: /PLACE YOUR HEADQUARTERS/i })).toBeVisible({ timeout: 15000 });
    await guestPage.locator('svg #brazil').first().click({ force: true });
    await guestPage.getByRole('button', { name: 'Place Headquarters' }).click();

    await expect(hostPage.getByText('Troops to place:')).toBeVisible();
    await expect(guestPage.getByText("It's not your turn")).toBeVisible();

    const hostSnapshot = await hostPage.evaluate(() => {
      const state = window.__RISK_LEGACY_E2E__?.getGameState();
      return {
        gameNumber: state?.gameNumber ?? -1,
        status: state?.status,
        phase: state?.phase,
        subPhase: state?.subPhase,
        setupTurnIndex: state?.setupTurnIndex ?? -1,
        currentTurn: state?.currentTurn ?? -1,
        players: (state?.players ?? []).map((p) => ({
          id: p.id,
          cardsLength: p.cards.length,
          redStars: p.redStars,
          hqTerritory: p.hqTerritory,
        })),
      };
    });

    const guestSnapshot = await guestPage.evaluate(() => {
      const state = window.__RISK_LEGACY_E2E__?.getGameState();
      return {
        gameNumber: state?.gameNumber ?? -1,
        status: state?.status,
        phase: state?.phase,
        subPhase: state?.subPhase,
        setupTurnIndex: state?.setupTurnIndex ?? -1,
        currentTurn: state?.currentTurn ?? -1,
        players: (state?.players ?? []).map((p) => ({
          id: p.id,
          cardsLength: p.cards.length,
          redStars: p.redStars,
          hqTerritory: p.hqTerritory,
        })),
      };
    });

    expect(guestSnapshot).toEqual(hostSnapshot);
    expect(hostSnapshot.gameNumber).toBe(1);
    expect(hostSnapshot.phase).toBe('RECRUIT');
    expect(hostSnapshot.players.every((p) => p.cardsLength === 0)).toBe(true);

    await hostContext.close();
    await guestContext.close();
  });
});
