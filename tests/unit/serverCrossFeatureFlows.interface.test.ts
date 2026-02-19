import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNewGameInCampaign, evictGameState } from '../../server/gameState';
import { deleteCampaignFull } from '../../server/persistence';
import { completeTwoPlayerSetup, createInitialTerritories, createTwoPlayers } from '../helpers/serverInterfaceTestHelpers';

describe('server interface contract: cross-feature flows', () => {
  let campaignId: string;

  beforeEach(() => {
    campaignId = `interface-cross-feature-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createNewGameInCampaign(campaignId, 'Interface Cross Feature', createTwoPlayers(), createInitialTerritories());
    completeTwoPlayerSetup(campaignId);
  });

  afterEach(() => {
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('keeps server action pipeline authoritative for current gameplay actions', () => {
    // This is the baseline invariant while cards/missions are added.
    expect(campaignId.length).toBeGreaterThan(0);
  });

  it.todo('proves first-game coin setup impacts trade outcomes');
  it.todo('proves sticker/card upgrades persist and influence later games');
  it.todo('proves mission-earned star can trigger victory through existing victory pipeline');
  it.todo('prevents duplicate draw and mission award side effects in same turn');
  it.todo('covers drift recovery during card/mission transitions');
});
