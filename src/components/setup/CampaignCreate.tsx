import { useState, useCallback } from 'react';

interface CampaignCreateProps {
  onStartCampaign: (campaignName: string, playerNames: string[]) => void;
}

const DEFAULT_PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5'];

export function CampaignCreate({ onStartCampaign }: CampaignCreateProps) {
  const [campaignName, setCampaignName] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState<string[]>(DEFAULT_PLAYER_NAMES.slice(0, 4));

  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
    setPlayerNames((prev) => {
      if (count > prev.length) {
        // Add default names for new players
        const newNames = [...prev];
        for (let i = prev.length; i < count; i++) {
          newNames.push(DEFAULT_PLAYER_NAMES[i] || `Player ${i + 1}`);
        }
        return newNames;
      }
      // Trim to new count
      return prev.slice(0, count);
    });
  }, []);

  const handlePlayerNameChange = useCallback((index: number, name: string) => {
    setPlayerNames((prev) => {
      const newNames = [...prev];
      newNames[index] = name;
      return newNames;
    });
  }, []);

  const handleStart = useCallback(() => {
    const finalCampaignName = campaignName.trim() || 'New Campaign';
    const finalPlayerNames = playerNames.map((name, i) => name.trim() || `Player ${i + 1}`);
    onStartCampaign(finalCampaignName, finalPlayerNames);
  }, [campaignName, playerNames, onStartCampaign]);

  const isValid = playerNames.every((name) => name.trim().length > 0);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-board-dark border-4 border-board-border rounded-lg shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="bg-board-border px-6 py-4">
          <h2 className="text-board-parchment font-display text-2xl text-center">
            Create Campaign
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-board-parchment font-body text-sm mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Enter campaign name..."
              className="w-full px-4 py-2 bg-board-wood border-2 border-board-border rounded text-board-parchment placeholder-board-parchment/50 font-body focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Player Count */}
          <div>
            <label className="block text-board-parchment font-body text-sm mb-2">
              Number of Players
            </label>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  onClick={() => handlePlayerCountChange(count)}
                  className={`flex-1 py-2 rounded font-display text-lg transition-colors ${
                    playerCount === count
                      ? 'bg-amber-600 text-white border-2 border-amber-400'
                      : 'bg-board-wood text-board-parchment border-2 border-board-border hover:border-amber-500'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Player Names */}
          <div>
            <label className="block text-board-parchment font-body text-sm mb-2">
              Player Names
            </label>
            <div className="space-y-2">
              {playerNames.map((name, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-board-parchment/60 font-body text-sm w-6">
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                    placeholder={`Player ${index + 1}`}
                    className="flex-1 px-3 py-2 bg-board-wood border-2 border-board-border rounded text-board-parchment placeholder-board-parchment/50 font-body focus:outline-none focus:border-amber-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-board-border">
          <button
            onClick={handleStart}
            disabled={!isValid}
            className={`w-full py-3 rounded font-display text-xl transition-colors ${
              isValid
                ? 'bg-green-600 text-white hover:bg-green-500 border-2 border-green-400'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed border-2 border-gray-500'
            }`}
          >
            Start Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
