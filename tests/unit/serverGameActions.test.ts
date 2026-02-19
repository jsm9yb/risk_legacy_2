import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { territories } from '@/data/territories';
import { GameActionType } from '@/types/actions';
import { TerritoryState } from '@/types/territory';
import { applyGameAction, createNewGameInCampaign, evictGameState, expireMissileWindow, getOrLoadGameState } from '../../server/gameState';
import { deleteCampaignFull } from '../../server/persistence';

function createInitialTerritories(): Record<string, TerritoryState> {
  const states: Record<string, TerritoryState> = {};
  territories.forEach((territory) => {
    states[territory.id] = {
      id: territory.id,
      name: territory.name,
      continentId: territory.continentId,
      neighbors: territory.neighbors,
      ownerId: null,
      troopCount: 0,
      scarId: null,
      cityTier: 0,
      cityName: null,
      fortified: false,
      fortifyDamage: 0,
    };
  });
  return states;
}

describe('server authoritative actions: setup + recruit', () => {
  let campaignId: string;

  const players = [
    { id: 'player-1', name: 'Alice', odId: 'od-alice', socketId: 'sock-a', seatIndex: 0 },
    { id: 'player-2', name: 'Bob', odId: 'od-bob', socketId: 'sock-b', seatIndex: 1 },
  ];

  function sendAction(playerId: string, type: GameActionType, payload: Record<string, unknown> = {}) {
    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('Game state not found');
    return applyGameAction(campaignId, {
      type,
      payload,
      clientVersion: state.version,
      timestamp: Date.now(),
    }, playerId);
  }

  function completeSetup() {
    expect(sendAction('player-1', 'selectFaction', { factionId: 'mechaniker', powerId: 'fortify_hq' }).success).toBe(true);
    expect(sendAction('player-2', 'selectFaction', { factionId: 'enclave', powerId: 'ferocity' }).success).toBe(true);
    expect(sendAction('player-1', 'placeHQ', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-2', 'placeHQ', { territoryId: 'brazil' }).success).toBe(true);
  }

  beforeEach(() => {
    campaignId = `test-campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createNewGameInCampaign(
      campaignId,
      'Test Campaign',
      players,
      createInitialTerritories()
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('transitions setup to recruit with computed initial reinforcements', () => {
    completeSetup();
    const state = getOrLoadGameState(campaignId);
    expect(state).not.toBeNull();
    expect(state?.status).toBe('active');
    expect(state?.phase).toBe('RECRUIT');
    expect(state?.subPhase).toBe('PLACE_TROOPS');
    expect(state?.activePlayerId).toBe('player-1');
    expect(state?.troopsToPlace).toBe(3);
    expect(state?.pendingDeployments).toEqual({});
  });

  it('returns authoritative setup patch data on selectFaction success', () => {
    const beforeVersion = getOrLoadGameState(campaignId)?.version ?? 0;

    const result = sendAction('player-1', 'selectFaction', {
      factionId: 'mechaniker',
      powerId: 'fortify_hq',
    });

    expect(result.success).toBe(true);
    expect(result.statePatch?.players?.[0]?.factionId).toBe('mechaniker');
    expect(result.statePatch?.setupTurnIndex).toBe(1);
    expect(result.newVersion).toBe(beforeVersion + 1);
  });

  it('returns authoritative setup patch data on placeHQ success', () => {
    expect(sendAction('player-1', 'selectFaction', { factionId: 'mechaniker', powerId: 'fortify_hq' }).success).toBe(true);
    expect(sendAction('player-2', 'selectFaction', { factionId: 'enclave', powerId: 'ferocity' }).success).toBe(true);

    const before = getOrLoadGameState(campaignId);
    const beforeVersion = before?.version ?? 0;
    expect(before?.subPhase).toBe('HQ_PLACEMENT');

    const result = sendAction('player-1', 'placeHQ', { territoryId: 'alaska' });
    expect(result.success).toBe(true);
    expect(result.statePatch?.territories?.alaska?.ownerId).toBe('player-1');
    expect(result.statePatch?.setupTurnIndex).toBe(1);
    expect(result.newVersion).toBe(beforeVersion + 1);
  });

  it('enriches setup reject payload with authoritative context', () => {
    const result = sendAction('player-2', 'selectFaction', {
      factionId: 'enclave',
      powerId: 'ferocity',
    });

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('SETUP_TURN_MISMATCH');
    expect(result.phase).toBe('SETUP');
    expect(result.subPhase).toBe('FACTION_SELECTION');
    expect(result.setupTurnIndex).toBe(0);
    expect(result.expectedPlayerId).toBe('player-1');
    expect(result.serverVersion).toBeGreaterThan(0);
  });

  it('applies recruit actions server-side and transitions to ATTACK on confirm', () => {
    completeSetup();

    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'removeTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);

    const beforeConfirm = getOrLoadGameState(campaignId);
    expect(beforeConfirm?.pendingDeployments.alaska).toBe(3);
    expect(beforeConfirm?.phase).toBe('RECRUIT');

    const confirmResult = sendAction('player-1', 'confirmDeployment');
    expect(confirmResult.success).toBe(true);

    const finalState = getOrLoadGameState(campaignId);
    expect(finalState?.phase).toBe('ATTACK');
    expect(finalState?.subPhase).toBe('IDLE');
    expect(finalState?.troopsToPlace).toBe(0);
    expect(finalState?.pendingDeployments).toEqual({});
    expect(finalState?.territories.alaska.troopCount).toBe(11);
  });

  it('allows confirming deployment with troops remaining and forfeits unplaced troops', () => {
    completeSetup();

    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);

    const beforeConfirm = getOrLoadGameState(campaignId);
    expect(beforeConfirm?.troopsToPlace).toBe(3);
    expect(beforeConfirm?.pendingDeployments.alaska).toBe(1);

    const confirmResult = sendAction('player-1', 'confirmDeployment');
    expect(confirmResult.success).toBe(true);

    const finalState = getOrLoadGameState(campaignId);
    expect(finalState?.phase).toBe('ATTACK');
    expect(finalState?.subPhase).toBe('IDLE');
    expect(finalState?.troopsToPlace).toBe(0);
    expect(finalState?.pendingDeployments).toEqual({});
    expect(finalState?.territories.alaska.troopCount).toBe(9);
  });

  it('rejects invalid recruit actions (wrong player and over-deploy)', () => {
    completeSetup();

    const wrongPlayer = sendAction('player-2', 'addTroop', { territoryId: 'brazil' });
    expect(wrongPlayer.success).toBe(false);
    expect(wrongPlayer.error).toContain('Not your turn');

    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);

    const overDeploy = sendAction('player-1', 'addTroop', { territoryId: 'alaska' });
    expect(overDeploy.success).toBe(false);
    expect(overDeploy.error).toContain('No troops remaining');
  });

  it('applies attack source/target/dice selections server-side', () => {
    completeSetup();

    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.territories.northwest_territory.ownerId = 'player-2';
    state.territories.northwest_territory.troopCount = 2;

    const sourceResult = sendAction('player-1', 'selectAttackSource', { territoryId: 'alaska' });
    expect(sourceResult.success).toBe(true);

    const afterSource = getOrLoadGameState(campaignId);
    expect(afterSource?.subPhase).toBe('SELECT_ATTACK');
    expect(afterSource?.attackingTerritory).toBe('alaska');

    const targetResult = sendAction('player-1', 'selectAttackTarget', { territoryId: 'northwest_territory' });
    expect(targetResult.success).toBe(true);

    const afterTarget = getOrLoadGameState(campaignId);
    expect(afterTarget?.subPhase).toBe('ATTACKER_DICE');
    expect(afterTarget?.defendingTerritory).toBe('northwest_territory');

    const diceResult = sendAction('player-1', 'selectAttackerDice', { diceCount: 3 });
    expect(diceResult.success).toBe(true);

    const afterDice = getOrLoadGameState(campaignId);
    expect(afterDice?.subPhase).toBe('DEFENDER_DICE');
    expect(afterDice?.attackerDiceCount).toBe(3);
  });

  it('rejects invalid attack target selection (non-adjacent territory)', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);

    expect(sendAction('player-1', 'selectAttackSource', { territoryId: 'alaska' }).success).toBe(true);
    const badTarget = sendAction('player-1', 'selectAttackTarget', { territoryId: 'brazil' });

    expect(badTarget.success).toBe(false);
    expect(badTarget.error).toContain('not adjacent');
  });

  it('handles defender dice selection and combat resolution on server', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.territories.northwest_territory.ownerId = 'player-2';
    state.territories.northwest_territory.troopCount = 2;

    expect(sendAction('player-1', 'selectAttackSource', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackTarget', { territoryId: 'northwest_territory' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackerDice', { diceCount: 3 }).success).toBe(true);

    // attacker rolls: [6,6,6], defender rolls: [1,1]
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.0);

    const defendResult = sendAction('player-2', 'selectDefenderDice', { diceCount: 2 });
    expect(defendResult.success).toBe(true);

    const afterDefend = getOrLoadGameState(campaignId);
    expect(afterDefend?.subPhase).toBe('MISSILE_WINDOW');
    expect(afterDefend?.combatResult).not.toBeNull();
    expect(afterDefend?.isFirstAttackOfTurn).toBe(false);
    expect(afterDefend?.missileWindowEndsAt).not.toBeNull();

    const expireResult = expireMissileWindow(campaignId);
    expect(expireResult.success).toBe(true);

    const resolveResult = sendAction('player-1', 'resolveCombat');
    expect(resolveResult.success).toBe(true);

    const afterResolve = getOrLoadGameState(campaignId);
    expect(afterResolve?.subPhase).toBe('TROOP_MOVE');
    expect(afterResolve?.territories.northwest_territory.troopCount).toBe(0);
    expect(afterResolve?.conquestTroopsToMove).toBe(3);

    const conquestResult = sendAction('player-1', 'confirmConquest', { troops: 3 });
    expect(conquestResult.success).toBe(true);

    const afterConquest = getOrLoadGameState(campaignId);
    expect(afterConquest?.subPhase).toBe('IDLE');
    expect(afterConquest?.territories.northwest_territory.ownerId).toBe('player-1');
    expect(afterConquest?.territories.northwest_territory.troopCount).toBe(3);
    expect(afterConquest?.attackingTerritory).toBeNull();
    expect(afterConquest?.defendingTerritory).toBeNull();
  });

  it('allows missile use during MISSILE_WINDOW and consumes missile inventory', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.players[1].missiles = 1;
    state.territories.northwest_territory.ownerId = 'player-2';
    state.territories.northwest_territory.troopCount = 2;

    expect(sendAction('player-1', 'selectAttackSource', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackTarget', { territoryId: 'northwest_territory' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackerDice', { diceCount: 3 }).success).toBe(true);

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.5);

    expect(sendAction('player-2', 'selectDefenderDice', { diceCount: 2 }).success).toBe(true);
    const afterDefend = getOrLoadGameState(campaignId);
    expect(afterDefend?.subPhase).toBe('MISSILE_WINDOW');

    const missileResult = sendAction('player-2', 'useMissile', { side: 'defender', dieIndex: 1 });
    expect(missileResult.success).toBe(true);

    const afterMissile = getOrLoadGameState(campaignId);
    expect(afterMissile?.players.find((p) => p.id === 'player-2')?.missiles).toBe(0);
    expect(afterMissile?.combatResult?.defenderRolls.some((d) => d.modifiedValue === 6)).toBe(true);
    expect(afterMissile?.combatResult?.defenderRolls.some((d) => d.modifiers.some((m) => m.source === 'missile'))).toBe(true);
  });

  it('allows missile use during RESOLVE after missile window expires', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.territories.northwest_territory.ownerId = 'player-2';
    state.territories.northwest_territory.troopCount = 2;
    const defender = state.players.find((p) => p.id === 'player-2');
    if (!defender) throw new Error('Defender missing');
    defender.missiles = 1;

    expect(sendAction('player-1', 'selectAttackSource', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackTarget', { territoryId: 'northwest_territory' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackerDice', { diceCount: 3 }).success).toBe(true);

    // Deterministic rolls to ensure defender die at index 0 is < 6 and missile-applicable.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.3)
      .mockReturnValueOnce(0.4)
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.5);

    expect(sendAction('player-2', 'selectDefenderDice', { diceCount: 2 }).success).toBe(true);

    expect(expireMissileWindow(campaignId).success).toBe(true);
    const afterExpire = getOrLoadGameState(campaignId);
    expect(afterExpire?.subPhase).toBe('RESOLVE');

    const missileResult = sendAction('player-2', 'useMissile', { side: 'defender', dieIndex: 0 });
    expect(missileResult.success).toBe(true);

    const afterMissile = getOrLoadGameState(campaignId);
    expect(afterMissile?.players.find((p) => p.id === 'player-2')?.missiles).toBe(0);
    expect(afterMissile?.combatResult?.defenderRolls.some((d) => d.modifiers.some((m) => m.source === 'missile'))).toBe(true);
  });

  it('applies combat losses and returns to attacker dice when choosing attackAgain', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.territories.northwest_territory.ownerId = 'player-2';
    state.territories.northwest_territory.troopCount = 3;

    expect(sendAction('player-1', 'selectAttackSource', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackTarget', { territoryId: 'northwest_territory' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackerDice', { diceCount: 3 }).success).toBe(true);

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99);

    expect(sendAction('player-2', 'selectDefenderDice', { diceCount: 2 }).success).toBe(true);
    expect(expireMissileWindow(campaignId).success).toBe(true);

    const attackAgainResult = sendAction('player-1', 'attackAgain');
    expect(attackAgainResult.success).toBe(true);

    const afterAttackAgain = getOrLoadGameState(campaignId);
    expect(afterAttackAgain?.subPhase).toBe('ATTACKER_DICE');
    expect(afterAttackAgain?.attackingTerritory).toBe('alaska');
    expect(afterAttackAgain?.defendingTerritory).toBe('northwest_territory');
    expect(afterAttackAgain?.combatResult).toBeNull();
    expect(afterAttackAgain?.territories.alaska.troopCount).toBe(9);
    expect(afterAttackAgain?.territories.northwest_territory.troopCount).toBe(3);
  });

  it('rejects missile use when player has none', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.territories.northwest_territory.ownerId = 'player-2';
    state.territories.northwest_territory.troopCount = 2;

    expect(sendAction('player-1', 'selectAttackSource', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackTarget', { territoryId: 'northwest_territory' }).success).toBe(true);
    expect(sendAction('player-1', 'selectAttackerDice', { diceCount: 3 }).success).toBe(true);
    expect(sendAction('player-2', 'selectDefenderDice', { diceCount: 2 }).success).toBe(true);

    const missileResult = sendAction('player-2', 'useMissile', { side: 'defender', dieIndex: 0 });
    expect(missileResult.success).toBe(false);
    expect(missileResult.error).toContain('No missiles available');
  });

  it('transitions from ATTACK to MANEUVER when ending attack phase and clears transient attack state', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    expect(sendAction('player-1', 'selectAttackSource', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'endAttackPhase').success).toBe(true);

    const afterEndAttack = getOrLoadGameState(campaignId);
    expect(afterEndAttack?.phase).toBe('MANEUVER');
    expect(afterEndAttack?.subPhase).toBe('SELECT_MANEUVER_SOURCE');
    expect(afterEndAttack?.attackingTerritory).toBeNull();
    expect(afterEndAttack?.defendingTerritory).toBeNull();
    expect(afterEndAttack?.attackerDiceCount).toBeNull();
    expect(afterEndAttack?.defenderDiceCount).toBeNull();
    expect(afterEndAttack?.combatResult).toBeNull();
  });

  it('rejects endAttackPhase when not in attack phase', () => {
    completeSetup();
    const result = sendAction('player-1', 'endAttackPhase');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid phase');
  });

  it('supports maneuver source and target selection with owned path validation', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);
    expect(sendAction('player-1', 'endAttackPhase').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.territories.northwest_territory.ownerId = 'player-1';
    state.territories.northwest_territory.troopCount = 1;

    expect(sendAction('player-1', 'selectManeuverSource', { territoryId: 'alaska' }).success).toBe(true);
    const targetResult = sendAction('player-1', 'selectManeuverTarget', { territoryId: 'northwest_territory' });
    expect(targetResult.success).toBe(true);

    const afterTarget = getOrLoadGameState(campaignId);
    expect(afterTarget?.subPhase).toBe('SET_MANEUVER_TROOPS');
    expect(afterTarget?.maneuverSourceTerritory).toBe('alaska');
    expect(afterTarget?.maneuverTargetTerritory).toBe('northwest_territory');
    expect(afterTarget?.currentManeuverPath).toEqual(['alaska', 'northwest_territory']);
  });

  it('rejects maneuver target selection when no owned path exists or target is source', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);
    expect(sendAction('player-1', 'endAttackPhase').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.territories.northwest_territory.ownerId = 'player-2';
    state.territories.northwest_territory.troopCount = 1;

    expect(sendAction('player-1', 'selectManeuverSource', { territoryId: 'alaska' }).success).toBe(true);

    const noPath = sendAction('player-1', 'selectManeuverTarget', { territoryId: 'northwest_territory' });
    expect(noPath.success).toBe(false);
    expect(noPath.error).toContain('controlled');

    const sameTerritory = sendAction('player-1', 'selectManeuverTarget', { territoryId: 'alaska' });
    expect(sameTerritory.success).toBe(false);
    expect(sameTerritory.error).toContain('different territories');
  });

  it('confirmManeuver moves troops and advances to next player recruit phase', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);
    expect(sendAction('player-1', 'endAttackPhase').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    state.territories.northwest_territory.ownerId = 'player-1';
    state.territories.northwest_territory.troopCount = 1;

    expect(sendAction('player-1', 'selectManeuverSource', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'selectManeuverTarget', { territoryId: 'northwest_territory' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmManeuver', { troops: 2 }).success).toBe(true);

    const after = getOrLoadGameState(campaignId);
    expect(after?.activePlayerId).toBe('player-2');
    expect(after?.phase).toBe('RECRUIT');
    expect(after?.subPhase).toBe('PLACE_TROOPS');
    expect(after?.territories.alaska.troopCount).toBe(9);
    expect(after?.territories.northwest_territory.troopCount).toBe(3);
    expect(after?.maneuverSourceTerritory).toBeNull();
    expect(after?.maneuverTargetTerritory).toBeNull();
  });

  it('skipManeuver advances to next non-eliminated player and wraps turn counter', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);
    expect(sendAction('player-1', 'endAttackPhase').success).toBe(true);

    const beforeSkip = getOrLoadGameState(campaignId);
    expect(beforeSkip?.currentTurn).toBe(1);
    expect(sendAction('player-1', 'skipManeuver').success).toBe(true);

    const afterSkip = getOrLoadGameState(campaignId);
    expect(afterSkip?.activePlayerId).toBe('player-2');
    expect(afterSkip?.currentTurn).toBe(1);
    expect(afterSkip?.phase).toBe('RECRUIT');
    expect(afterSkip?.subPhase).toBe('PLACE_TROOPS');
  });

  it('endTurn skips eliminated players in turn order', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);
    expect(sendAction('player-1', 'endAttackPhase').success).toBe(true);

    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('State missing');
    const playerTwo = state.players.find((p) => p.id === 'player-2');
    if (!playerTwo) throw new Error('Player 2 missing');
    playerTwo.isEliminated = true;

    expect(sendAction('player-1', 'endTurn').success).toBe(true);

    const afterEndTurn = getOrLoadGameState(campaignId);
    expect(afterEndTurn?.activePlayerId).toBe('player-1');
    expect(afterEndTurn?.currentTurn).toBe(2);
    expect(afterEndTurn?.phase).toBe('RECRUIT');
  });

  it('returnToAttackPhase transitions from maneuver back to attack idle', () => {
    completeSetup();
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'addTroop', { territoryId: 'alaska' }).success).toBe(true);
    expect(sendAction('player-1', 'confirmDeployment').success).toBe(true);
    expect(sendAction('player-1', 'endAttackPhase').success).toBe(true);

    expect(sendAction('player-1', 'returnToAttackPhase').success).toBe(true);
    const state = getOrLoadGameState(campaignId);
    expect(state?.phase).toBe('ATTACK');
    expect(state?.subPhase).toBe('IDLE');
  });
});

describe('server authoritative setup turn progression', () => {
  let campaignId: string;

  const players = [
    { id: 'player-1', name: 'Alice', odId: 'od-alice', socketId: 'sock-a', seatIndex: 0 },
    { id: 'player-2', name: 'Bob', odId: 'od-bob', socketId: 'sock-b', seatIndex: 1 },
    { id: 'player-3', name: 'Qin', odId: 'od-qin', socketId: 'sock-c', seatIndex: 2 },
  ];

  function sendAction(playerId: string, type: GameActionType, payload: Record<string, unknown> = {}) {
    const state = getOrLoadGameState(campaignId);
    if (!state) throw new Error('Game state not found');
    return applyGameAction(campaignId, {
      type,
      payload,
      clientVersion: state.version,
      timestamp: Date.now(),
    }, playerId);
  }

  beforeEach(() => {
    campaignId = `test-campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createNewGameInCampaign(
      campaignId,
      'Test Campaign 3P',
      players,
      createInitialTerritories()
    );
  });

  afterEach(() => {
    evictGameState(campaignId);
    deleteCampaignFull(campaignId);
  });

  it('keeps setupTurnIndex and subPhase consistent across a 3-player setup sequence', () => {
    expect(sendAction('player-1', 'selectFaction', { factionId: 'mechaniker', powerId: 'fortify_hq' }).success).toBe(true);
    expect(getOrLoadGameState(campaignId)?.setupTurnIndex).toBe(1);

    expect(sendAction('player-2', 'selectFaction', { factionId: 'enclave', powerId: 'ferocity' }).success).toBe(true);
    expect(getOrLoadGameState(campaignId)?.setupTurnIndex).toBe(2);

    expect(sendAction('player-3', 'selectFaction', { factionId: 'saharan', powerId: 'desert_nomads' }).success).toBe(true);
    expect(getOrLoadGameState(campaignId)?.subPhase).toBe('HQ_PLACEMENT');
    expect(getOrLoadGameState(campaignId)?.setupTurnIndex).toBe(0);

    expect(sendAction('player-1', 'placeHQ', { territoryId: 'alaska' }).success).toBe(true);
    expect(getOrLoadGameState(campaignId)?.setupTurnIndex).toBe(1);

    expect(sendAction('player-2', 'placeHQ', { territoryId: 'brazil' }).success).toBe(true);
    expect(getOrLoadGameState(campaignId)?.setupTurnIndex).toBe(2);

    expect(sendAction('player-3', 'placeHQ', { territoryId: 'china' }).success).toBe(true);
    const finalState = getOrLoadGameState(campaignId);
    expect(finalState?.status).toBe('active');
    expect(finalState?.phase).toBe('RECRUIT');
    expect(finalState?.subPhase).toBe('PLACE_TROOPS');
    expect(finalState?.activePlayerId).toBe('player-1');
  });
});
