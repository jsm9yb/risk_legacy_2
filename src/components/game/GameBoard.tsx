import { useEffect, useRef, useState, useMemo } from 'react';
import { territories } from '@/data/territories';
import { continentByTerritory } from '@/data/continents';
import { territoryCenters } from '@/data/territoryCenters';
import { factionsById } from '@/data/factions';
import { TerritoryState, TerritoryId } from '@/types/territory';
import { Player } from '@/types/player';

// SVG viewBox dimensions - must match the overlay SVG viewBox
const SVG_VIEWBOX_WIDTH = 749.82;
const SVG_VIEWBOX_HEIGHT = 519.07;

interface GameBoardProps {
  territoryStates: Record<TerritoryId, TerritoryState>;
  players?: Player[];
  onTerritoryClick?: (territoryId: TerritoryId) => void;
  onTerritoryHover?: (territoryId: TerritoryId | null, mousePosition?: { x: number; y: number }) => void;
  selectedTerritory?: TerritoryId | null;
  highlightedTerritories?: TerritoryId[];
  selectableTerritories?: TerritoryId[];
  pendingDeployments?: Record<TerritoryId, number>;
}

export function GameBoard({
  territoryStates,
  players = [],
  onTerritoryClick,
  onTerritoryHover,
  selectedTerritory,
  highlightedTerritories = [],
  selectableTerritories,
  pendingDeployments = {},
}: GameBoardProps) {
  // Create a map of player IDs to their faction colors for efficient lookup
  const playerFactionColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    players.forEach((player) => {
      if (player.factionId) {
        const faction = factionsById[player.factionId];
        if (faction) {
          colorMap[player.id] = faction.color;
        }
      }
    });
    return colorMap;
  }, [players]);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Use refs to access current values in event handlers without recreating listeners
  const selectableTerritoriesRef = useRef(selectableTerritories);
  selectableTerritoriesRef.current = selectableTerritories;

  // Load the SVG content
  useEffect(() => {
    fetch('/src/assets/map/risk_board.svg')
      .then((response) => response.text())
      .then((text) => {
        setSvgContent(text);
      })
      .catch((err) => {
        console.error('Failed to load SVG:', err);
      });
  }, []);

  // After SVG is injected, configure the SVG and attach event listeners
  useEffect(() => {
    if (!svgContent || !svgContainerRef.current) return;

    const container = svgContainerRef.current;
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    // Set SVG to fill container with proper aspect ratio
    // Must set viewBox to match overlay for proper marker alignment
    svgElement.setAttribute('viewBox', `0 0 ${SVG_VIEWBOX_WIDTH} ${SVG_VIEWBOX_HEIGHT}`);
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgElement.style.display = 'block';

    // Attach event listeners to each territory
    territories.forEach((territory) => {
      const pathElement = svgElement.querySelector(`#${territory.id}`) as SVGPathElement | null;
      if (pathElement) {
        // Style the territory path
        pathElement.style.transition = 'fill 0.2s, stroke 0.2s, filter 0.2s, opacity 0.2s';

        // Add event listeners - only trigger click if territory is selectable
        pathElement.addEventListener('click', () => {
          // If selectableTerritories is undefined, all territories are selectable
          // If it's defined, only territories in the array are selectable
          // Use ref to get current value at click time
          const currentSelectable = selectableTerritoriesRef.current;
          if (!currentSelectable || currentSelectable.includes(territory.id)) {
            onTerritoryClick?.(territory.id);
          }
        });

        pathElement.addEventListener('mouseenter', (e: MouseEvent) => {
          onTerritoryHover?.(territory.id, { x: e.clientX, y: e.clientY });
        });

        pathElement.addEventListener('mousemove', (e: MouseEvent) => {
          onTerritoryHover?.(territory.id, { x: e.clientX, y: e.clientY });
        });

        pathElement.addEventListener('mouseleave', () => {
          onTerritoryHover?.(null);
        });
      }
    });

    setIsLoaded(true);
  }, [svgContent, onTerritoryClick, onTerritoryHover]);

  // Update territory colors based on state
  useEffect(() => {
    if (!svgContainerRef.current || !isLoaded) return;

    const svgElement = svgContainerRef.current.querySelector('svg');
    if (!svgElement) return;

    territories.forEach((territory) => {
      const pathElement = svgElement.querySelector(`#${territory.id}`) as SVGPathElement | null;
      if (!pathElement) return;

      const continent = continentByTerritory[territory.id];

      // Base color from continent
      const fillColor = continent?.color || '#cccccc';

      // Check if territory is selectable
      // If selectableTerritories is undefined, all territories are selectable
      const isSelectable = !selectableTerritories || selectableTerritories.includes(territory.id);

      pathElement.style.fill = fillColor;
      pathElement.style.stroke = '#333';
      pathElement.style.strokeWidth = '1';
      pathElement.style.cursor = isSelectable ? 'pointer' : 'not-allowed';
      pathElement.style.opacity = isSelectable ? '1' : '0.5';

      // Selection and highlight states (only apply full effects to selectable territories)
      if (selectedTerritory === territory.id) {
        pathElement.style.stroke = '#FFD700';
        pathElement.style.strokeWidth = '3';
        pathElement.style.filter = 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))';
      } else if (highlightedTerritories.includes(territory.id)) {
        pathElement.style.stroke = '#00FF00';
        pathElement.style.strokeWidth = '2';
        pathElement.style.filter = 'drop-shadow(0 0 4px rgba(0, 255, 0, 0.5))';
      } else if (isSelectable && selectableTerritories) {
        // Subtle highlight for selectable territories during restricted selection mode
        pathElement.style.stroke = '#4A90A4';
        pathElement.style.strokeWidth = '1.5';
        pathElement.style.filter = 'drop-shadow(0 0 2px rgba(74, 144, 164, 0.4))';
      } else {
        pathElement.style.filter = 'none';
      }
    });
  }, [territoryStates, selectedTerritory, highlightedTerritories, selectableTerritories, isLoaded]);

  return (
    <div className="relative w-full h-full bg-board-sea overflow-hidden">
      {/* SVG Map Container */}
      <div
        ref={svgContainerRef}
        className="absolute inset-0 w-full h-full flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {/* Troop count badges overlay - uses same viewBox as the SVG map */}
      {isLoaded && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${SVG_VIEWBOX_WIDTH} ${SVG_VIEWBOX_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {territories.map((territory) => {
            const center = territoryCenters[territory.id];
            const state = territoryStates[territory.id];
            if (!center || !state) return null;

            const pending = pendingDeployments[territory.id] || 0;
            const hasPending = pending > 0;

            // Badge sizes scale with the viewBox
            const badgeRadius = 10;
            const fontSize = 9;
            const pendingRadius = 7;
            const pendingFontSize = 7;
            const pendingOffset = { x: 9, y: -9 };

            // Get the faction color for the territory owner (if any)
            const ownerFactionColor = state.ownerId
              ? playerFactionColors[state.ownerId]
              : undefined;

            // Badge background: pending (green) > faction color > default brown
            const badgeFill = hasPending
              ? '#166534'
              : ownerFactionColor || '#2C1810';

            return (
              <g key={territory.id} transform={`translate(${center.x}, ${center.y})`}>
                {/* Troop count badge background */}
                <circle
                  r={badgeRadius}
                  fill={badgeFill}
                  stroke={hasPending ? '#22c55e' : '#F5E6D3'}
                  strokeWidth={hasPending ? '1.5' : '1'}
                />
                {/* Troop count text */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#F5E6D3"
                  fontSize={fontSize}
                  fontFamily="Oswald, sans-serif"
                  fontWeight="bold"
                >
                  {state.troopCount}
                </text>
                {/* Pending deployment indicator */}
                {hasPending && (
                  <g transform={`translate(${pendingOffset.x}, ${pendingOffset.y})`}>
                    <circle r={pendingRadius} fill="#22c55e" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={pendingFontSize}
                      fontFamily="Oswald, sans-serif"
                      fontWeight="bold"
                    >
                      +{pending}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export default GameBoard;
