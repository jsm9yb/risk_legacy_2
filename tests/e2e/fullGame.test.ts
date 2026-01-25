/**
 * End-to-End Tests
 * Tests for: complete game flow in browser environment
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

describe('E2E: Full Game Flow', () => {
  let browser: Browser;
  let contexts: BrowserContext[];
  let pages: Page[];

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    contexts = [];
    pages = [];

    // Create 3 browser contexts (simulates 3 different users)
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext();
      contexts.push(context);
      pages.push(await context.newPage());
    }
  });

  afterEach(async () => {
    await Promise.all(contexts.map((c) => c.close()));
  });

  // ============================================
  // LOBBY FLOW
  // ============================================
  describe('Lobby Flow', () => {
    it('should allow creating and joining a game', async () => {
      const [host, player2, player3] = pages;

      // Host creates game
      await host.goto('http://localhost:3000');
      await host.click('[data-testid="create-game-button"]');
      await host.fill('[data-testid="game-name-input"]', 'E2E Test Game');
      await host.click('[data-testid="create-game-submit"]');

      // Get invite code
      const inviteCode = await host.textContent('[data-testid="invite-code"]');
      expect(inviteCode).toBeTruthy();

      // Player 2 joins
      await player2.goto('http://localhost:3000');
      await player2.click('[data-testid="join-game-button"]');
      await player2.fill('[data-testid="invite-code-input"]', inviteCode!);
      await player2.click('[data-testid="join-game-submit"]');

      // Player 3 joins
      await player3.goto('http://localhost:3000');
      await player3.click('[data-testid="join-game-button"]');
      await player3.fill('[data-testid="invite-code-input"]', inviteCode!);
      await player3.click('[data-testid="join-game-submit"]');

      // Verify all 3 players visible in lobby
      await expect(host.locator('[data-testid="player-list"] li')).toHaveCount(3);
    });

    it('should start game when all players ready', async () => {
      const [host, player2, player3] = pages;

      // Setup: Create and join game
      await setupLobby(host, player2, player3);

      // All players ready up
      await host.click('[data-testid="ready-button"]');
      await player2.click('[data-testid="ready-button"]');
      await player3.click('[data-testid="ready-button"]');

      // Host starts game
      await host.click('[data-testid="start-game-button"]');

      // Verify setup phase started
      await expect(host.locator('[data-testid="phase-indicator"]')).toContainText('Setup');
    });
  });

  // ============================================
  // SETUP FLOW
  // ============================================
  describe('Setup Flow', () => {
    it('should complete faction selection', async () => {
      const [host, player2, player3] = pages;
      await startGame(host, player2, player3);

      // Wait for faction selection phase
      await host.waitForSelector('[data-testid="faction-select"]');

      // Each player selects faction (in turn order)
      const turnOrderPlayer = await getCurrentTurnPage(pages);

      await turnOrderPlayer.click('[data-testid="faction-khan"]');
      await turnOrderPlayer.click('[data-testid="power-option-a"]');
      await turnOrderPlayer.click('[data-testid="confirm-faction"]');

      // Next player's turn
      const nextPlayer = await getCurrentTurnPage(pages);
      expect(nextPlayer).not.toBe(turnOrderPlayer);
    });

    it('should complete HQ placement', async () => {
      const [host, player2, player3] = pages;
      await startGame(host, player2, player3);
      await completeFactionSelection(pages);

      // Wait for HQ placement
      await host.waitForSelector('[data-testid="hq-placement"]');

      const turnPlayer = await getCurrentTurnPage(pages);

      // Valid territories should be highlighted
      const validTerritories = await turnPlayer.$$('[data-testid^="territory-"][data-valid="true"]');
      expect(validTerritories.length).toBeGreaterThan(0);

      // Click a valid territory
      await validTerritories[0].click();
      await turnPlayer.click('[data-testid="confirm-hq"]');

      // Verify HQ marker placed
      const hqMarker = await turnPlayer.$('[data-testid^="hq-marker"]');
      expect(hqMarker).toBeTruthy();
    });
  });

  // ============================================
  // TURN FLOW
  // ============================================
  describe('Turn Flow', () => {
    it('should complete a full turn cycle', async () => {
      const [host, player2, player3] = pages;
      await startActiveGame(host, player2, player3);

      const activePlayer = await getCurrentTurnPage(pages);

      // REINFORCE PHASE
      await expect(activePlayer.locator('[data-testid="phase-indicator"]')).toContainText('Reinforce');

      // Deploy troops
      const troopsToPlace = await activePlayer.textContent('[data-testid="troops-to-place"]');
      const ownTerritory = await activePlayer.$('[data-testid^="territory-"][data-owner="self"]');
      await ownTerritory?.click();
      await activePlayer.click('[data-testid="deploy-all"]');
      await activePlayer.click('[data-testid="end-placement"]');

      // ATTACK PHASE
      await expect(activePlayer.locator('[data-testid="phase-indicator"]')).toContainText('Attack');
      await activePlayer.click('[data-testid="end-attack-phase"]');

      // MANEUVER PHASE
      await expect(activePlayer.locator('[data-testid="phase-indicator"]')).toContainText('Maneuver');
      await activePlayer.click('[data-testid="skip-maneuver"]');

      // Turn should advance to next player
      const newActivePlayer = await getCurrentTurnPage(pages);
      expect(newActivePlayer).not.toBe(activePlayer);
    });

    it('should handle combat sequence', async () => {
      const [host, player2, player3] = pages;
      await startActiveGame(host, player2, player3);

      const attacker = await getCurrentTurnPage(pages);
      await advanceToAttackPhase(attacker);

      // Select attack source
      const sourceTerritory = await attacker.$('[data-testid^="territory-"][data-troops="5"][data-owner="self"]');
      await sourceTerritory?.click();

      // Select attack target
      const targetTerritory = await attacker.$('[data-testid^="territory-"][data-owner="enemy"][data-adjacent="true"]');
      await targetTerritory?.click();

      // Combat modal should open
      await expect(attacker.locator('[data-testid="combat-modal"]')).toBeVisible();

      // Select dice
      await attacker.click('[data-testid="dice-count-3"]');

      // Defender responds
      const defender = await getDefenderPage(pages, attacker);
      await expect(defender.locator('[data-testid="defend-prompt"]')).toBeVisible();
      await defender.click('[data-testid="dice-count-2"]');

      // Wait for resolution
      await expect(attacker.locator('[data-testid="combat-result"]')).toBeVisible({ timeout: 10000 });
    });
  });

  // ============================================
  // VICTORY CONDITIONS
  // ============================================
  describe('Victory Conditions', () => {
    it('should show victory screen at 4 stars', async () => {
      const [host, player2, player3] = pages;
      await startActiveGame(host, player2, player3);

      // Simulate getting to 4 stars (via API or game manipulation)
      await simulateVictory(host);

      // Victory modal should appear for all players
      await expect(host.locator('[data-testid="victory-modal"]')).toBeVisible();
      await expect(player2.locator('[data-testid="victory-modal"]')).toBeVisible();
      await expect(player3.locator('[data-testid="victory-modal"]')).toBeVisible();
    });
  });

  // ============================================
  // REAL-TIME SYNC
  // ============================================
  describe('Real-Time Synchronization', () => {
    it('should sync territory changes across all clients', async () => {
      const [host, player2, player3] = pages;
      await startActiveGame(host, player2, player3);

      const activePlayer = await getCurrentTurnPage(pages);
      const otherPlayers = pages.filter((p) => p !== activePlayer);

      // Deploy troop
      const territory = await activePlayer.$('[data-testid="territory-0"]');
      await territory?.click();
      await activePlayer.click('[data-testid="deploy-one"]');

      // Check other players see the update
      for (const player of otherPlayers) {
        await expect(player.locator('[data-testid="territory-0"] [data-testid="troop-count"]'))
          .toHaveText(await activePlayer.locator('[data-testid="territory-0"] [data-testid="troop-count"]').textContent() || '');
      }
    });

    it('should handle reconnection gracefully', async () => {
      const [host, player2, player3] = pages;
      await startActiveGame(host, player2, player3);

      // Store current state
      const phaseText = await host.textContent('[data-testid="phase-indicator"]');

      // Simulate disconnection
      await host.context().setOffline(true);
      await new Promise((r) => setTimeout(r, 1000));

      // Reconnect
      await host.context().setOffline(false);
      await host.reload();

      // State should be restored
      await expect(host.locator('[data-testid="phase-indicator"]')).toContainText(phaseText || '');
    });
  });

  // ============================================
  // ACCESSIBILITY
  // ============================================
  describe('Accessibility', () => {
    it('should be navigable via keyboard', async () => {
      const [host] = pages;
      await host.goto('http://localhost:3000');

      // Navigate via tab
      await host.keyboard.press('Tab');
      await host.keyboard.press('Tab');
      await host.keyboard.press('Enter'); // Should activate focused element

      // Verify focus is visible
      const focusedElement = await host.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    it('should have proper ARIA labels', async () => {
      const [host] = pages;
      await host.goto('http://localhost:3000');

      // Check main navigation
      const nav = await host.$('nav[aria-label]');
      expect(nav).toBeTruthy();

      // Check buttons have labels
      const buttons = await host.$$('button');
      for (const button of buttons) {
        const hasLabel = await button.getAttribute('aria-label') ||
                        await button.textContent();
        expect(hasLabel).toBeTruthy();
      }
    });
  });

  // ============================================
  // RESPONSIVE DESIGN
  // ============================================
  describe('Responsive Design', () => {
    it('should work on mobile viewport', async () => {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        isMobile: true,
      });
      const mobilePage = await context.newPage();

      await mobilePage.goto('http://localhost:3000');

      // Mobile menu should exist
      await expect(mobilePage.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();

      // Map should be scrollable/zoomable
      const map = await mobilePage.$('[data-testid="game-board"]');
      expect(map).toBeTruthy();

      await context.close();
    });

    it('should work on tablet viewport', async () => {
      const context = await browser.newContext({
        viewport: { width: 768, height: 1024 },
      });
      const tabletPage = await context.newPage();

      await tabletPage.goto('http://localhost:3000');

      // Layout should adjust
      const sidebar = await tabletPage.$('[data-testid="player-sidebar"]');
      expect(sidebar).toBeTruthy();

      await context.close();
    });
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function setupLobby(host: Page, player2: Page, player3: Page) {
  await host.goto('http://localhost:3000');
  await host.click('[data-testid="create-game-button"]');
  await host.fill('[data-testid="game-name-input"]', 'E2E Test');
  await host.click('[data-testid="create-game-submit"]');

  const inviteCode = await host.textContent('[data-testid="invite-code"]');

  await player2.goto('http://localhost:3000');
  await player2.click('[data-testid="join-game-button"]');
  await player2.fill('[data-testid="invite-code-input"]', inviteCode!);
  await player2.click('[data-testid="join-game-submit"]');

  await player3.goto('http://localhost:3000');
  await player3.click('[data-testid="join-game-button"]');
  await player3.fill('[data-testid="invite-code-input"]', inviteCode!);
  await player3.click('[data-testid="join-game-submit"]');
}

async function startGame(host: Page, player2: Page, player3: Page) {
  await setupLobby(host, player2, player3);

  await host.click('[data-testid="ready-button"]');
  await player2.click('[data-testid="ready-button"]');
  await player3.click('[data-testid="ready-button"]');

  await host.click('[data-testid="start-game-button"]');
}

async function startActiveGame(host: Page, player2: Page, player3: Page) {
  await startGame(host, player2, player3);
  await completeFactionSelection([host, player2, player3]);
  await completeHQPlacement([host, player2, player3]);
}

async function completeFactionSelection(pages: Page[]) {
  for (let i = 0; i < 3; i++) {
    const turnPlayer = await getCurrentTurnPage(pages);
    await turnPlayer.waitForSelector('[data-testid="faction-select"]');
    await turnPlayer.click(`[data-testid="faction-option-${i}"]`);
    await turnPlayer.click('[data-testid="power-option-a"]');
    await turnPlayer.click('[data-testid="confirm-faction"]');
  }
}

async function completeHQPlacement(pages: Page[]) {
  for (let i = 0; i < 3; i++) {
    const turnPlayer = await getCurrentTurnPage(pages);
    await turnPlayer.waitForSelector('[data-testid="hq-placement"]');
    const validTerritory = await turnPlayer.$('[data-testid^="territory-"][data-valid="true"]');
    await validTerritory?.click();
    await turnPlayer.click('[data-testid="confirm-hq"]');
  }
}

async function getCurrentTurnPage(pages: Page[]): Promise<Page> {
  for (const page of pages) {
    const isMyTurn = await page.$('[data-testid="my-turn-indicator"]');
    if (isMyTurn) return page;
  }
  throw new Error('No active turn found');
}

async function getDefenderPage(pages: Page[], attacker: Page): Promise<Page> {
  for (const page of pages) {
    if (page === attacker) continue;
    const hasPrompt = await page.$('[data-testid="defend-prompt"]');
    if (hasPrompt) return page;
  }
  throw new Error('No defender found');
}

async function advanceToAttackPhase(page: Page) {
  await page.click('[data-testid="skip-trade"]');
  await page.click('[data-testid="deploy-all"]');
  await page.click('[data-testid="end-placement"]');
}

async function simulateVictory(page: Page) {
  // This would call a test API endpoint to force a victory state
  await page.evaluate(() => {
    // @ts-ignore
    window.__TEST_API__.forceVictory();
  });
}
