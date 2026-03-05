import { territories } from '@/data/territories';
import { GameActionType } from '@/types/actions';
import { TerritoryState } from '@/types/territory';
import { applyGameAction, getOrLoadGameState } from '../../server/gameState';

export type TestPlayer = {
  id: string;
  name: string;
  odId: string;
  socketId: string;
  seatIndex: number;
};

export function createInitialTerritories(
  overrides: Record<string, Partial<TerritoryState>> = {}
): Record<string, TerritoryState> {
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
      ...overrides[territory.id],
    };
  });

  return states;
}

export function createTwoPlayers(): TestPlayer[] {
  return [
    { id: 'player-1', name: 'Alice', odId: 'od-alice', socketId: 'sock-a', seatIndex: 0 },
    { id: 'player-2', name: 'Bob', odId: 'od-bob', socketId: 'sock-b', seatIndex: 1 },
  ];
}

export function sendAuthoritativeAction(
  campaignId: string,
  playerId: string,
  type: GameActionType,
  payload: Record<string, unknown> = {}
) {
  const state = getOrLoadGameState(campaignId);
  if (!state) {
    throw new Error('Game state not found');
  }

  return applyGameAction(
    campaignId,
    {
      type,
      payload,
      clientVersion: state.version,
      timestamp: Date.now(),
    },
    playerId
  );
}

export function sendAuthoritativeActionAtVersion(
  campaignId: string,
  playerId: string,
  type: GameActionType,
  clientVersion: number,
  payload: Record<string, unknown> = {}
) {
  return applyGameAction(
    campaignId,
    {
      type,
      payload,
      clientVersion,
      timestamp: Date.now(),
    },
    playerId
  );
}

export function completeTwoPlayerSetup(campaignId: string): void {
  const first = sendAuthoritativeAction(campaignId, 'player-1', 'selectFaction', {
    factionId: 'mechaniker',
    powerId: 'fortify_hq',
  });
  if (!first.success) throw new Error(first.error ?? 'setup failed');

  const second = sendAuthoritativeAction(campaignId, 'player-2', 'selectFaction', {
    factionId: 'enclave',
    powerId: 'ferocity',
  });
  if (!second.success) throw new Error(second.error ?? 'setup failed');

  const third = sendAuthoritativeAction(campaignId, 'player-1', 'placeHQ', {
    territoryId: 'alaska',
  });
  if (!third.success) throw new Error(third.error ?? 'setup failed');

  const fourth = sendAuthoritativeAction(campaignId, 'player-2', 'placeHQ', {
    territoryId: 'brazil',
  });
  if (!fourth.success) throw new Error(fourth.error ?? 'setup failed');
}
