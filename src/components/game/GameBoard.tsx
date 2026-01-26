import { useEffect, useRef, useState } from 'react';
import { territories } from '@/data/territories';
import { continentByTerritory } from '@/data/continents';
import { TerritoryState, TerritoryId } from '@/types/territory';

interface GameBoardProps {
  territoryStates: Record<TerritoryId, TerritoryState>;
  onTerritoryClick?: (territoryId: TerritoryId) => void;
  onTerritoryHover?: (territoryId: TerritoryId | null) => void;
  selectedTerritory?: TerritoryId | null;
  highlightedTerritories?: TerritoryId[];
}

// Calculate center point for a territory path (for placing troop badges)
function getPathCenter(pathElement: SVGPathElement): { x: number; y: number } {
  const bbox = pathElement.getBBox();
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

export function GameBoard({
  territoryStates,
  onTerritoryClick,
  onTerritoryHover,
  selectedTerritory,
  highlightedTerritories = [],
}: GameBoardProps) {
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [territoryCenters, setTerritoryCenters] = useState<Record<string, { x: number; y: number }>>({});
  const [isLoaded, setIsLoaded] = useState(false);

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

  // After SVG is injected, calculate territory centers and attach event listeners
  useEffect(() => {
    if (!svgContent || !svgContainerRef.current) return;

    const container = svgContainerRef.current;
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    // Calculate centers for each territory
    const centers: Record<string, { x: number; y: number }> = {};
    territories.forEach((territory) => {
      const pathElement = svgElement.querySelector(`#${territory.id}`) as SVGPathElement | null;
      if (pathElement) {
        centers[territory.id] = getPathCenter(pathElement);

        // Style the territory path
        pathElement.style.cursor = 'pointer';
        pathElement.style.transition = 'fill 0.2s, stroke 0.2s, filter 0.2s';

        // Add event listeners
        pathElement.addEventListener('click', () => {
          onTerritoryClick?.(territory.id);
        });

        pathElement.addEventListener('mouseenter', () => {
          onTerritoryHover?.(territory.id);
        });

        pathElement.addEventListener('mouseleave', () => {
          onTerritoryHover?.(null);
        });
      }
    });

    setTerritoryCenters(centers);
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

      pathElement.style.fill = fillColor;
      pathElement.style.stroke = '#333';
      pathElement.style.strokeWidth = '1';

      // Selection and highlight states
      if (selectedTerritory === territory.id) {
        pathElement.style.stroke = '#FFD700';
        pathElement.style.strokeWidth = '3';
        pathElement.style.filter = 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))';
      } else if (highlightedTerritories.includes(territory.id)) {
        pathElement.style.stroke = '#00FF00';
        pathElement.style.strokeWidth = '2';
        pathElement.style.filter = 'drop-shadow(0 0 4px rgba(0, 255, 0, 0.5))';
      } else {
        pathElement.style.filter = 'none';
      }
    });
  }, [territoryStates, selectedTerritory, highlightedTerritories, isLoaded]);

  return (
    <div className="relative w-full h-full bg-board-sea overflow-hidden">
      {/* SVG Map Container */}
      <div
        ref={svgContainerRef}
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />

      {/* Troop count badges overlay */}
      {isLoaded && svgContainerRef.current && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 749.82 519.07"
          preserveAspectRatio="xMidYMid meet"
        >
          {territories.map((territory) => {
            const center = territoryCenters[territory.id];
            const state = territoryStates[territory.id];
            if (!center || !state) return null;

            return (
              <g key={territory.id} transform={`translate(${center.x}, ${center.y})`}>
                {/* Troop count badge background */}
                <circle
                  r="12"
                  fill="#2C1810"
                  stroke="#F5E6D3"
                  strokeWidth="1.5"
                />
                {/* Troop count text */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#F5E6D3"
                  fontSize="10"
                  fontFamily="Oswald, sans-serif"
                  fontWeight="bold"
                >
                  {state.troopCount}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export default GameBoard;
