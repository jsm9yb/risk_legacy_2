import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyGameAction, createNewGameInCampaign, evictGameState, expireMissileWindow, getOrLoadGameState } from '../../server/gameState';
import { deleteCampaignFull } from '../../server/persistence';
import {
  completeTwoPlayerSetup,
  createInitialTerritories,
  createTwoPlayers,
  sendAuthoritativeAction,
  sendAuthoritativeActionAtVersion,
} from '../helpers/serverInterfaceTestHelpers';

describe('server interface contract: core gameplay flow', () => {
  let campaignId: string;

  beforeEach(() => {
    campaignId = `interface-core-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    createNewGameInCampaign(
      campaignId,
      'Interface Core Flow',
      createTwoPlayers(),
      createInitialTerritories({
        northwest_territory: {
          ownerId: 'player-2',
          troopCount: 2,
        },
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('runs setup -> recruit -> attack conquest -> maneuver -> next turn through public actions', () => {
    completeTwoPlayerSetup(campaignId);

    expect(sendAuthoritativeAction(campaignId, 'player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAuthoritativeAction(campaignId, 'player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAuthoritativeAction(campaignId, 'player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);

    const confirmDeploy = sendAuthoritativeAction(campaignId, 'player-1', 'confirmDeployment');
    expect(confirmDeploy.success).toBe(true);

    expect(sendAuthoritativeAction(campaignId, 'player-1', 'selectAttackSource', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAuthoritativeAction(campaignId, 'player-1', 'selectAttackTarget', { territoryId: 'northwest_territory' }).success).toBe(true);
    expect(sendAuthoritativeAction(campaignId, 'player-1', 'selectAttackerDice', { diceCount: 3 }).success).toBe(true);

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.0);

    const defendResult = sendAuthoritativeAction(campaignId, 'player-2', 'selectDefenderDice', { diceCount: 2 });
    expect(defendResult.success).toBe(true);
    expect(getOrLoadGameState(campaignId)?.subPhase).toBe('MISSILE_WINDOW');
    expect(expireMissileWindow(campaignId).success).toBe(true);

    const resolveResult = sendAuthoritativeAction(campaignId, 'player-1', 'resolveCombat');
    expect(resolveResult.success).toBe(true);

    const conquestResult = sendAuthoritativeAction(campaignId, 'player-1', 'confirmConquest', { troops: 3 });
    expect(conquestResult.success).toBe(true);

    expect(sendAuthoritativeAction(campaignId, 'player-1', 'endAttackPhase').success).toBe(true);
    expect(sendAuthoritativeAction(campaignId, 'player-1', 'selectManeuverSource', { territoryId: 'northwest_territory' }).success).toBe(true);
    expect(sendAuthoritativeAction(campaignId, 'player-1', 'selectManeuverTarget', { territoryId: 'alaska' }).success).toBe(true);

    const maneuverResult = sendAuthoritativeAction(campaignId, 'player-1', 'confirmManeuver', { troops: 2 });
    expect(maneuverResult.success).toBe(true);

    const finalState = getOrLoadGameState(campaignId);
    expect(finalState?.activePlayerId).toBe('player-2');
    expect(finalState?.phase).toBe('RECRUIT');
    expect(finalState?.subPhase).toBe('PLACE_TROOPS');
    expect(finalState?.territories.alaska.ownerId).toBe('player-1');
    expect(finalState?.territories.northwest_territory.ownerId).toBe('player-1');
  });

  it('rejects stale version after setup and returns server context fields', () => {
    completeTwoPlayerSetup(campaignId);

    const state = getOrLoadGameState(campaignId);
    expect(state).not.toBeNull();

    const staleVersion = Math.max(0, (state?.version ?? 1) - 1);
    const result = sendAuthoritativeActionAtVersion(
      campaignId,
      'player-1',
      'addTroop',
      staleVersion,
      { territoryId: 'alaska' }
    );

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('STATE_VERSION_MISMATCH');
    expect(result.newVersion).toBe(state?.version);
    expect(result.phase).toBe('RECRUIT');
    expect(result.subPhase).toBe('PLACE_TROOPS');
  });

  it('permits stale client version during setup while applying authoritative validation', () => {
    const state = getOrLoadGameState(campaignId);
    expect(state?.status).toBe('setup');

    const result = sendAuthoritativeActionAtVersion(
      campaignId,
      'player-1',
      'selectFaction',
      0,
      { factionId: 'mechaniker', powerId: 'fortify_hq' }
    );

    expect(result.success).toBe(true);
    expect(result.statePatch?.setupTurnIndex).toBe(1);
  });

  it('returns setup reject context for out-of-turn setup actions', () => {
    const result = applyGameAction(
      campaignId,
      {
        type: 'selectFaction',
        payload: { factionId: 'enclave', powerId: 'ferocity' },
        clientVersion: getOrLoadGameState(campaignId)?.version ?? 1,
        timestamp: Date.now(),
      },
      'player-2'
    );

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('SETUP_TURN_MISMATCH');
    expect(result.phase).toBe('SETUP');
    expect(result.subPhase).toBe('FACTION_SELECTION');
    expect(result.expectedPlayerId).toBe('player-1');
    expect(result.setupTurnIndex).toBe(0);
  });
});
