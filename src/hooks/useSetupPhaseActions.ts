import { useCallback } from 'react';
import { factionsById } from '@/data/factions';
import { TerritoryId } from '@/types/territory';
import { FactionId } from '@/types/game';
import { Player } from '@/types/player';
import { GameActionType } from '@/types/actions';

interface UseSetupPhaseActionsParams {
  setupCurrentPlayer: Player | null;
  selectedTerritory: TerritoryId | null;
  isMySetupTurn: boolean;
  isValidHQSelection: boolean;
  setSelectedTerritory: (territoryId: TerritoryId | null) => void;
  sendGameAction: (actionType: GameActionType, payload: Record<string, unknown>) => void;
}

export function useSetupPhaseActions({
  setupCurrentPlayer,
  selectedTerritory,
  isMySetupTurn,
  isValidHQSelection,
  setSelectedTerritory,
  sendGameAction,
}: UseSetupPhaseActionsParams) {
  const handleSelectFaction = useCallback((factionId: FactionId, powerId: string) => {
    if (!setupCurrentPlayer || !isMySetupTurn) return;
    const factionColor = factionsById[factionId]?.color || '#888888';
    sendGameAction('selectFaction', { factionId, powerId, color: factionColor });
  }, [setupCurrentPlayer, isMySetupTurn, sendGameAction]);

  const handlePlaceHQ = useCallback(() => {
    if (!setupCurrentPlayer || !selectedTerritory || !isMySetupTurn) return;
    if (!isValidHQSelection) return;
    sendGameAction('placeHQ', { territoryId: selectedTerritory });
    setSelectedTerritory(null);
  }, [
    setupCurrentPlayer,
    selectedTerritory,
    isMySetupTurn,
    isValidHQSelection,
    sendGameAction,
    setSelectedTerritory,
  ]);

  const getStartingTroopsForDisplay = useCallback(() => {
    if (!setupCurrentPlayer) return 8;
    if (setupCurrentPlayer.factionId === 'balkania' && setupCurrentPlayer.activePower === 'established') {
      return 10;
    }
    return 8;
  }, [setupCurrentPlayer]);

  return {
    handleSelectFaction,
    handlePlaceHQ,
    getStartingTroopsForDisplay,
  };
}
