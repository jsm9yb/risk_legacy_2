import { useState } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { territories } from './data/territories';
import { TerritoryState, TerritoryId } from './types/territory';

// Generate placeholder territory states for all territories
function createPlaceholderTerritoryStates(): Record<TerritoryId, TerritoryState> {
  const states: Record<TerritoryId, TerritoryState> = {};

  territories.forEach((territory) => {
    states[territory.id] = {
      id: territory.id,
      name: territory.name,
      continentId: territory.continentId,
      neighbors: territory.neighbors,
      ownerId: null,
      troopCount: Math.floor(Math.random() * 10) + 1, // Random 1-10 for placeholder
      scarId: null,
      cityTier: 0,
      cityName: null,
      fortified: false,
      fortifyDamage: 0,
    };
  });

  return states;
}

function App() {
  const [territoryStates] = useState<Record<TerritoryId, TerritoryState>>(
    createPlaceholderTerritoryStates
  );
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryId | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<TerritoryId | null>(null);

  const handleTerritoryClick = (territoryId: TerritoryId) => {
    setSelectedTerritory((prev) => (prev === territoryId ? null : territoryId));
  };

  const handleTerritoryHover = (territoryId: TerritoryId | null) => {
    setHoveredTerritory(territoryId);
  };

  // Get neighbors of selected territory for highlighting
  const highlightedTerritories = selectedTerritory
    ? territories.find((t) => t.id === selectedTerritory)?.neighbors || []
    : [];

  return (
    <div className="flex flex-col h-screen bg-board-wood">
      {/* Header */}
      <header className="h-14 bg-board-border flex items-center px-4 border-b-2 border-board-wood">
        <h1 className="text-board-parchment font-display text-xl font-bold">
          Risk Legacy
        </h1>
        {hoveredTerritory && (
          <span className="ml-4 text-board-parchment font-body">
            {territories.find((t) => t.id === hoveredTerritory)?.name}
          </span>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 p-4">
        <div className="w-full h-full rounded-lg overflow-hidden border-4 border-board-border shadow-2xl">
          <GameBoard
            territoryStates={territoryStates}
            onTerritoryClick={handleTerritoryClick}
            onTerritoryHover={handleTerritoryHover}
            selectedTerritory={selectedTerritory}
            highlightedTerritories={highlightedTerritories}
          />
        </div>
      </main>

      {/* Footer with selected territory info */}
      {selectedTerritory && (
        <footer className="h-20 bg-board-border p-4 border-t-2 border-board-wood">
          <div className="text-board-parchment font-body">
            <span className="font-bold">Selected: </span>
            {territories.find((t) => t.id === selectedTerritory)?.name}
            <span className="ml-4">
              Troops: {territoryStates[selectedTerritory]?.troopCount}
            </span>
            <span className="ml-4">
              Neighbors: {highlightedTerritories.length}
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
