/**
 * Campaign history component - displays completed games and campaign statistics
 */

import { useState } from 'react';
import { CampaignFull } from '@/store/lobbyStore';

interface CampaignHistoryProps {
  campaign: CampaignFull;
  onClose: () => void;
}

export function CampaignHistory({ campaign, onClose }: CampaignHistoryProps) {
  const [expandedGame, setExpandedGame] = useState<number | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: number, end: number) => {
    const minutes = Math.round((end - start) / 60000);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-board-dark border-4 border-board-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-board-border px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-board-parchment font-display text-2xl">
              {campaign.name}
            </h2>
            <p className="text-board-parchment/60 text-sm">
              Campaign History - {campaign.gamesPlayed} {campaign.gamesPlayed === 1 ? 'Game' : 'Games'} Played
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Participants Summary */}
          {campaign.participants.length > 0 && (
            <div className="bg-board-wood/30 rounded-lg p-4">
              <h3 className="text-board-parchment font-display text-lg mb-3">
                Leaderboard
              </h3>
              <div className="space-y-2">
                {campaign.participants
                  .sort((a, b) => b.wins - a.wins)
                  .map((participant, index) => (
                    <div
                      key={participant.odId}
                      className="flex justify-between items-center text-board-parchment/80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center text-board-parchment/40">
                          {index + 1}.
                        </span>
                        <span className={index === 0 && participant.wins > 0 ? 'text-amber-400' : ''}>
                          {participant.name}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-amber-400">
                          {participant.wins} {participant.wins === 1 ? 'Win' : 'Wins'}
                        </span>
                        <span className="text-board-parchment/60">
                          {participant.gamesPlayed} Played
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Games List */}
          {campaign.completedGames.length === 0 ? (
            <div className="text-center py-8 text-board-parchment/60">
              <p className="text-lg">No games completed yet</p>
              <p className="text-sm mt-2">Start a game to begin writing your campaign's history!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-board-parchment font-display text-lg">
                Game History
              </h3>
              {campaign.completedGames
                .slice()
                .reverse()
                .map((game) => (
                  <div
                    key={game.gameId}
                    className="bg-board-wood/20 rounded-lg border border-board-border/50 overflow-hidden"
                  >
                    {/* Game header - clickable */}
                    <button
                      onClick={() => setExpandedGame(expandedGame === game.gameNumber ? null : game.gameNumber)}
                      className="w-full px-4 py-3 flex justify-between items-center hover:bg-board-wood/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-display text-lg">
                          Game {game.gameNumber}
                        </span>
                        <span className="text-board-parchment/60 text-sm">
                          {formatDate(game.endedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-board-parchment">
                          Winner: <span className="text-amber-400">{game.winnerName}</span>
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 text-board-parchment/60 transition-transform ${
                            expandedGame === game.gameNumber ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {expandedGame === game.gameNumber && (
                      <div className="px-4 pb-4 border-t border-board-border/30">
                        {/* Victory info */}
                        <div className="mt-3 mb-4 p-3 bg-amber-900/20 rounded border border-amber-700/30">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-amber-400 font-display">
                                {game.winnerName}
                              </span>
                              <span className="text-board-parchment/60 text-sm ml-2">
                                ({game.winnerFaction})
                              </span>
                            </div>
                            <span className="text-board-parchment/60 text-sm">
                              Victory by {game.winCondition === 'stars' ? 'Red Stars' : game.winCondition === 'elimination' ? 'Elimination' : 'Domination'}
                            </span>
                          </div>
                          <div className="text-board-parchment/40 text-xs mt-1">
                            Duration: {formatDuration(game.startedAt, game.endedAt)}
                          </div>
                        </div>

                        {/* Final standings */}
                        <div className="mb-4">
                          <h4 className="text-board-parchment/80 text-sm font-display mb-2">
                            Final Standings
                          </h4>
                          <div className="space-y-1">
                            {game.placements.map((p) => (
                              <div
                                key={p.playerId}
                                className="flex justify-between items-center text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 text-center ${
                                    p.placement === 1 ? 'text-amber-400' : 'text-board-parchment/40'
                                  }`}>
                                    {p.placement}.
                                  </span>
                                  <span className={`${
                                    p.placement === 1 ? 'text-amber-400' : 'text-board-parchment/80'
                                  } ${p.wasEliminated ? 'line-through opacity-50' : ''}`}>
                                    {p.playerName}
                                  </span>
                                  {p.wasEliminated && (
                                    <span className="text-red-400/60 text-xs">(eliminated)</span>
                                  )}
                                </div>
                                <div className="flex gap-3 text-board-parchment/60">
                                  <span>{p.territoriesHeld} territories</span>
                                  <span>{p.redStars} stars</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Scars placed */}
                        {game.scarsPlaced.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-board-parchment/80 text-sm font-display mb-2">
                              Scars Placed
                            </h4>
                            <div className="space-y-1">
                              {game.scarsPlaced.map((scar, i) => (
                                <div key={i} className="text-sm text-board-parchment/60">
                                  <span className="text-red-400">{scar.scarType}</span>
                                  {' on '}
                                  <span className="text-board-parchment/80">{scar.territoryName}</span>
                                  {' by '}
                                  <span>{scar.placedByPlayerName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cities built */}
                        {game.citiesBuilt.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-board-parchment/80 text-sm font-display mb-2">
                              Cities Founded
                            </h4>
                            <div className="space-y-1">
                              {game.citiesBuilt.map((city, i) => (
                                <div key={i} className="text-sm text-board-parchment/60">
                                  <span className="text-blue-400">
                                    {city.cityName || `City (Tier ${city.cityTier})`}
                                  </span>
                                  {' in '}
                                  <span className="text-board-parchment/80">{city.territoryName}</span>
                                  {' by '}
                                  <span>{city.builtByPlayerName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Packets opened */}
                        {game.packetsOpened.length > 0 && (
                          <div>
                            <h4 className="text-board-parchment/80 text-sm font-display mb-2">
                              Packets Opened
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {game.packetsOpened.map((packet, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-1 bg-purple-900/30 text-purple-400 text-xs rounded"
                                >
                                  {packet}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Packets Opened Summary */}
          {campaign.packetsOpened.length > 0 && (
            <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/30">
              <h3 className="text-purple-400 font-display text-lg mb-3">
                All Packets Opened
              </h3>
              <div className="space-y-2">
                {campaign.packetsOpened.map((packet, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-purple-300">{packet.packetId}</span>
                    <div className="text-board-parchment/60">
                      Game {packet.openedInGame} - {packet.openedByName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-board-border/50 px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 rounded font-display text-lg bg-gray-700 text-gray-300 hover:bg-gray-600 border-2 border-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
