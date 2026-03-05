import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { territories } from '@/data/territories';
import { continentByTerritory } from '@/data/continents';
import { territoryCenters } from '@/data/territoryCenters';
import { factionsById } from '@/data/factions';
import { TerritoryState, TerritoryId } from '@/types/territory';
import { Player } from '@/types/player';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { getTerritoryUnitLayoutOverride } from '@/data/territoryUnitLayoutOverrides';
import { ManeuverUnitAnimationOverlay } from '@/components/game/territory-units/ManeuverUnitAnimationOverlay';
import { TerritoryUnitStack } from '@/components/game/territory-units/TerritoryUnitStack';
import { ManeuverAnimationEvent } from '@/components/game/territory-units/types';
import mapSvgRaw from '@/assets/map/risk_board.svg?raw';

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
  // Troop placement controls (RECRUIT phase)
  showTroopControls?: boolean;
  troopsRemaining?: number;
  onAddTroop?: (territoryId: TerritoryId) => void;
  onRemoveTroop?: (territoryId: TerritoryId) => void;
  // Maneuver path visualization
  currentManeuverPath?: TerritoryId[] | null;
  maneuverAnimation?: ManeuverAnimationEvent | null;
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
  showTroopControls = false,
  troopsRemaining = 0,
  onAddTroop,
  onRemoveTroop,
  currentManeuverPath,
  maneuverAnimation,
}: GameBoardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const playerFactionIds = useMemo(() => {
    const factionMap: Record<string, string> = {};
    players.forEach((player) => {
      if (player.factionId) {
        factionMap[player.id] = player.factionId;
      }
    });
    return factionMap;
  }, [players]);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeManeuverAnimation, setActiveManeuverAnimation] = useState<ManeuverAnimationEvent | null>(null);
  const [recentManeuverPath, setRecentManeuverPath] = useState<TerritoryId[] | null>(null);
  const [isRecentManeuverPathFading, setIsRecentManeuverPathFading] = useState(false);

  // Use refs to access current values in event handlers without recreating listeners
  const selectableTerritoriesRef = useRef(selectableTerritories);
  selectableTerritoriesRef.current = selectableTerritories;
  const onTerritoryClickRef = useRef(onTerritoryClick);
  onTerritoryClickRef.current = onTerritoryClick;
  const onTerritoryHoverRef = useRef(onTerritoryHover);
  onTerritoryHoverRef.current = onTerritoryHover;

  // Load the SVG content
  useEffect(() => {
    setSvgContent(mapSvgRaw);
  }, []);

  // After SVG is injected, configure the SVG and attach event listeners once.
  // Handlers read latest callbacks/state via refs to avoid stale closures.
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

    const cleanupFns: Array<() => void> = [];

    // Attach event listeners to each territory
    territories.forEach((territory) => {
      const pathElement = svgElement.querySelector(`#${territory.id}`) as SVGPathElement | null;
      if (pathElement) {
        // Style the territory path
        pathElement.style.transition = 'fill 0.2s, stroke 0.2s, filter 0.2s, opacity 0.2s';

        // Add event listeners - only trigger click if territory is selectable
        const handleClick = () => {
          // If selectableTerritories is undefined, all territories are selectable
          // If it's defined, only territories in the array are selectable
          // Use ref to get current value at click time
          const currentSelectable = selectableTerritoriesRef.current;
          if (!currentSelectable || currentSelectable.includes(territory.id)) {
            onTerritoryClickRef.current?.(territory.id);
          }
        };

        const handleMouseEnter = (e: MouseEvent) => {
          onTerritoryHoverRef.current?.(territory.id, { x: e.clientX, y: e.clientY });
        };

        const handleMouseMove = (e: MouseEvent) => {
          onTerritoryHoverRef.current?.(territory.id, { x: e.clientX, y: e.clientY });
        };

        const handleMouseLeave = () => {
          onTerritoryHoverRef.current?.(null);
        };

        pathElement.addEventListener('click', handleClick);
        pathElement.addEventListener('mouseenter', handleMouseEnter);
        pathElement.addEventListener('mousemove', handleMouseMove);
        pathElement.addEventListener('mouseleave', handleMouseLeave);

        cleanupFns.push(() => {
          pathElement.removeEventListener('click', handleClick);
          pathElement.removeEventListener('mouseenter', handleMouseEnter);
          pathElement.removeEventListener('mousemove', handleMouseMove);
          pathElement.removeEventListener('mouseleave', handleMouseLeave);
        });
      }
    });

    setIsLoaded(true);
    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [svgContent]);

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
        pathElement.style.strokeWidth = '4';
        pathElement.style.filter = 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.9)) drop-shadow(0 0 16px rgba(255, 215, 0, 0.5))';
        pathElement.classList.remove('territory-selectable');
      } else if (highlightedTerritories.includes(territory.id)) {
        pathElement.style.stroke = '#00FF00';
        pathElement.style.strokeWidth = '3';
        pathElement.style.filter = 'drop-shadow(0 0 6px rgba(0, 255, 0, 0.7)) drop-shadow(0 0 12px rgba(0, 255, 0, 0.4))';
        pathElement.classList.remove('territory-selectable');
      } else if (isSelectable && selectableTerritories) {
        // Subtle highlight for selectable territories during restricted selection mode
        pathElement.style.stroke = '#4A90A4';
        pathElement.style.strokeWidth = '2';
        pathElement.style.filter = 'drop-shadow(0 0 4px rgba(74, 144, 164, 0.6))';
        pathElement.classList.add('territory-selectable');
      } else {
        pathElement.style.filter = 'none';
        pathElement.classList.remove('territory-selectable');
      }
    });
  }, [territoryStates, selectedTerritory, highlightedTerritories, selectableTerritories, isLoaded]);

  useEffect(() => {
    if (!maneuverAnimation || maneuverAnimation.path.length < 2) return;

    setRecentManeuverPath(maneuverAnimation.path);
    setIsRecentManeuverPathFading(false);

    if (prefersReducedMotion) {
      setActiveManeuverAnimation(null);

      const fadeTimer = window.setTimeout(() => {
        setIsRecentManeuverPathFading(true);
      }, 180);
      const clearTimer = window.setTimeout(() => {
        setRecentManeuverPath(null);
        setIsRecentManeuverPathFading(false);
      }, 560);

      return () => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(clearTimer);
      };
    }

    setActiveManeuverAnimation(maneuverAnimation);
  }, [maneuverAnimation?.timestamp, prefersReducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManeuverAnimationComplete = useCallback(() => {
    setActiveManeuverAnimation(null);
    setIsRecentManeuverPathFading(true);
    window.setTimeout(() => {
      setRecentManeuverPath(null);
      setIsRecentManeuverPathFading(false);
    }, 320);
  }, []);

  const displayManeuverPath = currentManeuverPath && currentManeuverPath.length >= 2
    ? currentManeuverPath
    : recentManeuverPath && recentManeuverPath.length >= 2
      ? recentManeuverPath
      : null;
  const isTransientManeuverPath = !currentManeuverPath && Boolean(recentManeuverPath);

  return (
    <div className="relative w-full h-full bg-board-sea overflow-hidden">
      {/* SVG Map Container */}
      <div
        ref={svgContainerRef}
        className="absolute inset-0 w-full h-full flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {/* Territory units + markers overlay - uses same viewBox as the SVG map */}
      {isLoaded && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${SVG_VIEWBOX_WIDTH} ${SVG_VIEWBOX_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        >
          {territories.map((territory) => {
            const center = territoryCenters[territory.id];
            const state = territoryStates[territory.id];
            if (!center || !state) return null;

            const pending = pendingDeployments[territory.id] || 0;
            const hasPending = pending > 0;

            const pendingRadius = 7;
            const pendingFontSize = 7;
            const pendingOffset = { x: 12, y: -13 };
            const ownerFactionId = state.ownerId
              ? playerFactionIds[state.ownerId]
              : undefined;

            return (
              <g key={territory.id} transform={`translate(${center.x}, ${center.y})`} pointerEvents="none">
                <TerritoryUnitStack
                  troopCount={state.troopCount}
                  factionId={ownerFactionId}
                  layoutOverride={getTerritoryUnitLayoutOverride(territory.id)}
                />
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

          {/* HQ Indicators */}
          {players.map((player) => {
            if (!player.hqTerritory) return null;
            const center = territoryCenters[player.hqTerritory as TerritoryId];
            if (!center) return null;

            const faction = factionsById[player.factionId];
            const factionColor = faction?.color || '#888888';

            return (
              <g key={`hq-${player.id}`} transform={`translate(${center.x - 12}, ${center.y - 12})`} pointerEvents="none">
                {/* HQ Flag/Banner */}
                <g>
                  {/* Flag pole */}
                  <rect x="0" y="0" width="2" height="16" fill={factionColor} />
                  {/* Flag */}
                  <polygon
                    points="2,0 14,4 2,8"
                    fill={factionColor}
                    stroke="#000"
                    strokeWidth="0.5"
                  />
                  {/* HQ text */}
                  <text
                    x="7"
                    y="5.5"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fff"
                    fontSize="4"
                    fontWeight="bold"
                    fontFamily="Oswald, sans-serif"
                  >
                    HQ
                  </text>
                </g>
              </g>
            );
          })}

          {/* Maneuver Path Arrow */}
          {displayManeuverPath && (
            <>
              {/* Define arrowhead marker */}
              <defs>
                <marker
                  id="maneuver-arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
                </marker>
              </defs>
              {/* Draw path polyline */}
              <polyline
                points={displayManeuverPath
                  .map((tid) => {
                    const center = territoryCenters[tid];
                    return center ? `${center.x},${center.y}` : '';
                  })
                  .filter(Boolean)
                  .join(' ')}
                fill="none"
                stroke="#22c55e"
                strokeWidth="3"
                strokeDasharray="8,4"
                markerEnd="url(#maneuver-arrowhead)"
                className={isTransientManeuverPath ? '' : 'animate-pulse'}
                strokeOpacity={isTransientManeuverPath ? (isRecentManeuverPathFading ? 0 : 0.9) : 1}
                style={isTransientManeuverPath ? { transition: 'stroke-opacity 220ms ease-out' } : undefined}
                pointerEvents="none"
              />
            </>
          )}

          {activeManeuverAnimation && !prefersReducedMotion && (
            <ManeuverUnitAnimationOverlay
              event={activeManeuverAnimation}
              onComplete={handleManeuverAnimationComplete}
            />
          )}

        </svg>
      )}

      {/* Troop Placement Controls Layer (interactive) */}
      {isLoaded && showTroopControls && selectedTerritory && (() => {
        const center = territoryCenters[selectedTerritory];
        if (!center) return null;
        const pending = pendingDeployments[selectedTerritory] || 0;

        return (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={`0 0 ${SVG_VIEWBOX_WIDTH} ${SVG_VIEWBOX_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          >
            <g transform={`translate(${center.x}, ${center.y})`} pointerEvents="all">
              {/* -1 Button (left) */}
              <g
                transform="translate(-34, 10)"
                onClick={(e) => {
                  e.stopPropagation();
                  if (pending > 0 && onRemoveTroop) onRemoveTroop(selectedTerritory);
                }}
                style={{ cursor: pending > 0 ? 'pointer' : 'not-allowed' }}
              >
                <rect
                  x="-3" y="-3" width="28" height="28" rx="5"
                  fill="transparent"
                />
                <rect
                  x="0" y="0" width="22" height="22" rx="5"
                  fill={pending > 0 ? '#dc2626' : '#4b5563'}
                  stroke="#fff"
                  strokeWidth="1.5"
                  className={pending > 0 ? 'drop-shadow-lg' : ''}
                />
                <text
                  x="11" y="11.5"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize="15"
                  fontWeight="bold"
                  fontFamily="Oswald, sans-serif"
                >
                  −
                </text>
              </g>

              {/* +1 Button (right) */}
              <g
                transform="translate(12, 10)"
                onClick={(e) => {
                  e.stopPropagation();
                  if (troopsRemaining > 0 && onAddTroop) onAddTroop(selectedTerritory);
                }}
                style={{ cursor: troopsRemaining > 0 ? 'pointer' : 'not-allowed' }}
              >
                <rect
                  x="-3" y="-3" width="28" height="28" rx="5"
                  fill="transparent"
                />
                <rect
                  x="0" y="0" width="22" height="22" rx="5"
                  fill={troopsRemaining > 0 ? '#16a34a' : '#4b5563'}
                  stroke="#fff"
                  strokeWidth="1.5"
                  className={troopsRemaining > 0 ? 'drop-shadow-lg' : ''}
                />
                <text
                  x="11" y="11.5"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize="15"
                  fontWeight="bold"
                  fontFamily="Oswald, sans-serif"
                >
                  +
                </text>
              </g>
            </g>
          </svg>
        );
      })()}
    </div>
  );
}

export default GameBoard;
