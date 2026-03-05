/**
 * Server-side game state management
 * Handles authoritative game state, validation, and persistence
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PersistedGameState,
  CampaignFull,
  GameAction,
  GameActionResult,
  GameActionReasonCode,
  CompletedGame,
  PlayerPlacement,
  ScarPlacement,
  CityPlacement,
  TerritoryState,
  Player,
  FactionId,
} from './types';
import {
  loadGameState,
  saveGameState,
  deleteGameState,
  loadCampaignFull,
  saveCampaignFull,
  createCampaignFull,
  hasActiveGame,
} from './persistence';
import { continents } from '../src/data/continents';

// In-memory cache of active game states
const gameStateCache = new Map<string, PersistedGameState>();

interface ServerDieModifier {
  source: 'scar' | 'fortification' | 'faction' | 'missile';
  name: string;
  delta: number;
}

interface ServerDieResult {
  originalValue: number;
  modifiedValue: number;
  modifiers: ServerDieModifier[];
  isUnmodifiable: boolean;
}

interface ServerCombatResult {
  attackerRolls: ServerDieResult[];
  defenderRolls: ServerDieResult[];
  comparisons: Array<{ attackerValue: number; defenderValue: number; attackerWins: boolean }>;
  attackerLosses: number;
  defenderLosses: number;
  defenderEliminated: boolean;
  conquestRequired: boolean;
}

function rollDice(count: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < count; i += 1) {
    rolls.push(Math.floor(Math.random() * 6) + 1);
  }
  return rolls;
}

function applyModifiers(
  rolls: number[],
  isAttacker: boolean,
  territory: TerritoryState,
  player: Player | null,
  isFirstAttackOfTurn: boolean
): ServerDieResult[] {
  const sortedRolls = [...rolls].sort((a, b) => b - a);
  const results: ServerDieResult[] = sortedRolls.map((value) => ({
    originalValue: value,
    modifiedValue: value,
    modifiers: [],
    isUnmodifiable: false,
  }));

  if (!isAttacker) {
    if (territory.scarId === 'bunker' && results.length > 0) {
      results[0].modifiedValue = Math.min(6, results[0].modifiedValue + 1);
      results[0].modifiers.push({ source: 'scar', name: 'Bunker', delta: 1 });
    } else if (territory.scarId === 'ammo_shortage' && results.length > 0) {
      results[0].modifiedValue = Math.max(1, results[0].modifiedValue - 1);
      results[0].modifiers.push({ source: 'scar', name: 'Ammo Shortage', delta: -1 });
    }

    if (territory.fortified && territory.fortifyDamage < 10) {
      results.forEach((die) => {
        die.modifiedValue = Math.min(6, die.modifiedValue + 1);
        die.modifiers.push({ source: 'fortification', name: 'Fortification', delta: 1 });
      });
    }
  }

  if (isAttacker && player?.activePower === 'ferocity' && isFirstAttackOfTurn && results.length > 0) {
    results[0].modifiedValue = Math.min(6, results[0].modifiedValue + 1);
    results[0].modifiers.push({ source: 'faction', name: 'Ferocity', delta: 1 });
  }

  return results;
}

function resolveCombat(
  attackerDice: ServerDieResult[],
  defenderDice: ServerDieResult[],
  defenderTroops: number,
  defenderPlayer: Player | null
): ServerCombatResult {
  const sortedAttacker = [...attackerDice].sort((a, b) => b.modifiedValue - a.modifiedValue);
  const sortedDefender = [...defenderDice].sort((a, b) => b.modifiedValue - a.modifiedValue);
  const comparisons: Array<{ attackerValue: number; defenderValue: number; attackerWins: boolean }> = [];

  const numComparisons = Math.min(sortedAttacker.length, sortedDefender.length);
  let attackerLosses = 0;
  let defenderLosses = 0;

  for (let i = 0; i < numComparisons; i += 1) {
    const attackerValue = sortedAttacker[i].modifiedValue;
    const defenderValue = sortedDefender[i].modifiedValue;
    const attackerWins = attackerValue > defenderValue;
    comparisons.push({ attackerValue, defenderValue, attackerWins });
    if (attackerWins) {
      defenderLosses += 1;
    } else {
      attackerLosses += 1;
    }
  }

  if (defenderPlayer?.activePower === 'stubborn' && sortedDefender.length >= 2) {
    if (sortedDefender[0].originalValue === sortedDefender[1].originalValue) {
      attackerLosses += 1;
    }
  }

  const defenderEliminated = defenderTroops - defenderLosses <= 0;
  return {
    attackerRolls: sortedAttacker,
    defenderRolls: sortedDefender,
    comparisons,
    attackerLosses,
    defenderLosses,
    defenderEliminated,
    conquestRequired: defenderEliminated,
  };
}

function normalizePersistedState(state: PersistedGameState): PersistedGameState {
  const mutable = state as PersistedGameState & {
    troopsToPlace?: number;
    pendingDeployments?: Record<string, number>;
    attackingTerritory?: string | null;
    defendingTerritory?: string | null;
    attackerDiceCount?: number | null;
    defenderDiceCount?: number | null;
    missileWindowEndsAt?: number | null;
    combatResult?: PersistedGameState['combatResult'];
    conquestTroopsToMove?: number | null;
    maneuverSourceTerritory?: string | null;
    maneuverTargetTerritory?: string | null;
    maneuverTroopsToMove?: number | null;
    currentManeuverPath?: string[] | null;
    isFirstAttackOfTurn?: boolean;
  };

  if (typeof mutable.troopsToPlace !== 'number') {
    mutable.troopsToPlace = 0;
  }
  if (!mutable.pendingDeployments) {
    mutable.pendingDeployments = {};
  }
  if (typeof mutable.attackingTerritory === 'undefined') {
    mutable.attackingTerritory = null;
  }
  if (typeof mutable.defendingTerritory === 'undefined') {
    mutable.defendingTerritory = null;
  }
  if (typeof mutable.attackerDiceCount === 'undefined') {
    mutable.attackerDiceCount = null;
  }
  if (typeof mutable.defenderDiceCount === 'undefined') {
    mutable.defenderDiceCount = null;
  }
  if (typeof mutable.missileWindowEndsAt === 'undefined') {
    mutable.missileWindowEndsAt = null;
  }
  if (typeof mutable.combatResult === 'undefined') {
    mutable.combatResult = null;
  }
  if (typeof mutable.conquestTroopsToMove === 'undefined') {
    mutable.conquestTroopsToMove = null;
  }
  if (typeof mutable.maneuverSourceTerritory === 'undefined') {
    mutable.maneuverSourceTerritory = null;
  }
  if (typeof mutable.maneuverTargetTerritory === 'undefined') {
    mutable.maneuverTargetTerritory = null;
  }
  if (typeof mutable.maneuverTroopsToMove === 'undefined') {
    mutable.maneuverTroopsToMove = null;
  }
  if (typeof mutable.currentManeuverPath === 'undefined') {
    mutable.currentManeuverPath = null;
  }
  if (typeof mutable.isFirstAttackOfTurn === 'undefined') {
    mutable.isFirstAttackOfTurn = true;
  }
  return mutable;
}

function calculateReinforcements(
  territories: Record<string, TerritoryState>,
  playerId: string
): number {
  let controlledTerritories = 0;
  let totalCityPopulation = 0;

  Object.values(territories).forEach((territory) => {
    if (territory.ownerId === playerId) {
      controlledTerritories += 1;
      totalCityPopulation += territory.cityTier;
    }
  });

  const baseReinforcements = Math.max(3, Math.floor((controlledTerritories + totalCityPopulation) / 3));
  const continentBonus = continents
    .filter((continent) => continent.territoryIds.every((tid) => territories[tid]?.ownerId === playerId))
    .reduce((sum, continent) => sum + continent.bonus, 0);

  return baseReinforcements + continentBonus;
}

function getTroopsRemaining(state: PersistedGameState): number {
  const deployed = Object.values(state.pendingDeployments).reduce((sum, value) => sum + value, 0);
  return state.troopsToPlace - deployed;
}

function clearAttackTransientState(state: PersistedGameState): void {
  state.attackingTerritory = null;
  state.defendingTerritory = null;
  state.attackerDiceCount = null;
  state.defenderDiceCount = null;
  state.missileWindowEndsAt = null;
  state.combatResult = null;
  state.conquestTroopsToMove = null;
}

function clearManeuverState(state: PersistedGameState): void {
  state.maneuverSourceTerritory = null;
  state.maneuverTargetTerritory = null;
  state.maneuverTroopsToMove = null;
  state.currentManeuverPath = null;
}

function getManeuverPath(
  territories: Record<string, TerritoryState>,
  sourceId: string,
  targetId: string,
  playerId: string
): string[] | null {
  if (sourceId === targetId) {
    return null;
  }

  const source = territories[sourceId];
  const target = territories[targetId];
  if (!source || source.ownerId !== playerId || !target || target.ownerId !== playerId) {
    return null;
  }

  const queue: string[][] = [[sourceId]];
  const visited = new Set<string>([sourceId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const currentId = path[path.length - 1];
    const current = territories[currentId];
    if (!current) {
      continue;
    }

    for (const neighborId of current.neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }
      const neighbor = territories[neighborId];
      if (!neighbor || neighbor.ownerId !== playerId) {
        continue;
      }

      const nextPath = [...path, neighborId];
      if (neighborId === targetId) {
        return nextPath;
      }

      visited.add(neighborId);
      queue.push(nextPath);
    }
  }

  return null;
}

function advanceTurn(state: PersistedGameState): void {
  const activePlayers = state.players.filter((p) => !p.isEliminated);
  if (activePlayers.length === 0) {
    throw new Error('No active players available');
  }

  const currentIndex = activePlayers.findIndex((p) => p.id === state.activePlayerId);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % activePlayers.length : 0;
  const nextPlayer = activePlayers[nextIndex];

  state.currentTurn = nextIndex <= safeCurrentIndex ? state.currentTurn + 1 : state.currentTurn;
  state.activePlayerId = nextPlayer.id;
  state.phase = 'RECRUIT';
  state.subPhase = 'PLACE_TROOPS';
  state.troopsToPlace = calculateReinforcements(state.territories, nextPlayer.id);
  state.pendingDeployments = {};
  state.isFirstAttackOfTurn = true;
  state.players = state.players.map((p) => ({ ...p, conqueredThisTurn: false }));
  clearAttackTransientState(state);
  clearManeuverState(state);
}

// ============================================
// Game State Loading/Caching
// ============================================

/**
 * Get or load game state for a campaign
 * Returns null if no active game exists
 */
