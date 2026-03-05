import { useState } from 'react';
import { cardsById, getTroopsForCoins, ResourceCard } from '@/data/cards';
import { territoriesById } from '@/data/territories';

interface CardHandProps {
  cardIds: number[];
  onTradeForTroops?: (cardIds: number[]) => void;
  onTradeForStar?: (cardIds: number[]) => void;
  canTrade?: boolean;
}

// Render a single card
function Card({
  card,
  isSelected,
  onClick,
  isExpanded,
}: {
  card: ResourceCard;
  isSelected: boolean;
  onClick?: () => void;
  isExpanded?: boolean;
}) {
  const isTerritoryCard = card.type === 'territory';
  const territoryName = isTerritoryCard
    ? territoriesById[card.territoryId]?.name || card.territoryId
    : null;

  // Abbreviate long territory names (shorter when collapsed)
  const maxLen = isExpanded ? 12 : 8;
  const displayName = territoryName
    ? territoryName.length > maxLen
      ? territoryName.slice(0, maxLen - 1) + '...'
      : territoryName
    : 'Coin';

  return (
    <button
      onClick={onClick}
      className={`
        ${isExpanded ? 'w-20 h-24' : 'w-16 h-20'} rounded-lg border-2 flex flex-col items-center justify-between
        ${isExpanded ? 'p-2' : 'p-1'}
        transition-all duration-200 cursor-pointer
        shadow-md hover:shadow-lg
        ${
          isSelected
            ? 'border-yellow-400 bg-yellow-100 ring-2 ring-yellow-400 -translate-y-2 shadow-yellow-400/30'
            : 'border-board-wood bg-gradient-to-b from-board-parchment to-board-parchment/90 hover:border-board-wood/70 hover:-translate-y-1'
        }
      `}
      title={territoryName || 'Coin Card'}
    >
      {/* Card type indicator */}
      <div className={`${isExpanded ? 'text-[9px]' : 'text-[8px]'} font-body text-board-wood/60 uppercase tracking-tight`}>
        {isTerritoryCard ? 'Territory' : 'Coin'}
      </div>

      {/* Territory name or coin icon */}
      <div className="flex-1 flex items-center justify-center">
        {isTerritoryCard ? (
          <span className={`${isExpanded ? 'text-[11px]' : 'text-[10px]'} font-body text-board-wood text-center leading-tight font-medium`}>
            {displayName}
          </span>
        ) : (
          <span className={isExpanded ? 'text-2xl' : 'text-xl'}>{'\u{1FA99}'}</span>
        )}
      </div>

      {/* Coin value */}
      <div className="flex items-center gap-0.5">
        <span className="text-yellow-600">{'\u{1FA99}'}</span>
        <span className={`${isExpanded ? 'text-sm' : 'text-xs'} font-numbers text-board-wood font-bold`}>
          {card.coinValue}
        </span>
      </div>
    </button>
  );
}

