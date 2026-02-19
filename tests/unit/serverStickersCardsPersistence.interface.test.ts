import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  completePostGame,
  createNewGameInCampaign,
  evictGameState,
  finishGame,
} from '../../server/gameState';
import { deleteCampaignFull, loadCampaignFull } from '../../server/persistence';
import { completeTwoPlayerSetup, createInitialTerritories, createTwoPlayers } from '../helpers/serverInterfaceTestHelpers';

describe('server interface contract: stickers and cards persistence', () => {
  let campaignId: string;
  const players = createTwoPlayers();

  beforeEach(() => {
    campaignId = `interface-stickers-cards-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    createNewGameInCampaign(campaignId, 'Interface Stickers Cards', players, createInitialTerritories());
    completeTwoPlayerSetup(campaignId);
  });

  afterEach(() => {
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('persists sticker/scar placements through post-game write phase', () => {
    finishGame(campaignId, 'player-1', 'stars');

    completePostGame(
      campaignId,
      [
        {
          territoryId: 'alaska',
          territoryName: 'Alaska',
          scarType: 'bunker',
          placedByPlayerId: 'player-1',
          placedByPlayerName: 'Alice',
        },
      ],
      []
    );

    const campaign = loadCampaignFull(campaignId);
    expect(campaign?.persistentTerritories.alaska.scarId).toBe('bunker');
  });

  it.todo('persists territory-card coin upgrades and clamps values at 6');
  it.todo('hydrates upgraded territory-card coin values in subsequent games');
});
