import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostGameScreen } from '@/components/game/PostGameScreen';
import { useGameStore, PersistedGameState } from '@/store/gameStore';
import { territories } from '@/data/territories';
import { TerritoryState } from '@/types/territory';

function createTerritories(
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

function createPersistedState(): PersistedGameState {
  return {
    gameId: 'post-game-test',
    campaignId: 'post-game-campaign',
    gameNumber: 1,
    status: 'post_game',
    currentTurn: 6,
    activePlayerId: 'player-1',
    phase: 'END',
    subPhase: null,
    territories: createTerritories({
      alaska: { ownerId: 'player-1', cityTier: 0 },
      brazil: { ownerId: 'player-2', scarId: null },
    }),
    players: [
      {
        id: 'player-1',
        name: 'Alice',
        gameId: 'post-game-test',
        userId: 'od-alice',
        seatIndex: 0,
        factionId: 'mechaniker',
        activePower: 'fortify_hq',
        color: '#2F4F4F',
        hqTerritory: 'alaska',
        redStars: 4,
        missiles: 0,
        cards: [],
        isEliminated: false,
        conqueredThisTurn: false,
      },
      {
        id: 'player-2',
        name: 'Bob',
        gameId: 'post-game-test',
        userId: 'od-bob',
        seatIndex: 1,
        factionId: 'enclave',
        activePower: 'ferocity',
        color: '#8B0000',
        hqTerritory: 'brazil',
        redStars: 1,
        missiles: 0,
        cards: [],
        isEliminated: true,
        conqueredThisTurn: false,
      },
    ],
    troopsToPlace: 0,
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
    version: 1,
    winnerId: 'player-1',
  };
}

describe('PostGameScreen component integration', () => {
  beforeEach(() => {
    useGameStore.getState().applyServerState(createPersistedState());
  });

  it('submits scar and city rewards through interface callback', () => {
    const onComplete = vi.fn();

    render(
      <PostGameScreen
        winnerId="player-1"
        winnerName="Alice"
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Found or Upgrade a City/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Alaska/i }));
    fireEvent.change(screen.getByPlaceholderText('Enter city name...'), { target: { value: 'New Anchorage' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Scar/i }));

    fireEvent.click(screen.getByRole('button', { name: /Bunker/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Brazil$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    fireEvent.click(screen.getByRole('button', { name: /Finish Game/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [scarsPlaced, citiesBuilt] = onComplete.mock.calls[0] as [
      Array<{ territoryId: string; scarType: string | null }>,
      Array<{ territoryId: string; cityTier: number; cityName: string | null }>
    ];

    expect(scarsPlaced).toEqual([{ territoryId: 'brazil', scarType: 'bunker' }]);
    expect(citiesBuilt).toEqual([
      { territoryId: 'alaska', cityTier: 1, cityName: 'New Anchorage' },
    ]);
  });
});
