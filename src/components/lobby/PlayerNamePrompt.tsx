/**
 * Player name input modal
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLobbyStore } from '@/store/lobbyStore';

export function PlayerNamePrompt() {
  const { showNamePrompt, playerName, setPlayerName, closeNamePrompt } =
    useLobbyStore();

  const [name, setName] = useState(playerName || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (showNamePrompt && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNamePrompt]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      if (trimmedName) {
        setPlayerName(trimmedName);
        // Note: The useSocket hook will automatically join the pending campaign
      }
    },
    [name, setPlayerName]
  );

  const handleCancel = useCallback(() => {
    closeNamePrompt();
  }, [closeNamePrompt]);

  if (!showNamePrompt) {
    return null;
  }

  const isValid = name.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-board-dark border-4 border-board-border rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-board-border px-6 py-4">
          <h2 className="text-board-parchment font-display text-2xl text-center">
            Enter Your Name
          </h2>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-board-parchment font-body text-sm mb-2">
              Player Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
              maxLength={20}
              className="w-full px-4 py-3 bg-board-wood border-2 border-board-border rounded text-board-parchment placeholder-board-parchment/50 font-body text-lg focus:outline-none focus:border-amber-500"
            />
            <p className="text-board-parchment/60 text-sm mt-2">
              This name will be visible to other players in the lobby.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-3 rounded font-display text-lg bg-gray-700 text-gray-300 hover:bg-gray-600 border-2 border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={`flex-1 py-3 rounded font-display text-lg transition-colors ${
                isValid
                  ? 'bg-green-600 text-white hover:bg-green-500 border-2 border-green-400'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed border-2 border-gray-500'
              }`}
            >
              Join Lobby
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
