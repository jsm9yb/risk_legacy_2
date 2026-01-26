import { TerritoryState, ScarType, CityTier } from '@/types/territory';
import { continentsById } from '@/data/continents';

interface TerritoryTooltipProps {
  territory: TerritoryState;
  position: { x: number; y: number };
  ownerName?: string;
}

const scarLabels: Record<NonNullable<ScarType>, { name: string; icon: string }> = {
  bunker: { name: 'Bunker', icon: '🛡️' },
  ammo_shortage: { name: 'Ammo Shortage', icon: '⚠️' },
  biohazard: { name: 'Biohazard', icon: '☣️' },
  mercenary: { name: 'Mercenary', icon: '⚔️' },
  fortification: { name: 'Fortification', icon: '🏰' },
};

const cityLabels: Record<Exclude<CityTier, 0>, { name: string; icon: string }> = {
  1: { name: 'Minor City', icon: '🏠' },
  2: { name: 'Major City', icon: '🏛️' },
  3: { name: 'World Capital', icon: '👑' },
};

export function TerritoryTooltip({ territory, position, ownerName }: TerritoryTooltipProps) {
  const continent = continentsById[territory.continentId];

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-12px)',
      }}
    >
      <div className="bg-board-wood border-2 border-board-border rounded-lg shadow-xl p-3 min-w-[160px]">
        {/* Territory Name */}
        <h3 className="text-board-parchment font-display text-sm font-bold border-b border-board-border pb-1 mb-2">
          {territory.name}
        </h3>

        {/* Territory Info */}
        <div className="space-y-1 text-xs font-body">
          {/* Continent */}
          <div className="flex justify-between text-board-parchment">
            <span className="opacity-70">Continent:</span>
            <span>{continent?.name || 'Unknown'}</span>
          </div>

          {/* Owner */}
          <div className="flex justify-between text-board-parchment">
            <span className="opacity-70">Owner:</span>
            <span>{ownerName || 'Unoccupied'}</span>
          </div>

          {/* Troops */}
          <div className="flex justify-between text-board-parchment">
            <span className="opacity-70">Troops:</span>
            <span className="font-numbers font-bold">{territory.troopCount}</span>
          </div>

          {/* Modifiers Section */}
          {(territory.scarId || territory.cityTier > 0 || territory.fortified) && (
            <div className="border-t border-board-border pt-1 mt-1">
              <span className="text-board-parchment opacity-70 block mb-1">Modifiers:</span>
              <div className="flex flex-wrap gap-1">
                {/* Scar */}
                {territory.scarId && (
                  <span className="inline-flex items-center bg-board-border rounded px-1.5 py-0.5 text-board-parchment">
                    <span className="mr-1">{scarLabels[territory.scarId].icon}</span>
                    {scarLabels[territory.scarId].name}
                  </span>
                )}

                {/* City */}
                {territory.cityTier > 0 && (
                  <span className="inline-flex items-center bg-board-border rounded px-1.5 py-0.5 text-board-parchment">
                    <span className="mr-1">{cityLabels[territory.cityTier as Exclude<CityTier, 0>].icon}</span>
                    {territory.cityName || cityLabels[territory.cityTier as Exclude<CityTier, 0>].name}
                  </span>
                )}

                {/* Fortification */}
                {territory.fortified && (
                  <span className="inline-flex items-center bg-board-border rounded px-1.5 py-0.5 text-board-parchment">
                    <span className="mr-1">🏰</span>
                    Fortified ({10 - territory.fortifyDamage}/10)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tooltip Arrow */}
        <div
          className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full"
          style={{
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #4A3728',
          }}
        />
      </div>
    </div>
  );
}

export default TerritoryTooltip;