export function getOrLoadGameState(campaignId: string): PersistedGameState | null {
  // Check cache first
  if (gameStateCache.has(campaignId)) {
    return normalizePersistedState(gameStateCache.get(campaignId)!);
  }

  // Try to load from disk
  const state = loadGameState(campaignId);
  if (state) {
    const normalized = normalizePersistedState(state);
    gameStateCache.set(campaignId, normalized);
    return normalized;
  }

  return null;
}

/**
 * Save game state to cache and disk
 */
export function persistGameState(campaignId: string, state: PersistedGameState): void {
  // Update version for optimistic concurrency
  state.version += 1;
  state.lastUpdatedAt = Date.now();

  // Update cache
  gameStateCache.set(campaignId, state);

  // Persist to disk
  saveGameState(campaignId, state);
}

/**
 * Remove game state from cache (but not disk)
 */
export function evictGameState(campaignId: string): void {
  gameStateCache.delete(campaignId);
}

// ============================================
// Game Lifecycle
// ============================================

/**
 * Create a new game within a campaign
 */
export function createNewGameInCampaign(
  campaignId: string,
  campaignName: string,
  players: Array<{ id: string; name: string; odId: string; socketId: string; seatIndex: number }>,
  initialTerritories: Record<string, TerritoryState>
): PersistedGameState {
  // Load or create full campaign data
  let campaign = loadCampaignFull(campaignId);
  if (!campaign) {
    campaign = createCampaignFull(campaignId, campaignName);
  }

  // Apply persistent territory state (scars, cities from previous games)
  const territories = { ...initialTerritories };
  for (const [territoryId, persistentState] of Object.entries(campaign.persistentTerritories)) {
    if (territories[territoryId]) {
      territories[territoryId] = {
        ...territories[territoryId],
        scarId: persistentState.scarId,
        cityTier: persistentState.cityTier,
        cityName: persistentState.cityName,
      };
    }
  }

  const gameId = `game-${Date.now()}-${uuidv4().slice(0, 8)}`;
  const gameNumber = campaign.gamesPlayed + 1;

  // Create player states - use odId as persistent userId
  const playerStates: Player[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    gameId,
    userId: p.odId, // Use persistent odId for player identity
    seatIndex: p.seatIndex,
    factionId: '' as FactionId, // Will be selected during setup
    activePower: '',
    color: '',
    hqTerritory: '',
    redStars: 0,
    missiles: 0,
    cards: [],
    isEliminated: false,
    conqueredThisTurn: false,
  }));

  // Create game state
  const gameState: PersistedGameState = {
    gameId,
    campaignId,
    gameNumber,
    status: 'setup',
    currentTurn: 0,
    activePlayerId: null,
    phase: 'SETUP',
    subPhase: 'FACTION_SELECTION',
    territories,
    players: playerStates,
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
  };

  // Update campaign
  campaign.currentGameId = gameId;
  saveCampaignFull(campaign);

  // Save and cache game state
  gameStateCache.set(campaignId, gameState);
  saveGameState(campaignId, gameState);

  // Update participants
  updateCampaignParticipants(campaignId, players);

  return gameState;
}

/**
 * Update campaign participant records
 */
function updateCampaignParticipants(
  campaignId: string,
  players: Array<{ id: string; name: string; odId: string }>
): void {
  const campaign = loadCampaignFull(campaignId);
  if (!campaign) return;

  const now = Date.now();

  for (const player of players) {
    const existing = campaign.participants.find((p) => p.odId === player.odId);
    if (existing) {
      existing.gamesPlayed += 1;
      existing.lastPlayedAt = now;
      existing.name = player.name; // Update name in case it changed
    } else {
      campaign.participants.push({
        odId: player.odId,
        name: player.name,
        gamesPlayed: 1,
        wins: 0,
        lastPlayedAt: now,
      });
    }
  }

  saveCampaignFull(campaign);
}

