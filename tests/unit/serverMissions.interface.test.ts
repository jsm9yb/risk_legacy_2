import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyGameAction, createNewGameInCampaign, evictGameState, getOrLoadGameState } from '../../server/gameState';
import { deleteCampaignFull } from '../../server/persistence';
import {
  completeTwoPlayerSetup,
  createInitialTerritories,
  createTwoPlayers,
} from '../helpers/serverInterfaceTestHelpers';

describe('server interface contract: missions', () => {
  let campaignId: string;

  beforeEach(() => {
    campaignId = `interface-missions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createNewGameInCampaign(campaignId, 'Interface Missions', createTwoPlayers(), createInitialTerritories());
    completeTwoPlayerSetup(campaignId);
  });

  afterEach(() => {
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('rejects unsupported claimMission action until server contract is implemented', () => {
    const version = getOrLoadGameState(campaignId)?.version ?? 1;

    const result = applyGameAction(
      campaignId,
      {
        type: 'claimMission' as never,
        payload: { missionId: 'mission-1' },
        clientVersion: version,
        timestamp: Date.now(),
      },
      'player-1'
    );

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('INVALID_ACTION');
  });

  it.todo('initializes active mission pool at game start');
  it.todo('completes triggered mission, awards one star, and refills active mission');
  it.todo('prevents mission double-award on replay/resync');
  it.todo('routes mission-earned stars through existing victory flow without duplicate side effects');
});
