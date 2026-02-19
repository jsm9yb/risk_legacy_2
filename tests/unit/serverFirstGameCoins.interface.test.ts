import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNewGameInCampaign, evictGameState, getOrLoadGameState } from '../../server/gameState';
import { deleteCampaignFull } from '../../server/persistence';
import { createInitialTerritories, createTwoPlayers } from '../helpers/serverInterfaceTestHelpers';

describe('server interface contract: first-game coin setup', () => {
  let campaignId: string;
  const players = createTwoPlayers();

  beforeEach(() => {
    campaignId = `interface-first-game-coins-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterEach(() => {
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('creates deterministic campaign game numbering for setup guards', () => {
    const game1 = createNewGameInCampaign(campaignId, 'Interface First Game Coins', players, createInitialTerritories());
    expect(game1.gameNumber).toBe(1);

    // Loading current state is part of reconnect/resync path.
    const loaded = getOrLoadGameState(campaignId);
    expect(loaded?.gameNumber).toBe(1);
  });

  it.todo('applies first-game coin initialization once during game 1 setup');
  it.todo('does not re-apply first-game setup on reconnect/replay');
  it.todo('does not run first-game coin initialization for game 2+');
});
