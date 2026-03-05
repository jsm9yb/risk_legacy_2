import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  campaignHasActiveGame,
  completePostGame,
  createNewGameInCampaign,
  evictGameState,
  finishGame,
  getOrLoadGameState,
} from '../../server/gameState';
import { deleteCampaignFull, loadCampaignFull } from '../../server/persistence';
import {
  completeTwoPlayerSetup,
  createInitialTerritories,
  createTwoPlayers,
} from '../helpers/serverInterfaceTestHelpers';

describe('server interface contract: end-of-game and post-game lifecycle', () => {
  let campaignId: string;
  const players = createTwoPlayers();

  beforeEach(() => {
    campaignId = `interface-endgame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    createNewGameInCampaign(
      campaignId,
      'Interface Endgame',
      players,
      createInitialTerritories({
        alaska: {
          scarId: 'bunker',
          cityTier: 1,
          cityName: 'Old Anchorage',
        },
      })
    );

    completeTwoPlayerSetup(campaignId);
  });

  afterEach(() => {
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('records winner and transitions active game to post_game via finishGame', () => {
    const completed = finishGame(campaignId, 'player-1', 'stars');

    expect(completed).not.toBeNull();
    expect(completed?.winnerId).toBe('player-1');
    expect(completed?.winCondition).toBe('stars');

    const state = getOrLoadGameState(campaignId);
    expect(state?.status).toBe('post_game');
    expect(state?.winnerId).toBe('player-1');

    const campaign = loadCampaignFull(campaignId);
    expect(campaign).not.toBeNull();
    expect(campaign?.completedGames).toHaveLength(1);
    expect(campaign?.completedGames[0].winnerId).toBe('player-1');
    expect(campaign?.participants.find((p) => p.odId === 'od-alice')?.wins).toBe(1);
  });

  it('persists post-game additions and clears active game on completePostGame', () => {
    finishGame(campaignId, 'player-1', 'elimination');

    completePostGame(
      campaignId,
      [
        {
          territoryId: 'brazil',
          territoryName: 'Brazil',
          scarType: 'biohazard',
          placedByPlayerId: 'player-1',
          placedByPlayerName: 'Alice',
        },
      ],
      [
        {
          territoryId: 'alaska',
          territoryName: 'Alaska',
          cityTier: 2,
          cityName: 'Anchorage Prime',
          builtByPlayerId: 'player-1',
          builtByPlayerName: 'Alice',
        },
      ]
    );

    expect(campaignHasActiveGame(campaignId)).toBe(false);
    expect(getOrLoadGameState(campaignId)).toBeNull();

    const campaign = loadCampaignFull(campaignId);
    expect(campaign).not.toBeNull();

    const lastGame = campaign?.completedGames[campaign.completedGames.length - 1];
    expect(lastGame?.scarsPlaced).toHaveLength(1);
    expect(lastGame?.citiesBuilt).toHaveLength(1);
    expect(campaign?.persistentTerritories.brazil.scarId).toBe('biohazard');
    expect(campaign?.persistentTerritories.alaska.cityTier).toBe(2);
    expect(campaign?.persistentTerritories.alaska.cityName).toBe('Anchorage Prime');
  });

  it('carries persistent map changes into a newly created next game in same campaign', () => {
    finishGame(campaignId, 'player-1', 'domination');

    completePostGame(
      campaignId,
      [
        {
          territoryId: 'northwest_territory',
          territoryName: 'Northwest Territory',
          scarType: 'ammo_shortage',
          placedByPlayerId: 'player-2',
          placedByPlayerName: 'Bob',
        },
      ],
      [
        {
          territoryId: 'brazil',
          territoryName: 'Brazil',
          cityTier: 1,
          cityName: 'Rio Outpost',
          builtByPlayerId: 'player-1',
          builtByPlayerName: 'Alice',
        },
      ]
    );

    const nextGame = createNewGameInCampaign(
      campaignId,
      'Interface Endgame',
      players,
      createInitialTerritories()
    );

    expect(nextGame.gameNumber).toBe(2);
    expect(nextGame.territories.northwest_territory.scarId).toBe('ammo_shortage');
    expect(nextGame.territories.brazil.cityTier).toBe(1);
    expect(nextGame.territories.brazil.cityName).toBe('Rio Outpost');
  });
});
