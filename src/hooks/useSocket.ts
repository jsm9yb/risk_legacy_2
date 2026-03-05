/**
 * Socket.io connection hook
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLobbyStore, Campaign, Lobby, LobbyPlayer, GameInitialState, CampaignFull } from '@/store/lobbyStore';
import { useGameStore, PersistedGameState, SetupTurnEvent } from '@/store/gameStore';
import { GameActionType } from '@/types/actions';

// Server URL - use environment variable or default to localhost
const SOCKET_URL = (import.meta as { env?: { VITE_SOCKET_URL?: string } }).env?.VITE_SOCKET_URL || 'http://localhost:3001';
const LAST_CAMPAIGN_ID_KEY = 'risk_legacy_last_campaign_id';
const IS_DEV = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

/**
 * Game action for server sync
 */
interface GameAction {
  type: GameActionType;
  payload: Record<string, unknown>;
  clientVersion: number;
  timestamp: number;
}

/**
 * Game action result from server
 */
interface GameActionResult {
  success: boolean;
  newVersion: number;
  error?: string;
  statePatch?: Partial<PersistedGameState>;
  phase?: string;
  subPhase?: string | null;
  setupTurnIndex?: number;
  activePlayerId?: string | null;
  serverVersion?: number;
  expectedPlayerId?: string;
  reasonCode?: string;
}

const setupRejectReasonCodes = new Set([
  'SETUP_TURN_MISMATCH',
  'SETUP_PHASE_MISMATCH',
  'STATE_VERSION_MISMATCH',
]);

export function shouldRequestSetupResync(result: GameActionResult): boolean {
  if (result.success) return false;
  if (result.reasonCode && setupRejectReasonCodes.has(result.reasonCode)) return true;
  if (result.phase === 'SETUP' || result.subPhase === 'FACTION_SELECTION' || result.subPhase === 'HQ_PLACEMENT') {
    return true;
  }

  const error = result.error ?? '';
  return (
    error.includes('Not your turn in setup') ||
    error.includes('Invalid phase for faction selection') ||
    error.includes('Invalid phase for HQ placement')
  );
}

// Define socket event types
interface ServerToClientEvents {
  'campaign:list': (data: { campaigns: Campaign[] }) => void;
  'campaign:deleteError': (data: { message: string }) => void;
  'campaign:history': (data: { campaign: CampaignFull }) => void;
  'campaign:participants': (data: { campaignId: string; participants: Array<{ odId: string; name: string }> }) => void;
  'lobby:state': (data: { lobby: Lobby }) => void;
  'lobby:playerJoined': (data: { player: LobbyPlayer }) => void;
  'lobby:playerLeft': (data: { socketId: string }) => void;
  'lobby:kicked': () => void;
  'lobby:error': (data: { message: string }) => void;
  'lobby:tokenAssigned': (data: { odId: string; campaignId: string }) => void;
  'lobby:claimSeatResult': (data: { success: boolean; claimedOdId?: string; error?: string }) => void;
  'game:started': (data: { initialState: GameInitialState }) => void;
  'game:fullState': (data: { state: PersistedGameState }) => void;
  'game:stateUpdate': (data: { patch: Partial<PersistedGameState>; version: number }) => void;
  'game:setupTurn': (data: SetupTurnEvent) => void;
  'game:actionResult': (data: GameActionResult) => void;
  'game:postGame': (data: { winnerId: string; winnerName: string; winCondition: 'stars' | 'elimination' | 'domination' }) => void;
  'game:gameComplete': (data: { campaignId: string }) => void;
  'game:rejoinResult': (data: { success: boolean; state?: PersistedGameState; localPlayerId?: string; error?: string }) => void;
}

