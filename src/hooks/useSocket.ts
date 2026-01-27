/**
 * Socket.io connection hook
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLobbyStore, Campaign, Lobby, LobbyPlayer, GameInitialState } from '@/store/lobbyStore';

// Server URL - use environment variable or default to localhost
const SOCKET_URL = (import.meta as { env?: { VITE_SOCKET_URL?: string } }).env?.VITE_SOCKET_URL || 'http://localhost:3001';

// Define socket event types
interface ServerToClientEvents {
  'campaign:list': (data: { campaigns: Campaign[] }) => void;
  'lobby:state': (data: { lobby: Lobby }) => void;
  'lobby:playerJoined': (data: { player: LobbyPlayer }) => void;
  'lobby:playerLeft': (data: { socketId: string }) => void;
  'lobby:kicked': () => void;
  'lobby:error': (data: { message: string }) => void;
  'game:started': (data: { initialState: GameInitialState }) => void;
}

interface ClientToServerEvents {
  'campaign:create': (data: { name: string }) => void;
  'campaign:list': () => void;
  'lobby:join': (data: { campaignId: string; playerName: string }) => void;
  'lobby:leave': () => void;
  'lobby:ready': (data: { isReady: boolean }) => void;
  'lobby:transferHost': (data: { targetSocketId: string }) => void;
  'lobby:kick': (data: { targetSocketId: string }) => void;
  'lobby:start': () => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Singleton socket instance
let socketInstance: TypedSocket | null = null;

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
    playerName,
    pendingCampaignId,
    closeNamePrompt,
  } = useLobbyStore();

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

    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setConnected(true, socket.id);
      setConnectionError(null);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setConnectionError(`Connection failed: ${error.message}`);
    });

    // Campaign events
    socket.on('campaign:list', ({ campaigns }) => {
      setCampaigns(campaigns);
    });

    // Lobby events
    socket.on('lobby:state', ({ lobby }) => {
      setCurrentLobby(lobby);
    });

    socket.on('lobby:playerJoined', ({ player }) => {
      updateLobbyPlayer(player);
    });

    socket.on('lobby:playerLeft', ({ socketId }) => {
      removePlayerFromLobby(socketId);
    });

    socket.on('lobby:kicked', () => {
      leaveLobby();
      setLobbyError('You were kicked from the lobby');
    });

    socket.on('lobby:error', ({ message }) => {
      setLobbyError(message);
    });

    // Game events
    socket.on('game:started', ({ initialState }) => {
      setGameStarted(true, initialState);
    });

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
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('campaign:list');
      socket.off('lobby:state');
      socket.off('lobby:playerJoined');
      socket.off('lobby:playerLeft');
      socket.off('lobby:kicked');
      socket.off('lobby:error');
      socket.off('game:started');
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
  ]);

  // Auto-join pending campaign when player name is set
  useEffect(() => {
    if (pendingCampaignId && playerName && socketRef.current?.connected) {
      socketRef.current.emit('lobby:join', {
        campaignId: pendingCampaignId,
        playerName,
      });
      closeNamePrompt();
    }
  }, [pendingCampaignId, playerName, closeNamePrompt]);

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

  const joinLobby = useCallback((campaignId: string, playerName: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('lobby:join', { campaignId, playerName });
    }
  }, []);

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

  return {
    socket: socketRef.current,
    createCampaign,
    refreshCampaigns,
    joinLobby,
    leaveLobby: leaveLobbySocket,
    setReady,
    transferHost,
    kickPlayer,
    startGame,
  };
}
