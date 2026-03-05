import { beforeEach, describe, expect, it, vi } from 'vitest';
import { territories as territoryData } from '@/data/territories';
import { useGameStore, PersistedGameState } from '@/store/gameStore';
import { TerritoryState } from '@/types/territory';

function createTerritories(
  overrides: Record<string, Partial<TerritoryState>> = {}
): Record<string, TerritoryState> {
  const states: Record<string, TerritoryState> = {};

  territoryData.forEach((territory) => {
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
      ...overrides[territory.id],
    };
  });

  return states;
}

function createPersistedState(overrides: Partial<PersistedGameState> = {}): PersistedGameState {
  return {
    gameId: 'game-interface-client',
    campaignId: 'campaign-interface-client',
    gameNumber: 1,
    status: 'active',
    currentTurn: 1,
    activePlayerId: 'player-1',
    phase: 'RECRUIT',
    subPhase: 'PLACE_TROOPS',
    territories: createTerritories({
      alaska: { ownerId: 'player-1', troopCount: 8 },
      northwest_territory: { ownerId: 'player-2', troopCount: 2 },
      brazil: { ownerId: 'player-2', troopCount: 8 },
    }),
    players: [
      {
        id: 'player-1',
        name: 'Alice',
        gameId: 'game-interface-client',
        userId: 'od-alice',
        seatIndex: 0,
        factionId: 'mechaniker',
        activePower: 'fortify_hq',
        color: '#2F4F4F',
        hqTerritory: 'alaska',
        redStars: 1,
        missiles: 0,
        cards: [],
        isEliminated: false,
        conqueredThisTurn: false,
      },
      {
        id: 'player-2',
        name: 'Bob',
        gameId: 'game-interface-client',
        userId: 'od-bob',
        seatIndex: 1,
        factionId: 'enclave',
        activePower: 'ferocity',
        color: '#8B0000',
        hqTerritory: 'brazil',
        redStars: 1,
        missiles: 0,
        cards: [],
        isEliminated: false,
        conqueredThisTurn: false,
      },
    ],
    troopsToPlace: 3,
    pendingDeployments: {},
    attackingTerritory: null,
    defendingTerritory: null,
    attackerDiceCount: null,
    defenderDiceCount: null,
    missileWindowEndsAt: null,
    combatResult: null,
    conquestTroopsToMove: null,
    maneuverSourceTerritory: null,
    maneuverTargetTerritory: null,
    maneuverTroopsToMove: null,
    currentManeuverPath: null,
    isFirstAttackOfTurn: true,
    setupTurnIndex: 0,
    lastUpdatedAt: Date.now(),
    version: 10,
    ...overrides,
  };
}

describe('client interface contract: GameStoreActions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useGameStore.getState().applyServerState(createPersistedState());
    useGameStore.getState().setLocalPlayerOdId(null);
  });

  it('applies server patches only when version is newer', () => {
    const store = useGameStore.getState();

    store.applyServerPatch({ phase: 'MANEUVER', subPhase: 'SELECT_MANEUVER_SOURCE' }, 9);

    expect(useGameStore.getState().phase).toBe('RECRUIT');
    expect(useGameStore.getState().subPhase).toBe('PLACE_TROOPS');
    expect(useGameStore.getState().serverVersion).toBe(10);

    store.applyServerPatch({ phase: 'ATTACK', subPhase: 'IDLE' }, 11);

    expect(useGameStore.getState().phase).toBe('ATTACK');
    expect(useGameStore.getState().subPhase).toBe('IDLE');
    expect(useGameStore.getState().serverVersion).toBe(11);
  });

  it('resolves local player identity and turn ownership via interface helpers', () => {
    const store = useGameStore.getState();

    store.setLocalPlayerOdId('od-alice');

    expect(store.getLocalPlayer()?.id).toBe('player-1');
    expect(store.isLocalPlayerTurn()).toBe(true);

    store.setLocalPlayerOdId('od-bob');

    expect(store.getLocalPlayer()?.id).toBe('player-2');
    expect(store.isLocalPlayerTurn()).toBe(false);
  });

  it('runs recruit -> attack -> conquest -> maneuver using public store methods', () => {
    const store = useGameStore.getState();

    expect(store.addTroop('alaska').valid).toBe(true);
    expect(store.addTroop('alaska').valid).toBe(true);
    expect(store.addTroop('alaska').valid).toBe(true);
    expect(useGameStore.getState().getTroopsRemaining()).toBe(0);

    expect(store.confirmDeployment().valid).toBe(true);
    expect(useGameStore.getState().phase).toBe('ATTACK');

    expect(store.selectAttackSource('alaska').valid).toBe(true);
    expect(store.selectAttackTarget('northwest_territory').valid).toBe(true);
    expect(store.selectAttackerDice(3).valid).toBe(true);

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.0);

    expect(store.selectDefenderDice(2).valid).toBe(true);
    expect(useGameStore.getState().subPhase).toBe('RESOLVE');

    store.resolveCombatResult();
    expect(useGameStore.getState().subPhase).toBe('TROOP_MOVE');

    const range = store.getConquestTroopRange();
    expect(range.min).toBeGreaterThanOrEqual(1);
    store.setConquestTroops(range.min);
    store.confirmConquest();

    expect(useGameStore.getState().subPhase).toBe('IDLE');
    expect(useGameStore.getState().territories.northwest_territory.ownerId).toBe('player-1');

    store.endAttackPhase();
    expect(useGameStore.getState().phase).toBe('MANEUVER');

    expect(store.selectManeuverSource('northwest_territory').valid).toBe(true);
    expect(store.selectManeuverTarget('alaska').valid).toBe(true);
    store.setManeuverTroops(1);
    store.confirmManeuver();

    expect(useGameStore.getState().activePlayerId).toBe('player-2');
    expect(useGameStore.getState().phase).toBe('RECRUIT');
    expect(useGameStore.getState().subPhase).toBe('PLACE_TROOPS');
  });
});