interface ClientToServerEvents {
  'campaign:create': (data: { name: string }) => void;
  'campaign:delete': (data: { campaignId: string }) => void;
  'campaign:list': () => void;
  'campaign:getHistory': (data: { campaignId: string }) => void;
  'campaign:getParticipants': (data: { campaignId: string }) => void;
  'lobby:join': (data: { campaignId: string; playerName: string; playerToken?: string }) => void;
  'lobby:claimSeat': (data: { campaignId: string; targetOdId: string; playerName: string }) => void;
  'lobby:leave': () => void;
  'game:rejoin': (data: { campaignId: string; playerToken: string }) => void;
  'lobby:ready': (data: { isReady: boolean }) => void;
  'lobby:transferHost': (data: { targetSocketId: string }) => void;
  'lobby:kick': (data: { targetSocketId: string }) => void;
  'lobby:start': () => void;
  'game:action': (data: { campaignId: string; action: GameAction }) => void;
  'game:requestState': (data: { campaignId: string }) => void;
  'game:completePostGame': (data: {
    campaignId: string;
    scarsPlaced: Array<{ territoryId: string; scarType: string | null }>;
    citiesBuilt: Array<{ territoryId: string; cityTier: number; cityName: string | null }>;
  }) => void;
  'game:declareVictory': (data: {
    campaignId: string;
    winnerId: string;
    winCondition: 'stars' | 'elimination' | 'domination';
  }) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Singleton socket instance
let socketInstance: TypedSocket | null = null;
let lastAutoRejoinSocketId: string | null = null;
let lastInGameSyncRequestAt = 0;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);

  const {
    setConnected,
    setConnectionError,
    setCampaigns,
    setCurrentLobby,
    updateLobbyPlayer,
    removePlayerFromLobby,
    setLobbyError,
    leaveLobby,
    setGameStarted,
    setCampaignHistory,
    setPendingCampaignParticipants,
    setPostGameWinner,
    clearPostGameWinner,
    resetGameState,
    currentLobby,
    saveTokenForCampaign,
    loadTokenForCampaign,
    setLocalPlayerOdId,
    setResuming,
  } = useLobbyStore();

  const {
    applyServerState,
    applyServerPatch,
    applySetupTurn,
    setSyncing,
    setSyncError,
    getClientVersion,
    campaignId: currentCampaignId,
  } = useGameStore();

  // Initialize socket connection
  useEffect(() => {
    // Use existing instance or create new one
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }

    socketRef.current = socketInstance;
    const socket = socketRef.current;
    const requestStateSync = (campaignId: string) => {
      setSyncError(null);
      setSyncing(true);
      socket.emit('game:requestState', { campaignId });
    };

    const onConnect = () => {
      console.log('Socket connected:', socket.id);
      setConnected(true, socket.id);
      setConnectionError(null);

      if (typeof window !== 'undefined' && socket.id && lastAutoRejoinSocketId !== socket.id) {
        lastAutoRejoinSocketId = socket.id;
        const lastCampaignId = localStorage.getItem(LAST_CAMPAIGN_ID_KEY);
        if (lastCampaignId) {
          const token = useLobbyStore.getState().loadTokenForCampaign(lastCampaignId);
          if (token) {
            useLobbyStore.getState().setResuming(true);
            socket.emit('game:rejoin', { campaignId: lastCampaignId, playerToken: token });
          }
        }
      }
    };

    const onDisconnect = () => {
      console.log('Socket disconnected');
      setConnected(false);
    };

    const onConnectError = (error: Error) => {
      console.error('Socket connection error:', error.message);
      setConnectionError(`Connection failed: ${error.message}`);
    };

    const onCampaignList = ({ campaigns }: { campaigns: Campaign[] }) => {
      setCampaigns(campaigns);
    };

    const onLobbyState = ({ lobby }: { lobby: Lobby }) => {
      setCurrentLobby(lobby);
      if (lobby.status === 'in_game' && socket.connected) {
        const now = Date.now();
        if (now - lastInGameSyncRequestAt > 500) {
          lastInGameSyncRequestAt = now;
          requestStateSync(lobby.campaignId);
        }
      }
    };

    const onLobbyPlayerJoined = ({ player }: { player: LobbyPlayer }) => {
      updateLobbyPlayer(player);
    };

    const onLobbyPlayerLeft = ({ socketId }: { socketId: string }) => {
      removePlayerFromLobby(socketId);
    };

    const onLobbyKicked = () => {
      leaveLobby();
      setLobbyError('You were kicked from the lobby');
    };

    const onLobbyError = ({ message }: { message: string }) => {
      setLobbyError(message);
    };

    const onCampaignDeleteError = ({ message }: { message: string }) => {
      setLobbyError(message);
    };

    const onTokenAssigned = ({ odId, campaignId }: { odId: string; campaignId: string }) => {
      console.log(`Token assigned: ${odId} for campaign ${campaignId}`);
      saveTokenForCampaign(campaignId, odId);
    };

    const onClaimSeatResult = ({ success, claimedOdId, error }: { success: boolean; claimedOdId?: string; error?: string }) => {
      if (!success || !claimedOdId) {
        setLobbyError(error || 'Failed to claim seat');
        return;
      }

      const lobby = useLobbyStore.getState().currentLobby;
      if (!lobby) {
        setLobbyError('Seat claimed, but lobby context is missing');
        return;
      }

      useLobbyStore.getState().setResuming(true);
      socket.emit('game:rejoin', { campaignId: lobby.campaignId, playerToken: claimedOdId });
    };

    const onRejoinResult = ({ success, state, localPlayerId, error }: { success: boolean; state?: PersistedGameState; localPlayerId?: string; error?: string }) => {
      if (success && state && localPlayerId) {
        console.log(`Successfully rejoined game as player ${localPlayerId}`);
        if (typeof window !== 'undefined' && state.campaignId) {
          localStorage.setItem(LAST_CAMPAIGN_ID_KEY, state.campaignId);
        }
        applyServerState(state);
        requestStateSync(state.campaignId);
        setLocalPlayerOdId(localPlayerId);
        setGameStarted(true);
        useLobbyStore.getState().setResuming(false);
      } else {
        console.error('Failed to rejoin game:', error);
        useLobbyStore.getState().setResuming(false);
        setLobbyError(error || 'Failed to rejoin game');
      }
    };

    const onGameStarted = ({ initialState }: { initialState: GameInitialState }) => {
      setGameStarted(true, initialState);
    };

    const onFullState = ({ state }: { state: PersistedGameState }) => {
      if (IS_DEV) {
        console.debug('[sync] fullState', {
          incomingVersion: state.version,
          phase: state.phase,
          subPhase: state.subPhase,
          setupTurnIndex: state.setupTurnIndex,
        });
      }
      applyServerState(state);
      setSyncError(null);
      setSyncing(false);
      useLobbyStore.getState().setResuming(false);
    };

    const onStateUpdate = ({ patch, version }: { patch: Partial<PersistedGameState>; version: number }) => {
      const currentVersion = useGameStore.getState().serverVersion;
      if (version <= currentVersion) {
        const liveCampaignId =
          useGameStore.getState().campaignId || useLobbyStore.getState().currentLobby?.campaignId;
        if (IS_DEV) {
          console.debug('[sync] stalePatchDetected', {
            incomingVersion: version,
            currentVersion,
            phase: patch.phase,
            subPhase: patch.subPhase,
            setupTurnIndex: patch.setupTurnIndex,
            liveCampaignId,
          });
        }
        if (liveCampaignId) {
          requestStateSync(liveCampaignId);
          return;
        }
      }

      if (IS_DEV) {
        console.debug('[sync] stateUpdate', {
          incomingVersion: version,
          currentVersion,
          phase: patch.phase,
          subPhase: patch.subPhase,
          setupTurnIndex: patch.setupTurnIndex,
        });
      }
      applyServerPatch(patch, version);
    };

    const onSetupTurn = (setupTurn: SetupTurnEvent) => {
      if (IS_DEV) {
        console.debug('[sync] setupTurn', {
          version: setupTurn.version,
          setupTurnIndex: setupTurn.setupTurnIndex,
          currentSetupPlayerId: setupTurn.currentSetupPlayerId,
          subPhase: setupTurn.subPhase,
        });
      }
      applySetupTurn(setupTurn);
    };

    const onActionResult = (result: GameActionResult) => {
      const { success, error } = result;
      if (!success) {
        if (IS_DEV) {
          console.debug('[sync] actionReject', {
            reasonCode: result.reasonCode,
            error,
            phase: result.phase,
            subPhase: result.subPhase,
            setupTurnIndex: result.setupTurnIndex,
            expectedPlayerId: result.expectedPlayerId,
            localVersion: useGameStore.getState().serverVersion,
            serverVersion: result.serverVersion,
          });
        }

        if (error) {
          console.error('Game action failed:', error);
        }

        const liveCampaignId =
          useGameStore.getState().campaignId || useLobbyStore.getState().currentLobby?.campaignId;

        if (result.reasonCode === 'STATE_VERSION_MISMATCH' && liveCampaignId) {
          requestStateSync(liveCampaignId);
          return;
        }

        if (shouldRequestSetupResync(result) && liveCampaignId) {
          requestStateSync(liveCampaignId);
          return;
        }

        // For non-setup failures, force a state refresh to recover from any
        // client/server phase drift (e.g. stale ATTACK sub-phase).
        if (liveCampaignId && result.reasonCode !== 'INVALID_PAYLOAD') {
          requestStateSync(liveCampaignId);
          return;
        }

        setSyncError(error || 'Game action failed');
      } else {
        setSyncError(null);
        setSyncing(false);
      }
    };

    const onPostGame = ({ winnerId, winnerName, winCondition }: { winnerId: string; winnerName: string; winCondition: 'stars' | 'elimination' | 'domination' }) => {
      console.log(`Game over! Winner: ${winnerName} (${winnerId}), condition: ${winCondition}`);
      setPostGameWinner(winnerId, winnerName, winCondition);
    };

    const onGameComplete = ({ campaignId }: { campaignId: string }) => {
      console.log(`Game complete for campaign ${campaignId}, returning to lobby`);
      clearPostGameWinner();
      resetGameState();
    };

    const onCampaignHistory = ({ campaign }: { campaign: CampaignFull }) => {
      setCampaignHistory(campaign);
    };

    const onCampaignParticipants = ({ campaignId, participants }: { campaignId: string; participants: Array<{ odId: string; name: string }> }) => {
      setPendingCampaignParticipants(campaignId, participants);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('campaign:list', onCampaignList);
    socket.on('lobby:state', onLobbyState);
    socket.on('lobby:playerJoined', onLobbyPlayerJoined);
    socket.on('lobby:playerLeft', onLobbyPlayerLeft);
    socket.on('lobby:kicked', onLobbyKicked);
    socket.on('lobby:error', onLobbyError);
    socket.on('campaign:deleteError', onCampaignDeleteError);
    socket.on('lobby:tokenAssigned', onTokenAssigned);
    socket.on('lobby:claimSeatResult', onClaimSeatResult);
    socket.on('game:rejoinResult', onRejoinResult);
    socket.on('game:started', onGameStarted);
    socket.on('game:fullState', onFullState);
    socket.on('game:stateUpdate', onStateUpdate);
    socket.on('game:setupTurn', onSetupTurn);
    socket.on('game:actionResult', onActionResult);
    socket.on('game:postGame', onPostGame);
    socket.on('game:gameComplete', onGameComplete);
    socket.on('campaign:history', onCampaignHistory);
    socket.on('campaign:participants', onCampaignParticipants);

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    } else {
      // Already connected, update state
      setConnected(true, socket.id);
    }

    // Cleanup on unmount
    return () => {
      // Don't disconnect socket, just remove listeners
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('campaign:list', onCampaignList);
      socket.off('lobby:state', onLobbyState);
      socket.off('lobby:playerJoined', onLobbyPlayerJoined);
      socket.off('lobby:playerLeft', onLobbyPlayerLeft);
      socket.off('lobby:kicked', onLobbyKicked);
      socket.off('lobby:error', onLobbyError);
      socket.off('lobby:tokenAssigned', onTokenAssigned);
      socket.off('lobby:claimSeatResult', onClaimSeatResult);
      socket.off('campaign:deleteError', onCampaignDeleteError);
      socket.off('game:started', onGameStarted);
      socket.off('game:fullState', onFullState);
      socket.off('game:stateUpdate', onStateUpdate);
      socket.off('game:setupTurn', onSetupTurn);
      socket.off('game:actionResult', onActionResult);
      socket.off('game:postGame', onPostGame);
      socket.off('game:gameComplete', onGameComplete);
      socket.off('game:rejoinResult', onRejoinResult);
      socket.off('campaign:history', onCampaignHistory);
      socket.off('campaign:participants', onCampaignParticipants);
    };
  }, [
    setConnected,
    setConnectionError,
    setCampaigns,
    setCurrentLobby,
    updateLobbyPlayer,
    removePlayerFromLobby,
    setLobbyError,
    leaveLobby,
    setGameStarted,
    setCampaignHistory,
    setPostGameWinner,
    clearPostGameWinner,
    resetGameState,
    applyServerState,
    applyServerPatch,
    applySetupTurn,
    setSyncing,
    setSyncError,
    saveTokenForCampaign,
    setLocalPlayerOdId,
    setPendingCampaignParticipants,
  ]);

  // Socket action creators
  const createCampaign = useCallback((name: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('campaign:create', { name });
    }
  }, []);

  const refreshCampaigns = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('campaign:list');
    }
  }, []);

  const joinLobby = useCallback((campaignId: string, playerName: string, playerTokenOverride?: string) => {
    if (socketRef.current?.connected) {
      // Include existing token if we have one for this campaign
      const existingToken = loadTokenForCampaign(campaignId);
      const tokenToUse = playerTokenOverride || existingToken || undefined;
      socketRef.current.emit('lobby:join', {
        campaignId,
        playerName,
        playerToken: tokenToUse,
      });
    }
  }, [loadTokenForCampaign]);

  const leaveLobbySocket = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('lobby:leave');
      leaveLobby();
    }
  }, [leaveLobby]);

  const setReady = useCallback((isReady: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('lobby:ready', { isReady });
    }
  }, []);

  const transferHost = useCallback((targetSocketId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('lobby:transferHost', { targetSocketId });
    }
  }, []);

  const kickPlayer = useCallback((targetSocketId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('lobby:kick', { targetSocketId });
    }
  }, []);

  const startGame = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('lobby:start');
    }
  }, []);

  const deleteCampaign = useCallback((campaignId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('campaign:delete', { campaignId });
    }
  }, []);

  // Get campaign history
  const getCampaignHistory = useCallback((campaignId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('campaign:getHistory', { campaignId });
    }
  }, []);

  const getCampaignParticipants = useCallback((campaignId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('campaign:getParticipants', { campaignId });
    }
  }, []);

  // Request full game state (for reconnection/refresh)
  const requestGameState = useCallback((campaignId: string) => {
    if (socketRef.current?.connected) {
      setSyncing(true);
      socketRef.current.emit('game:requestState', { campaignId });
    }
  }, [setSyncing]);

  // Send a game action to the server
  const sendGameAction = useCallback((actionType: GameActionType, payload: Record<string, unknown>) => {
    const campaignIdToUse = currentCampaignId || currentLobby?.campaignId;
    if (!socketRef.current?.connected || !campaignIdToUse) {
      console.error('Cannot send game action: not connected or no campaign');
      return;
    }
    const action: GameAction = {
      type: actionType,
      payload,
      clientVersion: getClientVersion(),
      timestamp: Date.now(),
    };

    if (IS_DEV) {
      const state = useGameStore.getState();
      console.debug('[sync] actionSend', {
        campaignId: campaignIdToUse,
        actionType,
        localVersion: action.clientVersion,
        phase: state.phase,
        subPhase: state.subPhase,
        setupTurnIndex: state.setupTurnIndex,
      });
    }

    setSyncing(true);
    socketRef.current.emit('game:action', { campaignId: campaignIdToUse, action });
  }, [currentCampaignId, currentLobby, getClientVersion, setSyncing]);

  // Declare victory to the server
  const declareVictory = useCallback((
    winnerId: string,
    winCondition: 'stars' | 'elimination' | 'domination'
  ) => {
    const campaignIdToUse = currentCampaignId || currentLobby?.campaignId;
    if (!socketRef.current?.connected || !campaignIdToUse) {
      console.error('Cannot declare victory: not connected or no campaign');
      return;
    }

    socketRef.current.emit('game:declareVictory', {
      campaignId: campaignIdToUse,
      winnerId,
      winCondition,
    });
  }, [currentCampaignId, currentLobby]);

  // Complete post-game phase with winner's rewards
  const completePostGame = useCallback((
    scarsPlaced: Array<{ territoryId: string; scarType: string | null }>,
    citiesBuilt: Array<{ territoryId: string; cityTier: number; cityName: string | null }>
  ) => {
    const campaignIdToUse = currentCampaignId || currentLobby?.campaignId;
    if (!socketRef.current?.connected || !campaignIdToUse) {
      console.error('Cannot complete post-game: not connected or no campaign');
      return;
    }

    socketRef.current.emit('game:completePostGame', {
      campaignId: campaignIdToUse,
      scarsPlaced,
      citiesBuilt,
    });
  }, [currentCampaignId, currentLobby]);

  // Rejoin an active game
  const rejoinGame = useCallback((campaignId: string) => {
    const token = loadTokenForCampaign(campaignId);
    if (!socketRef.current?.connected || !token) {
      console.error('Cannot rejoin game: not connected or no token');
      return false;
    }

    setResuming(true);
    socketRef.current.emit('game:rejoin', { campaignId, playerToken: token });
    return true;
  }, [loadTokenForCampaign, setResuming]);

  const claimSeat = useCallback((campaignId: string, targetOdId: string) => {
    if (!socketRef.current?.connected) {
      setLobbyError('Not connected');
      return false;
    }
    const displayName = useLobbyStore.getState().playerName || 'Player';
    socketRef.current.emit('lobby:claimSeat', {
      campaignId,
      targetOdId,
      playerName: displayName,
    });
    return true;
  }, [setLobbyError]);

  return {
    socket: socketRef.current,
    createCampaign,
    deleteCampaign,
    refreshCampaigns,
    joinLobby,
    leaveLobby: leaveLobbySocket,
    setReady,
    transferHost,
    kickPlayer,
    startGame,
    getCampaignHistory,
    getCampaignParticipants,
    requestGameState,
    sendGameAction,
    declareVictory,
    completePostGame,
    rejoinGame,
    claimSeat,
  };
}
