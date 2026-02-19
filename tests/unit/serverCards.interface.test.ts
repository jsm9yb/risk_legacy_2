import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyGameAction, createNewGameInCampaign, evictGameState, getOrLoadGameState } from '../../server/gameState';
import { deleteCampaignFull } from '../../server/persistence';
import {
  completeTwoPlayerSetup,
  createInitialTerritories,
  createTwoPlayers,
  sendAuthoritativeAction,
} from '../helpers/serverInterfaceTestHelpers';

describe('server interface contract: cards', () => {
  let campaignId: string;

  beforeEach(() => {
    campaignId = `interface-cards-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createNewGameInCampaign(campaignId, 'Interface Cards', createTwoPlayers(), createInitialTerritories());
    completeTwoPlayerSetup(campaignId);
  });

  afterEach(() => {
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('rejects unsupported tradeCards action until server contract is implemented', () => {
    const version = getOrLoadGameState(campaignId)?.version ?? 1;

    const result = applyGameAction(
      campaignId,
      {
        type: 'tradeCards' as never,
        payload: { cardIds: [0, 1, 2], tradeType: 'troops' },
        clientVersion: version,
        timestamp: Date.now(),
      },
      'player-1'
    );

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('INVALID_ACTION');
  });

  it('keeps gameplay mutations authoritative while cards contract is pending', () => {
    const addResult = sendAuthoritativeAction(campaignId, 'player-1', 'addTroop', { territoryId: 'alaska' });
    expect(addResult.success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    expect(state?.pendingDeployments.alaska).toBe(1);
  });

  it.todo('initializes resource deck deterministically on new game');
  it.todo('grants at most one conquest draw opportunity per turn');
  it.todo('applies territory-card draw priority before coin fallback');
  it.todo('accepts valid tradeCards for troops and discards cards atomically');
  it.todo('accepts valid tradeCards for red star with exact shape');
  it.todo('rejects invalid trade payloads with reasonCode and no mutation');
});
