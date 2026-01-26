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
}: {
  card: ResourceCard;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const isTerritoryCard = card.type === 'territory';
  const territoryName = isTerritoryCard
    ? territoriesById[card.territoryId]?.name || card.territoryId
    : null;

  // Abbreviate long territory names
  const displayName = territoryName
    ? territoryName.length > 8
      ? territoryName.slice(0, 7) + '...'
      : territoryName
    : 'Coin';

  return (
    <button
      onClick={onClick}
      className={`
        w-16 h-20 rounded border-2 flex flex-col items-center justify-between p-1
        transition-all duration-150 cursor-pointer
        ${
          isSelected
            ? 'border-yellow-400 bg-yellow-100 ring-2 ring-yellow-400 -translate-y-1'
            : 'border-board-wood bg-board-parchment hover:border-board-wood/70 hover:-translate-y-0.5'
        }
      `}
      title={territoryName || 'Coin Card'}
    >
      {/* Card type indicator */}
      <div className="text-[8px] font-body text-board-wood/60 uppercase tracking-tight">
        {isTerritoryCard ? 'Territory' : 'Coin'}
      </div>

      {/* Territory name or coin icon */}
      <div className="flex-1 flex items-center justify-center">
        {isTerritoryCard ? (
          <span className="text-[10px] font-body text-board-wood text-center leading-tight">
            {displayName}
          </span>
        ) : (
          <span className="text-xl">{'\u{1FA99}'}</span>
        )}
      </div>

      {/* Coin value */}
      <div className="flex items-center gap-0.5">
        <span className="text-yellow-600">{'\u{1FA99}'}</span>
        <span className="text-xs font-numbers text-board-wood font-bold">
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
    <div className="bg-board-border rounded-lg border border-board-wood">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-board-wood">
        <h2 className="text-xs uppercase tracking-wider text-board-parchment/60 font-body">
          Your Cards ({cards.length})
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-board-parchment/60 hover:text-board-parchment text-sm"
        >
          {isExpanded ? '\u25BC' : '\u25B2'}
        </button>
      </div>

      {/* Card display */}
      <div className="p-3">
        {cards.length === 0 ? (
          <p className="text-sm text-board-parchment/50 font-body italic">
            No cards
          </p>
        ) : (
          <>
            {/* Cards grid */}
            <div className="flex gap-2 flex-wrap mb-3">
              {cards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  isSelected={selectedCardIds.has(card.id)}
                  onClick={canTrade ? () => toggleCard(card.id) : undefined}
                />
              ))}
            </div>

            {/* Total coins display */}
            <div className="flex items-center justify-between text-sm text-board-parchment mb-3">
              <span className="font-body">Total:</span>
              <span className="font-numbers flex items-center gap-1">
                <span className="text-yellow-600">{'\u{1FA99}'}</span>
                {totalCoins} coins
              </span>
            </div>

            {/* Selection info */}
            {selectedCardIds.size > 0 && (
              <div className="text-xs text-yellow-400 mb-2 font-body">
                Selected: {selectedCardIds.size} cards ({selectedCoins} coins)
                {troopsForSelected > 0 && (
                  <span className="ml-1">= {troopsForSelected} troops</span>
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
                    flex-1 px-3 py-2 rounded text-sm font-body
                    ${
                      selectedCardIds.size > 0 && troopsForSelected > 0
                        ? 'bg-green-700 text-white hover:bg-green-600'
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
                    px-3 py-2 rounded text-sm font-body
                    ${
                      canTradeForStar
                        ? 'bg-yellow-600 text-white hover:bg-yellow-500'
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