export function CardHand({
  cardIds,
  onTradeForTroops,
  onTradeForStar,
  canTrade = true,
}: CardHandProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<number>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  // Get card objects from IDs
  const cards = cardIds.map((id) => cardsById[id]).filter(Boolean);

  // Calculate total coins
  const totalCoins = cards.reduce((sum, card) => sum + card.coinValue, 0);

  // Calculate selected coins
  const selectedCoins = Array.from(selectedCardIds).reduce((sum, id) => {
    const card = cardsById[id];
    return sum + (card?.coinValue || 0);
  }, 0);

  // Calculate troops that would be received for selected cards
  const troopsForSelected = getTroopsForCoins(selectedCoins);

  // Check if can trade for star (exactly 4 cards)
  const canTradeForStar = selectedCardIds.size === 4;

  // Toggle card selection
  const toggleCard = (cardId: number) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Handle trade for troops
  const handleTradeForTroops = () => {
    if (onTradeForTroops && selectedCardIds.size > 0 && troopsForSelected > 0) {
      onTradeForTroops(Array.from(selectedCardIds));
      setSelectedCardIds(new Set());
    }
  };

  // Handle trade for star
  const handleTradeForStar = () => {
    if (onTradeForStar && canTradeForStar) {
      onTradeForStar(Array.from(selectedCardIds));
      setSelectedCardIds(new Set());
    }
  };

  return (
    <div className={`
      bg-gradient-to-b from-board-border to-board-dark rounded-lg border-2 border-board-wood
      shadow-lg transition-all duration-200
      ${isExpanded ? 'shadow-xl' : ''}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-board-wood bg-board-wood/20">
        <h2 className="text-xs uppercase tracking-wider text-board-parchment/80 font-body font-semibold">
          Your Cards
          <span className="ml-2 font-numbers text-yellow-400">({cards.length})</span>
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-board-parchment/60 hover:text-board-parchment text-sm px-2 py-1 rounded hover:bg-board-wood/30 transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '\u25BC' : '\u25B2'}
        </button>
      </div>

      {/* Card display */}
      <div className={`${isExpanded ? 'p-4' : 'p-3'} transition-all duration-200`}>
        {cards.length === 0 ? (
          <p className="text-sm text-board-parchment/50 font-body italic text-center py-2">
            No cards yet
          </p>
        ) : (
          <>
            {/* Cards grid - tray-like appearance */}
            <div className={`
              flex gap-2 flex-wrap justify-center
              ${isExpanded ? 'p-3 bg-board-dark/50 rounded-lg mb-4' : 'mb-3'}
              ${isExpanded ? 'shadow-inner' : ''}
            `}>
              {cards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  isSelected={selectedCardIds.has(card.id)}
                  onClick={canTrade ? () => toggleCard(card.id) : undefined}
                  isExpanded={isExpanded}
                />
              ))}
            </div>

            {/* Total coins display */}
            <div className="flex items-center justify-between text-sm text-board-parchment mb-3 px-1">
              <span className="font-body">Total:</span>
              <span className="font-numbers flex items-center gap-1">
                <span className="text-yellow-600">{'\u{1FA99}'}</span>
                <span className="text-yellow-400 font-bold">{totalCoins}</span> coins
              </span>
            </div>

            {/* Selection info */}
            {selectedCardIds.size > 0 && (
              <div className="text-xs text-yellow-400 mb-3 font-body bg-yellow-400/10 rounded p-2 text-center">
                Selected: <span className="font-numbers font-bold">{selectedCardIds.size}</span> cards ({selectedCoins} coins)
                {troopsForSelected > 0 && (
                  <span className="ml-1 text-green-400">= <span className="font-numbers font-bold">{troopsForSelected}</span> troops</span>
                )}
              </div>
            )}

            {/* Trade buttons */}
            {canTrade && (
              <div className="flex gap-2">
                <button
                  onClick={handleTradeForTroops}
                  disabled={selectedCardIds.size === 0 || troopsForSelected === 0}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm font-body font-semibold
                    transition-all duration-150
                    ${
                      selectedCardIds.size > 0 && troopsForSelected > 0
                        ? 'bg-green-700 text-white hover:bg-green-600 shadow-md hover:shadow-lg'
                        : 'bg-board-wood/30 text-board-parchment/40 cursor-not-allowed'
                    }
                  `}
                >
                  Trade for {troopsForSelected > 0 ? troopsForSelected : '?'} Troops
                </button>
                <button
                  onClick={handleTradeForStar}
                  disabled={!canTradeForStar}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-body font-semibold
                    transition-all duration-150
                    ${
                      canTradeForStar
                        ? 'bg-yellow-600 text-white hover:bg-yellow-500 shadow-md hover:shadow-lg'
                        : 'bg-board-wood/30 text-board-parchment/40 cursor-not-allowed'
                    }
                  `}
                  title="Trade 4 cards for 1 Red Star"
                >
                  Trade for {'\u2605'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CardHand;