/**
 * Finish the current game and record it in campaign history
 */
export function finishGame(
  campaignId: string,
  winnerId: string,
  winCondition: 'stars' | 'elimination' | 'domination'
): CompletedGame | null {
  const gameState = getOrLoadGameState(campaignId);
  if (!gameState) return null;

  const campaign = loadCampaignFull(campaignId);
  if (!campaign) return null;

  const winner = gameState.players.find((p) => p.id === winnerId);
  if (!winner) return null;

  // Calculate placements
  const placements: PlayerPlacement[] = gameState.players
    .map((p) => {
      const territoriesHeld = Object.values(gameState.territories).filter(
        (t) => t.ownerId === p.id
      ).length;
      return {
        playerId: p.id,
        playerName: p.name,
        factionId: p.factionId,
        placement: p.id === winnerId ? 1 : p.isEliminated ? gameState.players.length : 2,
        territoriesHeld,
        redStars: p.redStars,
        wasEliminated: p.isEliminated,
      };
    })
    .sort((a, b) => a.placement - b.placement);

  // Assign proper placements (2nd, 3rd, etc.)
  let nextPlacement = 2;
  for (const p of placements) {
    if (p.placement !== 1) {
      p.placement = nextPlacement++;
    }
  }

  // Create completed game record
  const completedGame: CompletedGame = {
    gameNumber: gameState.gameNumber,
    gameId: gameState.gameId,
    startedAt: gameState.lastUpdatedAt - (gameState.currentTurn * 60000), // Estimate
    endedAt: Date.now(),
    winnerId,
    winnerName: winner.name,
    winnerFaction: winner.factionId,
    winCondition,
    placements,
    scarsPlaced: [], // Will be filled in post-game phase
    citiesBuilt: [],
    packetsOpened: [],
  };

  // Update campaign
  campaign.gamesPlayed += 1;
  campaign.currentGameId = null;
  campaign.completedGames.push(completedGame);

  // Update winner's win count
  const winnerParticipant = campaign.participants.find((p) => p.odId === winner.userId);
  if (winnerParticipant) {
    winnerParticipant.wins += 1;
  }

  // Update persistent territory state
  for (const [territoryId, territory] of Object.entries(gameState.territories)) {
    if (territory.scarId || territory.cityTier > 0) {
      campaign.persistentTerritories[territoryId] = {
        scarId: territory.scarId,
        cityTier: territory.cityTier,
        cityName: territory.cityName,
      };
    }
  }

  saveCampaignFull(campaign);

  // Don't delete game state yet - keep for post-game phase
  // Update status to post_game and store winnerId
  gameState.status = 'post_game';
  gameState.winnerId = winnerId;
  persistGameState(campaignId, gameState);

  return completedGame;
}

/**
 * Complete the post-game phase and clean up
 */
export function completePostGame(
  campaignId: string,
  scarsPlaced: ScarPlacement[],
  citiesBuilt: CityPlacement[]
): void {
  const campaign = loadCampaignFull(campaignId);
  if (!campaign) return;

  const gameState = getOrLoadGameState(campaignId);
  if (!gameState) return;

  // Update the last completed game with post-game info
  const lastGame = campaign.completedGames[campaign.completedGames.length - 1];
  if (lastGame) {
    lastGame.scarsPlaced = scarsPlaced;
    lastGame.citiesBuilt = citiesBuilt;
  }

  // Update persistent territory state with new scars/cities
  for (const scar of scarsPlaced) {
    if (!campaign.persistentTerritories[scar.territoryId]) {
      campaign.persistentTerritories[scar.territoryId] = {
        scarId: null,
        cityTier: 0,
        cityName: null,
      };
    }
    campaign.persistentTerritories[scar.territoryId].scarId = scar.scarType;
  }

  for (const city of citiesBuilt) {
    if (!campaign.persistentTerritories[city.territoryId]) {
      campaign.persistentTerritories[city.territoryId] = {
        scarId: null,
        cityTier: 0,
        cityName: null,
      };
    }
    campaign.persistentTerritories[city.territoryId].cityTier = city.cityTier;
    campaign.persistentTerritories[city.territoryId].cityName = city.cityName;
  }

  saveCampaignFull(campaign);

  // Now clean up game state
  gameStateCache.delete(campaignId);
  deleteGameState(campaignId);
}

// ============================================
// Game Actions
// ============================================

/**
 * Apply a game action from a client
 * Returns the result with success/failure and state patch
 */
export function applyGameAction(
  campaignId: string,
  action: GameAction,
  playerId: string
): GameActionResult {
  const gameState = getOrLoadGameState(campaignId);
  if (!gameState) {
    return {
      success: false,
      newVersion: 0,
      error: 'No active game found',
      reasonCode: 'NO_ACTIVE_GAME',
    };
  }

  const baseFailureContext = {
    phase: gameState.phase,
    subPhase: gameState.subPhase,
    setupTurnIndex: gameState.setupTurnIndex,
    activePlayerId: gameState.activePlayerId,
    serverVersion: gameState.version,
  };

  // Check version for optimistic concurrency.
  // During setup we tolerate stale client versions so resumed players can proceed;
  // validation still runs against authoritative server state.
  if (action.clientVersion !== gameState.version && gameState.status !== 'setup') {
    return {
      success: false,
      newVersion: gameState.version,
      error: 'State version mismatch - please refresh',
      reasonCode: 'STATE_VERSION_MISMATCH',
      ...baseFailureContext,
    };
  }

  // Validate player is allowed to perform this action
  const validationResult = validateAction(gameState, action, playerId);
  if (!validationResult.valid) {
    return {
      success: false,
      newVersion: gameState.version,
      error: validationResult.error,
      reasonCode: validationResult.reasonCode,
      expectedPlayerId: validationResult.expectedPlayerId,
      ...baseFailureContext,
    };
  }

  let patch: Partial<PersistedGameState>;
  try {
    // Apply the action and get the state patch
    patch = applyActionToState(gameState, action, playerId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid action';
    return {
      success: false,
      newVersion: gameState.version,
      error: message,
      reasonCode: mapErrorToReasonCode(message),
      ...baseFailureContext,
    };
  }

  // Persist the updated state
  persistGameState(campaignId, gameState);

  return {
    success: true,
    newVersion: gameState.version,
    statePatch: patch,
  };
}

/**
 * Validate that a player can perform an action
 */
function validateAction(
  state: PersistedGameState,
  action: GameAction,
  playerId: string
): { valid: boolean; error?: string; reasonCode?: GameActionReasonCode; expectedPlayerId?: string } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { valid: false, error: 'Player not in game', reasonCode: 'PLAYER_NOT_IN_GAME' };
  }

  if (player.isEliminated) {
    return { valid: false, error: 'Player is eliminated', reasonCode: 'PLAYER_ELIMINATED' };
  }

  // During setup, validate it's the player's turn based on setupTurnIndex
  if (state.status === 'setup') {
    const setupPlayer = state.players[state.setupTurnIndex];
    if (!setupPlayer || setupPlayer.id !== playerId) {
      return {
        valid: false,
        error: 'Not your turn in setup',
        reasonCode: 'SETUP_TURN_MISMATCH',
        expectedPlayerId: setupPlayer?.id,
      };
    }
    if (action.type === 'selectFaction' && state.subPhase !== 'FACTION_SELECTION') {
      return {
        valid: false,
        error: 'Invalid phase for faction selection',
        reasonCode: 'SETUP_PHASE_MISMATCH',
        expectedPlayerId: setupPlayer.id,
      };
    }
    if (action.type === 'placeHQ' && state.subPhase !== 'HQ_PLACEMENT') {
      return {
        valid: false,
        error: 'Invalid phase for HQ placement',
        reasonCode: 'SETUP_PHASE_MISMATCH',
        expectedPlayerId: setupPlayer.id,
      };
    }
  }

  // During active game, validate it's the player's turn
  if (state.status === 'active' && state.activePlayerId !== playerId) {
    // Allow defender to select dice during DEFENDER_DICE phase
    if (action.type === 'selectDefenderDice' && state.subPhase === 'DEFENDER_DICE') {
      const defendingTerritoryId = state.defendingTerritory;
      const territory = defendingTerritoryId ? state.territories[defendingTerritoryId] : undefined;
      if (territory && territory.ownerId === playerId) {
        return { valid: true };
      }
    }
    // Allow any player with missiles to act while combat dice are visible.
    if (action.type === 'useMissile' && ['MISSILE_WINDOW', 'RESOLVE'].includes(state.subPhase ?? '')) {
      if (state.combatResult) {
        return { valid: true };
      }
    }
    return {
      valid: false,
      error: 'Not your turn',
      reasonCode: 'TURN_MISMATCH',
      expectedPlayerId: state.activePlayerId ?? undefined,
    };
  }

  return { valid: true };
}

