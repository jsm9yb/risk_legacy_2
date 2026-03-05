/**
 * Post-game screen component - handles Write Phase rewards after victory
 * Allows winner to:
 * - Found or upgrade a city (if eligible)
 * - Place a scar card
 * - Name territories
 */

import { useState, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { TerritoryId, ScarType, CityTier } from '@/types/territory';

interface PostGameScreenProps {
  winnerId: string;
  winnerName: string;
  onComplete: (
    scarsPlaced: Array<{ territoryId: string; scarType: ScarType }>,
    citiesBuilt: Array<{ territoryId: string; cityTier: CityTier; cityName: string | null }>
  ) => void;
}

type PostGamePhase = 'overview' | 'place_city' | 'place_scar' | 'confirm';

const SCAR_TYPES: { id: ScarType; name: string; description: string }[] = [
  { id: 'bunker', name: 'Bunker', description: '+1 to defender highest die' },
  { id: 'ammo_shortage', name: 'Ammo Shortage', description: '-1 to defender highest die' },
  { id: 'biohazard', name: 'Biohazard', description: 'Cannot be selected for maneuver' },
  { id: 'mercenary', name: 'Mercenary', description: '+1 troop when attacking from here' },
  { id: 'fortification', name: 'Fortification', description: 'Blocks first 2 attacking troops' },
];

export function PostGameScreen({ winnerId, winnerName, onComplete }: PostGameScreenProps) {
  const { territories, players } = useGameStore();

  const [phase, setPhase] = useState<PostGamePhase>('overview');
  const [selectedCityTerritory, setSelectedCityTerritory] = useState<TerritoryId | null>(null);
  const [selectedCityTier, setSelectedCityTier] = useState<CityTier>(1);
  const [cityName, setCityName] = useState('');
  const [selectedScarTerritory, setSelectedScarTerritory] = useState<TerritoryId | null>(null);
  const [selectedScarType, setSelectedScarType] = useState<ScarType>(null);

  const winner = players.find((p) => p.id === winnerId);

  // Get territories the winner controls (for city placement)
  const winnerTerritories = Object.values(territories).filter(
    (t) => t.ownerId === winnerId
  );

  // Get territories eligible for city placement (no city or can upgrade)
  const cityEligibleTerritories = winnerTerritories.filter((t) => t.cityTier < 3);

  // Get all territories for scar placement
  const allTerritories = Object.values(territories);

  // Territories without scars (for new scar placement)
  const scarEligibleTerritories = allTerritories.filter((t) => !t.scarId);

  const handleCitySelect = useCallback((territoryId: TerritoryId) => {
    setSelectedCityTerritory(territoryId);
    const territory = territories[territoryId];
    if (territory) {
      // Default to next tier
      setSelectedCityTier((territory.cityTier + 1) as CityTier);
    }
  }, [territories]);

  const handleScarSelect = useCallback((territoryId: TerritoryId) => {
    setSelectedScarTerritory(territoryId);
  }, []);

  const handleConfirmRewards = useCallback(() => {
    const scarsPlaced: Array<{ territoryId: string; scarType: ScarType }> = [];
    const citiesBuilt: Array<{ territoryId: string; cityTier: CityTier; cityName: string | null }> = [];

    if (selectedCityTerritory && selectedCityTier > 0) {
      citiesBuilt.push({
        territoryId: selectedCityTerritory,
        cityTier: selectedCityTier,
        cityName: cityName.trim() || null,
      });
    }

    if (selectedScarTerritory && selectedScarType) {
      scarsPlaced.push({
        territoryId: selectedScarTerritory,
        scarType: selectedScarType,
      });
    }

    onComplete(scarsPlaced, citiesBuilt);
  }, [selectedCityTerritory, selectedCityTier, cityName, selectedScarTerritory, selectedScarType, onComplete]);

  const skipPhase = useCallback((nextPhase: PostGamePhase) => {
    setPhase(nextPhase);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-board-dark border-4 border-amber-600 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-amber-900 px-6 py-4 text-center shrink-0">
          <h2 className="text-amber-400 font-display text-3xl mb-1">
            Victory!
          </h2>
          <p className="text-board-parchment">
            <span className="text-amber-400 font-display">{winnerName}</span> has won the game!
          </p>
          {winner && (
            <p className="text-board-parchment/60 text-sm mt-1">
              Playing as {winner.factionId} - Win Condition: Stars
            </p>
          )}
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {phase === 'overview' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-board-parchment font-display text-xl mb-2">
                  Write Phase Rewards
                </h3>
                <p className="text-board-parchment/60">
                  As the victor, you may make permanent changes to the world.
                </p>
              </div>

              <div className="grid gap-4">
                {/* City reward */}
                <button
                  onClick={() => setPhase('place_city')}
                  disabled={cityEligibleTerritories.length === 0}
                  className="p-4 bg-blue-900/30 border-2 border-blue-700 rounded-lg text-left hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-blue-400 font-display text-lg">
                        Found or Upgrade a City
                      </h4>
                      <p className="text-board-parchment/60 text-sm">
                        Cities provide population bonus to reinforcements
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Scar reward */}
                <button
                  onClick={() => setPhase('place_scar')}
                  disabled={scarEligibleTerritories.length === 0}
                  className="p-4 bg-red-900/30 border-2 border-red-700 rounded-lg text-left hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-red-400 font-display text-lg">
                        Place a Scar
                      </h4>
                      <p className="text-board-parchment/60 text-sm">
                        Permanently modify a territory with lasting effects
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Skip to finish */}
                <button
                  onClick={() => setPhase('confirm')}
                  className="p-4 bg-board-wood/30 border-2 border-board-border rounded-lg text-left hover:bg-board-wood/50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-board-parchment font-display text-lg">
                        Skip Rewards
                      </h4>
                      <p className="text-board-parchment/60 text-sm">
                        Finish the game without claiming rewards
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-board-parchment/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          )}

          {phase === 'place_city' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setPhase('overview')}
                  className="text-board-parchment/60 hover:text-board-parchment flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h3 className="text-blue-400 font-display text-xl">
                  Found or Upgrade City
                </h3>
                <button
                  onClick={() => skipPhase('place_scar')}
                  className="text-board-parchment/60 hover:text-board-parchment"
                >
                  Skip
                </button>
              </div>

              <p className="text-board-parchment/60 text-center mb-4">
                Select a territory you control to found or upgrade a city
              </p>

              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {cityEligibleTerritories.map((territory) => (
                  <button
                    key={territory.id}
                    onClick={() => handleCitySelect(territory.id)}
                    className={`p-3 rounded border-2 text-left transition-colors ${
                      selectedCityTerritory === territory.id
                        ? 'bg-blue-900/50 border-blue-500'
                        : 'bg-board-wood/20 border-board-border hover:border-blue-700'
                    }`}
                  >
                    <div className="text-board-parchment font-display">
                      {territory.name}
                    </div>
                    <div className="text-board-parchment/60 text-sm">
                      {territory.cityTier === 0
                        ? 'No city'
                        : `City Tier ${territory.cityTier}`}
                    </div>
                  </button>
                ))}
              </div>

              {selectedCityTerritory && (
                <div className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-700/30">
                  <label className="block text-board-parchment/80 text-sm mb-2">
                    City Name (optional)
                  </label>
                  <input
                    type="text"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    placeholder="Enter city name..."
                    maxLength={30}
                    className="w-full px-3 py-2 bg-board-wood border border-board-border rounded text-board-parchment placeholder-board-parchment/40 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-board-parchment/40 text-xs mt-2">
                    City will be Tier {selectedCityTier} (+{selectedCityTier} population)
                  </p>
                </div>
              )}

              <button
                onClick={() => setPhase('place_scar')}
                disabled={!selectedCityTerritory}
                className="w-full py-3 rounded font-display text-lg bg-blue-700 text-white hover:bg-blue-600 border-2 border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedCityTerritory ? 'Continue to Scar' : 'Select a Territory'}
              </button>
            </div>
          )}

          {phase === 'place_scar' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setPhase('place_city')}
                  className="text-board-parchment/60 hover:text-board-parchment flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h3 className="text-red-400 font-display text-xl">
                  Place a Scar
                </h3>
                <button
                  onClick={() => skipPhase('confirm')}
                  className="text-board-parchment/60 hover:text-board-parchment"
                >
                  Skip
                </button>
              </div>

              <p className="text-board-parchment/60 text-center mb-4">
                Select a territory and scar type
              </p>

              {/* Scar type selection */}
              <div className="space-y-2 mb-4">
                <label className="text-board-parchment/80 text-sm">
                  Scar Type
                </label>
                <div className="grid gap-2">
                  {SCAR_TYPES.map((scar) => (
                    <button
                      key={scar.id}
                      onClick={() => setSelectedScarType(scar.id)}
                      className={`p-3 rounded border-2 text-left transition-colors ${
                        selectedScarType === scar.id
                          ? 'bg-red-900/50 border-red-500'
                          : 'bg-board-wood/20 border-board-border hover:border-red-700'
                      }`}
                    >
                      <div className="text-red-400 font-display">
                        {scar.name}
                      </div>
                      <div className="text-board-parchment/60 text-sm">
                        {scar.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Territory selection */}
              {selectedScarType && (
                <div className="space-y-2">
                  <label className="text-board-parchment/80 text-sm">
                    Territory
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                    {scarEligibleTerritories.map((territory) => (
                      <button
                        key={territory.id}
                        onClick={() => handleScarSelect(territory.id)}
                        className={`p-2 rounded border-2 text-center transition-colors ${
                          selectedScarTerritory === territory.id
                            ? 'bg-red-900/50 border-red-500'
                            : 'bg-board-wood/20 border-board-border hover:border-red-700'
                        }`}
                      >
                        <div className="text-board-parchment text-sm">
                          {territory.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setPhase('confirm')}
                className="w-full py-3 rounded font-display text-lg bg-red-700 text-white hover:bg-red-600 border-2 border-red-500 transition-colors"
              >
                {selectedScarTerritory && selectedScarType ? 'Continue' : 'Skip Scar'}
              </button>
            </div>
          )}

          {phase === 'confirm' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-board-parchment font-display text-xl mb-2">
                  Confirm Rewards
                </h3>
                <p className="text-board-parchment/60">
                  These changes will be permanently recorded in the campaign.
                </p>
              </div>

              <div className="space-y-4">
                {selectedCityTerritory ? (
                  <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/30">
                    <h4 className="text-blue-400 font-display mb-1">City Founded</h4>
                    <p className="text-board-parchment">
                      {cityName || 'Unnamed City'} in {territories[selectedCityTerritory]?.name}
                    </p>
                    <p className="text-board-parchment/60 text-sm">
                      Tier {selectedCityTier}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-board-wood/20 rounded-lg border border-board-border">
                    <h4 className="text-board-parchment/60 font-display mb-1">No City</h4>
                    <p className="text-board-parchment/40 text-sm">
                      You chose not to found a city
                    </p>
                  </div>
                )}

                {selectedScarTerritory && selectedScarType ? (
                  <div className="p-4 bg-red-900/20 rounded-lg border border-red-700/30">
                    <h4 className="text-red-400 font-display mb-1">Scar Placed</h4>
                    <p className="text-board-parchment">
                      {SCAR_TYPES.find((s) => s.id === selectedScarType)?.name} on {territories[selectedScarTerritory]?.name}
                    </p>
                    <p className="text-board-parchment/60 text-sm">
                      {SCAR_TYPES.find((s) => s.id === selectedScarType)?.description}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-board-wood/20 rounded-lg border border-board-border">
                    <h4 className="text-board-parchment/60 font-display mb-1">No Scar</h4>
                    <p className="text-board-parchment/40 text-sm">
                      You chose not to place a scar
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setPhase('overview')}
                  className="flex-1 py-3 rounded font-display text-lg bg-gray-700 text-gray-300 hover:bg-gray-600 border-2 border-gray-600 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={handleConfirmRewards}
                  className="flex-1 py-3 rounded font-display text-lg bg-amber-600 text-white hover:bg-amber-500 border-2 border-amber-400 transition-colors"
                >
                  Finish Game
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
