/**
 * Lobby screen component - shows players in lobby with ready status and host controls
 */

import { useCallback, useState } from 'react';
import { useLobbyStore, LobbyPlayer } from '@/store/lobbyStore';
import { ConnectionStatus } from './ConnectionStatus';

interface LobbyScreenProps {
  leaveLobby: () => void;
  setReady: (isReady: boolean) => void;
  transferHost: (targetSocketId: string) => void;
  kickPlayer: (targetSocketId: string) => void;
  startGame: () => void;
  rejoinGame: (campaignId: string) => boolean;
  claimSeat: (campaignId: string, targetOdId: string) => boolean;
}

export function LobbyScreen({
  leaveLobby,
  setReady,
  transferHost,
  kickPlayer,
  startGame,
  rejoinGame,
  claimSeat,
}: LobbyScreenProps) {
  const { currentLobby, socketId, lobbyError, setLobbyError } = useLobbyStore();

  const [confirmKick, setConfirmKick] = useState<string | null>(null);

  const isHost = currentLobby?.players.find(
    (p) => p.socketId === socketId
  )?.isHost;
  const localPlayer = currentLobby?.players.find(
    (p) => p.socketId === socketId
  );
  const inGameLobby = currentLobby?.status === 'in_game';
  const localSeatHolder = Boolean(localPlayer?.isSeatHolder);

  // Check if all non-host players are ready
  const allReady =
    currentLobby &&
    currentLobby.players.length >= 2 &&
    currentLobby.players.every((p) => p.isReady || p.isHost);

  const handleToggleReady = useCallback(() => {
    if (localPlayer) {
      setReady(!localPlayer.isReady);
    }
  }, [localPlayer, setReady]);

  const handleTransferHost = useCallback(
    (targetSocketId: string) => {
      transferHost(targetSocketId);
    },
    [transferHost]
  );

  const handleKickPlayer = useCallback(
    (targetSocketId: string) => {
      if (confirmKick === targetSocketId) {
        kickPlayer(targetSocketId);
        setConfirmKick(null);
      } else {
        setConfirmKick(targetSocketId);
        // Auto-cancel after 3 seconds
        setTimeout(() => setConfirmKick(null), 3000);
      }
    },
    [confirmKick, kickPlayer]
  );

  const handleStartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  const handleLeaveLobby = useCallback(() => {
    leaveLobby();
    // Clear URL hash
    window.location.hash = '';
  }, [leaveLobby]);

  const handleRejoinGame = useCallback(() => {
    if (!currentLobby) return;
    const ok = rejoinGame(currentLobby.campaignId);
    if (!ok) {
      setLobbyError('Unable to rejoin this seat from this browser.');
    }
  }, [currentLobby, rejoinGame, setLobbyError]);

  const handleClaimSeat = useCallback((targetOdId: string) => {
    if (!currentLobby) return;
    claimSeat(currentLobby.campaignId, targetOdId);
  }, [currentLobby, claimSeat]);

  const handleCopyLink = useCallback(() => {
    if (currentLobby) {
      const url = `${window.location.origin}${window.location.pathname}#/join/${currentLobby.campaignId}`;
      navigator.clipboard.writeText(url);
      setLobbyError('Link copied to clipboard!');
      setTimeout(() => setLobbyError(null), 2000);
    }
  }, [currentLobby, setLobbyError]);

  if (!currentLobby) {
    return null;
  }

  return (
    <div className="min-h-screen bg-board-wood flex flex-col">
      {/* Header */}
      <header className="h-16 bg-board-border flex items-center justify-between px-6 border-b-2 border-board-wood">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLeaveLobby}
            className="text-board-parchment/60 hover:text-board-parchment font-body transition-colors"
          >
            &larr; Leave
          </button>
          <h1 className="text-board-parchment font-display text-2xl font-bold">
            {currentLobby.campaignName}
          </h1>
        </div>
        <ConnectionStatus />
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {/* Lobby info */}
        <div className="text-center mb-8">
          <h2 className="text-board-parchment font-display text-3xl mb-2">
            Game Lobby
          </h2>
          <p className="text-board-parchment/60 font-body mb-4">
            {inGameLobby
              ? 'Active game lobby. Claim a seat to continue.'
              : `Waiting for players... (${currentLobby.players.length}/${currentLobby.maxPlayers})`}
          </p>
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 bg-board-dark text-board-parchment font-body rounded border-2 border-board-border hover:border-amber-500 transition-colors text-sm"
          >
            Copy Invite Link
          </button>
        </div>

        {/* Error/info message */}
        {lobbyError && (
          <div
            className={`mb-6 p-4 rounded border-2 text-center font-body ${
              lobbyError.includes('copied')
                ? 'bg-green-900/30 border-green-600 text-green-400'
                : 'bg-red-900/30 border-red-600 text-red-400'
            }`}
          >
            {lobbyError}
          </div>
        )}

        {/* Player list */}
        <div className="bg-board-dark border-2 border-board-border rounded-lg overflow-hidden mb-6">
          <div className="bg-board-border px-4 py-3">
            <h3 className="text-board-parchment font-display text-lg">
              Players
            </h3>
          </div>
          <div className="divide-y divide-board-border/50">
            {currentLobby.players.map((player) => (
              <PlayerRow
                key={player.socketId}
                player={player}
                isLocalPlayer={player.socketId === socketId}
                isHostView={isHost || false}
                confirmKick={confirmKick}
                onTransferHost={handleTransferHost}
                onKickPlayer={handleKickPlayer}
                showClaimSeat={Boolean(inGameLobby && !localSeatHolder && player.isSeatHolder && !localPlayer?.isSeatHolder)}
                onClaimSeat={handleClaimSeat}
              />
            ))}
            {/* Empty slots */}
            {!inGameLobby && Array.from({
              length: currentLobby.maxPlayers - currentLobby.players.length,
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="px-4 py-3 text-board-parchment/30 font-body italic"
              >
                Empty slot
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4">
          {inGameLobby && localSeatHolder && (
            <button
              onClick={handleRejoinGame}
              className="w-full py-4 rounded font-display text-xl transition-colors bg-amber-600 text-white border-2 border-amber-400 hover:bg-amber-500"
            >
              Enter Game
            </button>
          )}

          {inGameLobby && !localSeatHolder && (
            <p className="text-center text-amber-300 font-body">
              Claim one of the seat rows above to enter the active game.
            </p>
          )}

          {/* Ready button (non-hosts only) */}
          {!inGameLobby && !isHost && (
            <button
              onClick={handleToggleReady}
              className={`w-full py-4 rounded font-display text-xl transition-colors ${
                localPlayer?.isReady
                  ? 'bg-green-600 text-white border-2 border-green-400 hover:bg-green-500'
                  : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
              }`}
            >
              {localPlayer?.isReady ? 'Ready!' : 'Click to Ready Up'}
            </button>
          )}

          {/* Start game button (host only) */}
          {!inGameLobby && isHost && (
            <button
              onClick={handleStartGame}
              disabled={!allReady}
              className={`w-full py-4 rounded font-display text-xl transition-colors ${
                allReady
                  ? 'bg-green-600 text-white border-2 border-green-400 hover:bg-green-500'
                  : 'bg-gray-700 text-gray-400 border-2 border-gray-600 cursor-not-allowed'
              }`}
            >
              {allReady
                ? 'Start Game'
                : `Waiting for ${
                    currentLobby.players.filter((p) => !p.isReady && !p.isHost)
                      .length
                  } player(s) to ready up`}
            </button>
          )}

          {/* Minimum players warning */}
          {!inGameLobby && currentLobby.players.length < 2 && (
            <p className="text-center text-amber-400 font-body">
              Need at least 2 players to start
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

interface PlayerRowProps {
  player: LobbyPlayer;
  isLocalPlayer: boolean;
  isHostView: boolean;
  confirmKick: string | null;
  onTransferHost: (socketId: string) => void;
  onKickPlayer: (socketId: string) => void;
  showClaimSeat?: boolean;
  onClaimSeat?: (odId: string) => void;
}

function PlayerRow({
  player,
  isLocalPlayer,
  isHostView,
  confirmKick,
  onTransferHost,
  onKickPlayer,
  showClaimSeat = false,
  onClaimSeat,
}: PlayerRowProps) {
  return (
    <div
      className={`px-4 py-3 flex items-center justify-between ${
        isLocalPlayer ? 'bg-board-wood/20' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Host crown or ready indicator */}
        <div className="w-6 h-6 flex items-center justify-center">
          {player.isHost ? (
            <span className="text-amber-400 text-lg" title="Host">
              &#9812;
            </span>
          ) : player.isReady ? (
            <span className="text-green-400 text-lg" title="Ready">
              &#10003;
            </span>
          ) : (
            <span className="text-gray-500 text-lg" title="Not ready">
              &#9711;
            </span>
          )}
        </div>

        {/* Player name */}
        <span className="text-board-parchment font-body">
          {player.name}
          {isLocalPlayer && (
            <span className="text-board-parchment/60 ml-2">(you)</span>
          )}
        </span>
      </div>

      {/* Host controls */}
      {isHostView && !isLocalPlayer && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTransferHost(player.socketId)}
            className="px-3 py-1 text-sm bg-board-wood text-board-parchment font-body rounded border border-board-border hover:border-amber-500 transition-colors"
            title="Make host"
          >
            Make Host
          </button>
          <button
            onClick={() => onKickPlayer(player.socketId)}
            className={`px-3 py-1 text-sm font-body rounded border transition-colors ${
              confirmKick === player.socketId
                ? 'bg-red-600 text-white border-red-400'
                : 'bg-board-wood text-red-400 border-board-border hover:border-red-500'
            }`}
            title={confirmKick === player.socketId ? 'Click again to confirm' : 'Kick player'}
          >
            {confirmKick === player.socketId ? 'Confirm?' : 'Kick'}
          </button>
        </div>
      )}

      {showClaimSeat && onClaimSeat && (
        <button
          onClick={() => onClaimSeat(player.odId)}
          className="px-3 py-1 text-sm bg-amber-700 text-white font-body rounded border border-amber-400 hover:bg-amber-600 transition-colors"
        >
          Claim Seat
        </button>
      )}

      {/* Ready status text for non-host view */}
      {!isHostView && !player.isHost && (
        <span
          className={`text-sm font-body ${
            player.isReady ? 'text-green-400' : 'text-gray-500'
          }`}
        >
          {player.isReady ? 'Ready' : 'Not Ready'}
        </span>
      )}
    </div>
  );
}