function mapErrorToReasonCode(error: string): GameActionReasonCode {
  if (error.includes('version mismatch')) {
    return 'STATE_VERSION_MISMATCH';
  }
  if (error.includes('Not your turn in setup')) {
    return 'SETUP_TURN_MISMATCH';
  }
  if (error.includes('Invalid phase for faction selection') || error.includes('Invalid phase for HQ placement')) {
    return 'SETUP_PHASE_MISMATCH';
  }
  if (error.includes('Not your turn')) {
    return 'TURN_MISMATCH';
  }
  if (error.includes('Player not in game')) {
    return 'PLAYER_NOT_IN_GAME';
  }
  if (error.includes('Player is eliminated')) {
    return 'PLAYER_ELIMINATED';
  }
  return 'INVALID_ACTION';
}

/**
 * Apply an action to the state and return the patch
 */
function applyActionToState(
  state: PersistedGameState,
  action: GameAction,
  actorPlayerId: string
): Partial<PersistedGameState> {
  const patch: Partial<PersistedGameState> = {};

  switch (action.type) {
    case 'selectFaction': {
      const { factionId, powerId, color } = action.payload as {
        factionId: FactionId;
        powerId: string;
        color?: string;
      };
      const player = state.players.find((p) => p.id === actorPlayerId);
      if (player) {
        if (!factionId || !powerId) {
          throw new Error('Faction and power are required');
        }
        if (player.factionId) {
          throw new Error('Faction already selected');
        }
        const factionTaken = state.players.some(
          (p) => p.id !== player.id && p.factionId === factionId
        );
        if (factionTaken) {
          throw new Error('Faction already taken');
        }
        player.factionId = factionId;
        player.activePower = powerId;
        player.color = color ?? player.color;
      }

      // Check if all players selected
      const allSelected = state.players.every((p) => p.factionId);
      if (allSelected) {
        state.subPhase = 'HQ_PLACEMENT';
        state.setupTurnIndex = 0;
        patch.subPhase = 'HQ_PLACEMENT';
        patch.setupTurnIndex = 0;
      } else {
        state.setupTurnIndex += 1;
        patch.setupTurnIndex = state.setupTurnIndex;
      }
      patch.players = [...state.players];
      break;
    }

    case 'placeHQ': {
      const { territoryId } = action.payload as {
        territoryId: string;
      };
      const player = state.players.find((p) => p.id === actorPlayerId);
      const territory = state.territories[territoryId];

      if (!player) {
        throw new Error('Player not found');
      }
      if (!territory) {
        throw new Error('Invalid territory');
      }
      if (territory.ownerId !== null) {
        throw new Error('Territory already occupied');
      }
      const hqAdjacent = state.players.some((p) => {
        if (!p.hqTerritory) return false;
        const existingHQ = state.territories[p.hqTerritory];
        return existingHQ?.neighbors.includes(territoryId) ?? false;
      });
      if (hqAdjacent) {
        throw new Error('HQ cannot be adjacent to another HQ');
      }

      const startingTroops =
        player.factionId === 'balkania' && player.activePower === 'established' ? 10 : 8;

      if (player && state.territories[territoryId]) {
        player.hqTerritory = territoryId;
        player.redStars = 1; // Own HQ gives 1 star
        state.territories[territoryId].ownerId = actorPlayerId;
        state.territories[territoryId].troopCount = startingTroops;
      }

      // Check if all players placed HQs
      const allPlaced = state.players.every((p) => p.hqTerritory);
      if (allPlaced) {
        const firstPlayerId = state.players[0]?.id || null;
        state.status = 'active';
        state.phase = 'RECRUIT';
        state.subPhase = 'PLACE_TROOPS';
        state.currentTurn = 1;
        state.activePlayerId = firstPlayerId;
        state.setupTurnIndex = 0;
        state.pendingDeployments = {};
        state.troopsToPlace = firstPlayerId
          ? calculateReinforcements(state.territories, firstPlayerId)
          : 0;
        state.attackingTerritory = null;
        state.defendingTerritory = null;
        state.attackerDiceCount = null;
        state.defenderDiceCount = null;
        state.missileWindowEndsAt = null;
        state.combatResult = null;
        state.conquestTroopsToMove = null;
        state.maneuverSourceTerritory = null;
        state.maneuverTargetTerritory = null;
        state.maneuverTroopsToMove = null;
        state.currentManeuverPath = null;
        state.isFirstAttackOfTurn = true;
        patch.status = 'active';
        patch.phase = 'RECRUIT';
        patch.subPhase = 'PLACE_TROOPS';
        patch.currentTurn = 1;
        patch.activePlayerId = state.activePlayerId;
        patch.pendingDeployments = state.pendingDeployments;
        patch.troopsToPlace = state.troopsToPlace;
        patch.attackingTerritory = null;
        patch.defendingTerritory = null;
        patch.attackerDiceCount = null;
        patch.defenderDiceCount = null;
        patch.missileWindowEndsAt = null;
        patch.combatResult = null;
        patch.conquestTroopsToMove = null;
        patch.maneuverSourceTerritory = null;
        patch.maneuverTargetTerritory = null;
        patch.maneuverTroopsToMove = null;
        patch.currentManeuverPath = null;
        patch.isFirstAttackOfTurn = true;
      } else {
        state.setupTurnIndex += 1;
        patch.setupTurnIndex = state.setupTurnIndex;
      }
      patch.players = [...state.players];
      patch.territories = { ...state.territories };
      break;
    }

    case 'addTroop': {
      const { territoryId } = action.payload as { territoryId: string };
      const territory = state.territories[territoryId];
      if (state.phase !== 'RECRUIT' || state.subPhase !== 'PLACE_TROOPS') {
        throw new Error('Invalid phase for troop deployment');
      }
      if (!territory) {
        throw new Error('Invalid territory');
      }
      if (territory.ownerId !== actorPlayerId) {
        throw new Error('Cannot deploy to territory you do not control');
      }
      if (getTroopsRemaining(state) <= 0) {
        throw new Error('No troops remaining to place');
      }

      state.pendingDeployments[territoryId] = (state.pendingDeployments[territoryId] || 0) + 1;
      patch.pendingDeployments = { ...state.pendingDeployments };
      patch.troopsToPlace = state.troopsToPlace;
      break;
    }

    case 'removeTroop': {
      const { territoryId } = action.payload as { territoryId: string };
      if (state.phase !== 'RECRUIT' || state.subPhase !== 'PLACE_TROOPS') {
        throw new Error('Invalid phase for troop deployment');
      }
      const current = state.pendingDeployments[territoryId] || 0;
      if (current <= 0) {
        throw new Error('No pending troop on this territory');
      }
      if (current === 1) {
        delete state.pendingDeployments[territoryId];
      } else {
        state.pendingDeployments[territoryId] = current - 1;
      }
      patch.pendingDeployments = { ...state.pendingDeployments };
      patch.troopsToPlace = state.troopsToPlace;
      break;
    }

    case 'confirmDeployment': {
      if (state.phase !== 'RECRUIT' || state.subPhase !== 'PLACE_TROOPS') {
        throw new Error('Invalid phase for troop deployment');
      }

      for (const [territoryId, count] of Object.entries(state.pendingDeployments)) {
        const territory = state.territories[territoryId];
        if (!territory) {
          throw new Error(`Invalid territory in pending deployment: ${territoryId}`);
        }
        territory.troopCount += count;
      }

      state.pendingDeployments = {};
      state.troopsToPlace = 0;
      state.phase = 'ATTACK';
      state.subPhase = 'IDLE';
      state.attackingTerritory = null;
      state.defendingTerritory = null;
      state.attackerDiceCount = null;
      state.defenderDiceCount = null;
      state.missileWindowEndsAt = null;
      state.combatResult = null;
      state.conquestTroopsToMove = null;
      state.maneuverSourceTerritory = null;
      state.maneuverTargetTerritory = null;
      state.maneuverTroopsToMove = null;
      state.currentManeuverPath = null;

      patch.territories = { ...state.territories };
      patch.pendingDeployments = {};
      patch.troopsToPlace = 0;
      patch.phase = 'ATTACK';
      patch.subPhase = 'IDLE';
      patch.attackingTerritory = null;
      patch.defendingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      patch.maneuverSourceTerritory = null;
      patch.maneuverTargetTerritory = null;
      patch.maneuverTroopsToMove = null;
      patch.currentManeuverPath = null;
      break;
    }

    case 'selectAttackSource': {
      const { territoryId } = action.payload as { territoryId: string };
      const territory = state.territories[territoryId];

      if (state.phase !== 'ATTACK' || state.subPhase !== 'IDLE') {
        throw new Error('Invalid phase for selecting attack source');
      }
      if (!territory) {
        throw new Error('Invalid territory');
      }
      if (territory.ownerId !== actorPlayerId) {
        throw new Error('You do not control this territory');
      }
      if (territory.troopCount < 2) {
        throw new Error('Need at least 2 troops to attack');
      }

      const hasValidTarget = territory.neighbors.some((neighborId) => {
        const neighbor = state.territories[neighborId];
        return neighbor && neighbor.ownerId !== actorPlayerId;
      });
      if (!hasValidTarget) {
        throw new Error('No valid attack targets from this territory');
      }

      state.attackingTerritory = territoryId;
      state.defendingTerritory = null;
      state.attackerDiceCount = null;
      state.defenderDiceCount = null;
      state.missileWindowEndsAt = null;
      state.combatResult = null;
      state.conquestTroopsToMove = null;
      state.subPhase = 'SELECT_ATTACK';

      patch.attackingTerritory = state.attackingTerritory;
      patch.defendingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      patch.subPhase = state.subPhase;
      break;
    }

    case 'selectAttackTarget': {
      const { territoryId } = action.payload as { territoryId: string };
      if (state.phase !== 'ATTACK' || state.subPhase !== 'SELECT_ATTACK') {
        throw new Error('Invalid phase for selecting attack target');
      }
      if (!state.attackingTerritory) {
        throw new Error('No attacking territory selected');
      }

      const source = state.territories[state.attackingTerritory];
      const target = state.territories[territoryId];
      if (!source || !target) {
        throw new Error('Invalid territory');
      }
      if (!source.neighbors.includes(territoryId)) {
        throw new Error('Target territory is not adjacent');
      }
      if (target.ownerId === actorPlayerId) {
        throw new Error('Cannot attack your own territory');
      }

      state.defendingTerritory = territoryId;
      state.defenderDiceCount = null;
      state.missileWindowEndsAt = null;
      if (target.ownerId === null) {
        // Expansion into unoccupied territory skips dice rolling
        state.attackerDiceCount = 1;
        state.subPhase = 'TROOP_MOVE';
        state.conquestTroopsToMove = 1;
      } else {
        state.attackerDiceCount = null;
        state.subPhase = 'ATTACKER_DICE';
        state.conquestTroopsToMove = null;
      }
      state.combatResult = null;

      patch.defendingTerritory = state.defendingTerritory;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.attackerDiceCount = state.attackerDiceCount;
      patch.combatResult = null;
      patch.conquestTroopsToMove = state.conquestTroopsToMove;
      patch.subPhase = state.subPhase;
      break;
    }

    case 'selectAttackerDice': {
      const { diceCount } = action.payload as { diceCount: number };
      if (state.phase !== 'ATTACK' || state.subPhase !== 'ATTACKER_DICE') {
        throw new Error('Invalid phase for selecting attacker dice');
      }
      if (!state.attackingTerritory) {
        throw new Error('No attacking territory selected');
      }
      if (!Number.isInteger(diceCount) || diceCount < 1 || diceCount > 3) {
        throw new Error('Invalid attacker dice count');
      }

      const source = state.territories[state.attackingTerritory];
      const maxDice = Math.min(3, Math.max(0, source.troopCount - 1));
      if (diceCount > maxDice) {
        throw new Error('Not enough troops for selected dice count');
      }

      state.attackerDiceCount = diceCount;
      state.subPhase = 'DEFENDER_DICE';

      patch.attackerDiceCount = state.attackerDiceCount;
      patch.subPhase = state.subPhase;
      break;
    }

    case 'selectDefenderDice': {
      const { diceCount } = action.payload as { diceCount: number };
      if (state.phase !== 'ATTACK' || state.subPhase !== 'DEFENDER_DICE') {
        throw new Error('Invalid phase for selecting defender dice');
      }
      if (!state.attackingTerritory || !state.defendingTerritory || !state.attackerDiceCount) {
        throw new Error('Combat state is incomplete');
      }
      if (!Number.isInteger(diceCount) || diceCount < 1 || diceCount > 2) {
        throw new Error('Invalid defender dice count');
      }

      const attackingTerritory = state.territories[state.attackingTerritory];
      const defendingTerritory = state.territories[state.defendingTerritory];
      if (!attackingTerritory || !defendingTerritory) {
        throw new Error('Invalid combat territories');
      }
      const maxDefenderDice = Math.min(2, defendingTerritory.troopCount);
      if (diceCount > maxDefenderDice) {
        throw new Error('Defender does not have enough troops for selected dice');
      }

      const attackerPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;
      const defenderPlayer = state.players.find((p) => p.id === defendingTerritory.ownerId) || null;

      const attackerRolls = rollDice(state.attackerDiceCount);
      const defenderRolls = rollDice(diceCount);
      const attackerDice = applyModifiers(
        attackerRolls,
        true,
        attackingTerritory,
        attackerPlayer,
        state.isFirstAttackOfTurn
      );
      const defenderDice = applyModifiers(
        defenderRolls,
        false,
        defendingTerritory,
        defenderPlayer,
        false
      );
      const combatResult = resolveCombat(
        attackerDice,
        defenderDice,
        defendingTerritory.troopCount,
        defenderPlayer
      );

      state.defenderDiceCount = diceCount;
      state.combatResult = combatResult;
      state.conquestTroopsToMove = null;
      state.subPhase = 'MISSILE_WINDOW';
      state.missileWindowEndsAt = Date.now() + 5000;
      state.isFirstAttackOfTurn = false;

      patch.defenderDiceCount = state.defenderDiceCount;
      patch.combatResult = state.combatResult;
      patch.conquestTroopsToMove = null;
      patch.subPhase = state.subPhase;
      patch.missileWindowEndsAt = state.missileWindowEndsAt;
      patch.isFirstAttackOfTurn = state.isFirstAttackOfTurn;
      break;
    }

    case 'useMissile': {
      const { side, dieIndex } = action.payload as { side: 'attacker' | 'defender'; dieIndex: number };
      if (state.phase !== 'ATTACK' || !['MISSILE_WINDOW', 'RESOLVE'].includes(state.subPhase ?? '')) {
        throw new Error('Invalid phase for missile use');
      }
      if (!state.defendingTerritory || !state.combatResult) {
        throw new Error('No active combat for missile use');
      }
      if (!Number.isInteger(dieIndex) || dieIndex < 0) {
        throw new Error('Invalid die index');
      }

      const actingPlayer = state.players.find((p) => p.id === actorPlayerId);
      if (!actingPlayer) {
        throw new Error('Player not found');
      }
      if (actingPlayer.missiles <= 0) {
        throw new Error('No missiles available');
      }

      const dicePool = side === 'attacker' ? state.combatResult.attackerRolls : state.combatResult.defenderRolls;
      const targetDie = dicePool[dieIndex];
      if (!targetDie) {
        throw new Error('Invalid die index');
      }
      if (targetDie.isUnmodifiable) {
        throw new Error('Selected die is already unmodifiable');
      }
      if (targetDie.modifiedValue === 6) {
        throw new Error('Selected die is already at maximum value');
      }

      const delta = 6 - targetDie.modifiedValue;
      targetDie.modifiedValue = 6;
      targetDie.isUnmodifiable = true;
      targetDie.modifiers.push({
        source: 'missile',
        name: `Missile (${actingPlayer.name})`,
        delta,
      });
      actingPlayer.missiles -= 1;

      const defendingTerritory = state.territories[state.defendingTerritory];
      if (!defendingTerritory) {
        throw new Error('Invalid combat territories');
      }
      const defenderPlayer = defendingTerritory?.ownerId
        ? state.players.find((p) => p.id === defendingTerritory.ownerId) || null
        : null;

      state.combatResult = resolveCombat(
        state.combatResult.attackerRolls,
        state.combatResult.defenderRolls,
        defendingTerritory.troopCount,
        defenderPlayer
      );

      patch.players = [...state.players];
      patch.combatResult = state.combatResult;
      break;
    }

    case 'resolveCombat': {
      if (state.phase !== 'ATTACK' || state.subPhase !== 'RESOLVE') {
        throw new Error('Invalid phase for resolving combat');
      }
      if (!state.attackingTerritory || !state.defendingTerritory || !state.combatResult) {
        throw new Error('No combat result to resolve');
      }

      const attackingTerritory = state.territories[state.attackingTerritory];
      const defendingTerritory = state.territories[state.defendingTerritory];
      if (!attackingTerritory || !defendingTerritory) {
        throw new Error('Invalid combat territories');
      }

      const attackerLosses = state.combatResult.attackerLosses;
      const defenderLosses = state.combatResult.defenderLosses;
      attackingTerritory.troopCount = Math.max(1, attackingTerritory.troopCount - attackerLosses);
      defendingTerritory.troopCount = Math.max(0, defendingTerritory.troopCount - defenderLosses);

      if (state.combatResult.conquestRequired) {
        state.subPhase = 'TROOP_MOVE';
        state.conquestTroopsToMove = state.attackerDiceCount || 1;
        state.missileWindowEndsAt = null;
      } else {
        state.subPhase = 'IDLE';
        state.attackingTerritory = null;
        state.defendingTerritory = null;
        state.attackerDiceCount = null;
        state.defenderDiceCount = null;
        state.missileWindowEndsAt = null;
        state.combatResult = null;
        state.conquestTroopsToMove = null;
      }

      patch.territories = { ...state.territories };
      patch.subPhase = state.subPhase;
      patch.attackingTerritory = state.attackingTerritory;
      patch.defendingTerritory = state.defendingTerritory;
      patch.attackerDiceCount = state.attackerDiceCount;
      patch.defenderDiceCount = state.defenderDiceCount;
      patch.missileWindowEndsAt = state.missileWindowEndsAt;
      patch.combatResult = state.combatResult;
      patch.conquestTroopsToMove = state.conquestTroopsToMove;
      break;
    }

    case 'attackAgain': {
      if (state.phase !== 'ATTACK' || state.subPhase !== 'RESOLVE') {
        throw new Error('Invalid phase for attack again');
      }
      if (!state.attackingTerritory || !state.defendingTerritory || !state.combatResult) {
        throw new Error('No combat result to resolve');
      }
      if (state.combatResult.conquestRequired) {
        throw new Error('Must move troops after conquest');
      }

      const attackingTerritory = state.territories[state.attackingTerritory];
      const defendingTerritory = state.territories[state.defendingTerritory];
      if (!attackingTerritory || !defendingTerritory) {
        throw new Error('Invalid combat territories');
      }

      const attackerLosses = state.combatResult.attackerLosses;
      const defenderLosses = state.combatResult.defenderLosses;
      attackingTerritory.troopCount = Math.max(1, attackingTerritory.troopCount - attackerLosses);
      defendingTerritory.troopCount = Math.max(0, defendingTerritory.troopCount - defenderLosses);

      if (attackingTerritory.troopCount < 2 || defendingTerritory.troopCount < 1) {
        throw new Error('Cannot attack again from this combat state');
      }

      state.attackerDiceCount = null;
      state.defenderDiceCount = null;
      state.missileWindowEndsAt = null;
      state.combatResult = null;
      state.conquestTroopsToMove = null;
      state.subPhase = 'ATTACKER_DICE';

      patch.territories = { ...state.territories };
      patch.subPhase = state.subPhase;
      patch.attackingTerritory = state.attackingTerritory;
      patch.defendingTerritory = state.defendingTerritory;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      break;
    }

    case 'selectNewTarget': {
      if (state.phase !== 'ATTACK' || state.subPhase !== 'RESOLVE') {
        throw new Error('Invalid phase for selecting new target');
      }
      if (!state.attackingTerritory || !state.defendingTerritory || !state.combatResult) {
        throw new Error('No combat result to resolve');
      }
      if (state.combatResult.conquestRequired) {
        throw new Error('Must move troops after conquest');
      }

      const attackingTerritory = state.territories[state.attackingTerritory];
      const defendingTerritory = state.territories[state.defendingTerritory];
      if (!attackingTerritory || !defendingTerritory) {
        throw new Error('Invalid combat territories');
      }

      const attackerLosses = state.combatResult.attackerLosses;
      const defenderLosses = state.combatResult.defenderLosses;
      attackingTerritory.troopCount = Math.max(1, attackingTerritory.troopCount - attackerLosses);
      defendingTerritory.troopCount = Math.max(0, defendingTerritory.troopCount - defenderLosses);

      if (attackingTerritory.troopCount < 2) {
        throw new Error('Need at least 2 troops to continue attacking');
      }

      state.defendingTerritory = null;
      state.attackerDiceCount = null;
      state.defenderDiceCount = null;
      state.missileWindowEndsAt = null;
      state.combatResult = null;
      state.conquestTroopsToMove = null;
      state.subPhase = 'SELECT_ATTACK';

      patch.territories = { ...state.territories };
      patch.subPhase = state.subPhase;
      patch.attackingTerritory = state.attackingTerritory;
      patch.defendingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      break;
    }

    case 'confirmConquest': {
      const { troops } = action.payload as { troops?: number };
      if (state.phase !== 'ATTACK' || state.subPhase !== 'TROOP_MOVE') {
        throw new Error('Invalid phase for conquest');
      }
      if (!state.attackingTerritory || !state.defendingTerritory || !state.attackerDiceCount) {
        throw new Error('No conquest in progress');
      }

      const attackingTerritory = state.territories[state.attackingTerritory];
      const defendingTerritory = state.territories[state.defendingTerritory];
      if (!attackingTerritory || !defendingTerritory) {
        throw new Error('Invalid conquest territories');
      }

      const minTroops = state.attackerDiceCount;
      const maxTroops = attackingTerritory.troopCount - 1;
      const troopsToMove = troops ?? state.conquestTroopsToMove ?? minTroops;
      if (!Number.isInteger(troopsToMove) || troopsToMove < minTroops || troopsToMove > maxTroops) {
        throw new Error('Invalid conquest troop count');
      }

      const previousOwnerId = defendingTerritory.ownerId;

      attackingTerritory.troopCount -= troopsToMove;
      defendingTerritory.ownerId = actorPlayerId;
      defendingTerritory.troopCount = troopsToMove;

      if (previousOwnerId) {
        const hasTerritories = Object.values(state.territories).some((t) => t.ownerId === previousOwnerId);
        if (!hasTerritories) {
          const defeatedPlayer = state.players.find((p) => p.id === previousOwnerId);
          if (defeatedPlayer) {
            defeatedPlayer.isEliminated = true;
          }
        }
      }

      const attacker = state.players.find((p) => p.id === actorPlayerId);
      if (attacker) {
        attacker.conqueredThisTurn = true;
      }

      state.subPhase = 'IDLE';
      state.defendingTerritory = null;
      state.attackingTerritory = null;
      state.attackerDiceCount = null;
      state.defenderDiceCount = null;
      state.missileWindowEndsAt = null;
      state.combatResult = null;
      state.conquestTroopsToMove = null;

      patch.territories = { ...state.territories };
      patch.players = [...state.players];
      patch.subPhase = state.subPhase;
      patch.defendingTerritory = null;
      patch.attackingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      break;
    }

    case 'endAttackPhase': {
      if (state.phase !== 'ATTACK' || !['IDLE', 'SELECT_ATTACK', 'RESOLVE'].includes(state.subPhase ?? '')) {
        throw new Error('Invalid phase for ending attack');
      }

      if (state.subPhase === 'RESOLVE') {
        if (!state.attackingTerritory || !state.defendingTerritory || !state.combatResult) {
          throw new Error('No combat result to resolve');
        }
        if (state.combatResult.conquestRequired) {
          throw new Error('Must move troops after conquest');
        }

        const attackingTerritory = state.territories[state.attackingTerritory];
        const defendingTerritory = state.territories[state.defendingTerritory];
        if (!attackingTerritory || !defendingTerritory) {
          throw new Error('Invalid combat territories');
        }

        attackingTerritory.troopCount = Math.max(1, attackingTerritory.troopCount - state.combatResult.attackerLosses);
        defendingTerritory.troopCount = Math.max(0, defendingTerritory.troopCount - state.combatResult.defenderLosses);
        patch.territories = { ...state.territories };
      }

      clearAttackTransientState(state);
      clearManeuverState(state);
      state.phase = 'MANEUVER';
      state.subPhase = 'SELECT_MANEUVER_SOURCE';

      patch.phase = state.phase;
      patch.subPhase = state.subPhase;
      patch.attackingTerritory = null;
      patch.defendingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      patch.maneuverSourceTerritory = null;
      patch.maneuverTargetTerritory = null;
      patch.maneuverTroopsToMove = null;
      patch.currentManeuverPath = null;
      break;
    }

    case 'selectManeuverSource': {
      const { territoryId } = action.payload as { territoryId: string };
      if (
        state.phase !== 'MANEUVER' ||
        !['SELECT_MANEUVER_SOURCE', null].includes(state.subPhase)
      ) {
        throw new Error('Invalid phase for selecting maneuver source');
      }

      const source = state.territories[territoryId];
      if (!source) {
        throw new Error('Invalid territory');
      }
      if (source.ownerId !== actorPlayerId) {
        throw new Error('You do not control this territory');
      }
      if (source.troopCount < 2) {
        throw new Error('Need at least 2 troops to maneuver');
      }

      state.maneuverSourceTerritory = territoryId;
      state.maneuverTargetTerritory = null;
      state.maneuverTroopsToMove = null;
      state.currentManeuverPath = null;
      state.subPhase = 'SELECT_MANEUVER_TARGET';

      patch.maneuverSourceTerritory = state.maneuverSourceTerritory;
      patch.maneuverTargetTerritory = null;
      patch.maneuverTroopsToMove = null;
      patch.currentManeuverPath = null;
      patch.subPhase = state.subPhase;
      break;
    }

    case 'selectManeuverTarget': {
      const { territoryId } = action.payload as { territoryId: string };
      if (state.phase !== 'MANEUVER' || state.subPhase !== 'SELECT_MANEUVER_TARGET') {
        throw new Error('Invalid phase for selecting maneuver target');
      }
      if (!state.maneuverSourceTerritory) {
        throw new Error('No maneuver source selected');
      }
      if (state.maneuverSourceTerritory === territoryId) {
        throw new Error('Source and target must be different territories');
      }

      const target = state.territories[territoryId];
      if (!target) {
        throw new Error('Invalid territory');
      }
      if (target.ownerId !== actorPlayerId) {
        throw new Error('Maneuver target must be controlled by the active player');
      }

      const path = getManeuverPath(
        state.territories,
        state.maneuverSourceTerritory,
        territoryId,
        actorPlayerId
      );
      if (!path) {
        throw new Error('No valid owned path between maneuver source and target');
      }

      state.maneuverTargetTerritory = territoryId;
      state.currentManeuverPath = path;
      state.maneuverTroopsToMove = 1;
      state.subPhase = 'SET_MANEUVER_TROOPS';

      patch.maneuverTargetTerritory = state.maneuverTargetTerritory;
      patch.currentManeuverPath = state.currentManeuverPath;
      patch.maneuverTroopsToMove = state.maneuverTroopsToMove;
      patch.subPhase = state.subPhase;
      break;
    }

    case 'cancelManeuver': {
      if (
        state.phase !== 'MANEUVER' ||
        !['SELECT_MANEUVER_TARGET', 'SET_MANEUVER_TROOPS'].includes(state.subPhase ?? '')
      ) {
        throw new Error('Invalid phase for cancelling maneuver');
      }

      clearManeuverState(state);
      state.subPhase = 'SELECT_MANEUVER_SOURCE';

      patch.subPhase = state.subPhase;
      patch.maneuverSourceTerritory = null;
      patch.maneuverTargetTerritory = null;
      patch.maneuverTroopsToMove = null;
      patch.currentManeuverPath = null;
      break;
    }

    case 'confirmManeuver': {
      const { troops } = action.payload as { troops?: number };
      if (state.phase !== 'MANEUVER' || state.subPhase !== 'SET_MANEUVER_TROOPS') {
        throw new Error('Invalid phase for confirming maneuver');
      }
      if (!state.maneuverSourceTerritory || !state.maneuverTargetTerritory) {
        throw new Error('Maneuver source and target must be selected');
      }

      const source = state.territories[state.maneuverSourceTerritory];
      const target = state.territories[state.maneuverTargetTerritory];
      if (!source || !target) {
        throw new Error('Invalid maneuver territories');
      }
      if (source.ownerId !== actorPlayerId || target.ownerId !== actorPlayerId) {
        throw new Error('Maneuver territories must be controlled by the active player');
      }

      const path = getManeuverPath(
        state.territories,
        state.maneuverSourceTerritory,
        state.maneuverTargetTerritory,
        actorPlayerId
      );
      if (!path) {
        throw new Error('No valid owned path between maneuver source and target');
      }

      const maxTroops = source.troopCount - 1;
      const troopsToMove = troops ?? state.maneuverTroopsToMove ?? 1;
      if (!Number.isInteger(troopsToMove) || troopsToMove < 1 || troopsToMove > maxTroops) {
        throw new Error('Invalid maneuver troop count');
      }

      source.troopCount -= troopsToMove;
      target.troopCount += troopsToMove;

      advanceTurn(state);

      patch.territories = { ...state.territories };
      patch.players = [...state.players];
      patch.currentTurn = state.currentTurn;
      patch.activePlayerId = state.activePlayerId;
      patch.phase = state.phase;
      patch.subPhase = state.subPhase;
      patch.troopsToPlace = state.troopsToPlace;
      patch.pendingDeployments = {};
      patch.isFirstAttackOfTurn = state.isFirstAttackOfTurn;
      patch.attackingTerritory = null;
      patch.defendingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      patch.maneuverSourceTerritory = null;
      patch.maneuverTargetTerritory = null;
      patch.maneuverTroopsToMove = null;
      patch.currentManeuverPath = null;
      break;
    }

    case 'skipManeuver': {
      if (state.phase !== 'MANEUVER') {
        throw new Error('Invalid phase for skipping maneuver');
      }

      advanceTurn(state);

      patch.players = [...state.players];
      patch.currentTurn = state.currentTurn;
      patch.activePlayerId = state.activePlayerId;
      patch.phase = state.phase;
      patch.subPhase = state.subPhase;
      patch.troopsToPlace = state.troopsToPlace;
      patch.pendingDeployments = {};
      patch.isFirstAttackOfTurn = state.isFirstAttackOfTurn;
      patch.attackingTerritory = null;
      patch.defendingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      patch.maneuverSourceTerritory = null;
      patch.maneuverTargetTerritory = null;
      patch.maneuverTroopsToMove = null;
      patch.currentManeuverPath = null;
      break;
    }

    case 'returnToAttackPhase': {
      if (state.phase !== 'MANEUVER') {
        throw new Error('Invalid phase for returning to attack');
      }

      clearManeuverState(state);
      clearAttackTransientState(state);
      state.phase = 'ATTACK';
      state.subPhase = 'IDLE';

      patch.phase = state.phase;
      patch.subPhase = state.subPhase;
      patch.attackingTerritory = null;
      patch.defendingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      patch.maneuverSourceTerritory = null;
      patch.maneuverTargetTerritory = null;
      patch.maneuverTroopsToMove = null;
      patch.currentManeuverPath = null;
      break;
    }

    case 'endTurn': {
      if (state.phase !== 'MANEUVER') {
        throw new Error('Invalid phase for ending turn');
      }

      advanceTurn(state);

      patch.players = [...state.players];
      patch.currentTurn = state.currentTurn;
      patch.activePlayerId = state.activePlayerId;
      patch.phase = state.phase;
      patch.subPhase = state.subPhase;
      patch.troopsToPlace = state.troopsToPlace;
      patch.pendingDeployments = {};
      patch.isFirstAttackOfTurn = state.isFirstAttackOfTurn;
      patch.attackingTerritory = null;
      patch.defendingTerritory = null;
      patch.attackerDiceCount = null;
      patch.defenderDiceCount = null;
      patch.missileWindowEndsAt = null;
      patch.combatResult = null;
      patch.conquestTroopsToMove = null;
      patch.maneuverSourceTerritory = null;
      patch.maneuverTargetTerritory = null;
      patch.maneuverTroopsToMove = null;
      patch.currentManeuverPath = null;
      break;
    }

    default: {
      const exhaustiveAction: never = action;
      throw new Error(`Unknown action type: ${String(exhaustiveAction)}`);
    }
  }

  return patch;
}

/**
 * Get the current state version for a campaign
 */
export function getStateVersion(campaignId: string): number {
  const state = getOrLoadGameState(campaignId);
  return state?.version ?? 0;
}

/**
 * Check if a campaign has an active game
 */
export function campaignHasActiveGame(campaignId: string): boolean {
  return hasActiveGame(campaignId);
}

/**
 * Force-close missile window and transition to RESOLVE.
 * Used by server timer to enforce fixed missile window duration.
 */
export function expireMissileWindow(campaignId: string): {
  success: boolean;
  newVersion: number;
  statePatch?: Partial<PersistedGameState>;
} {
  const state = getOrLoadGameState(campaignId);
  if (!state) {
    return { success: false, newVersion: 0 };
  }
  if (state.subPhase !== 'MISSILE_WINDOW') {
    return { success: false, newVersion: state.version };
  }

  state.subPhase = 'RESOLVE';
  state.missileWindowEndsAt = null;
  state.version += 1;
  state.lastUpdatedAt = Date.now();
  persistGameState(campaignId, state);

  return {
    success: true,
    newVersion: state.version,
    statePatch: {
      subPhase: state.subPhase,
      missileWindowEndsAt: null,
    },
  };
}
