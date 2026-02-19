import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardHand } from '@/components/game/CardHand';

describe('CardHand component integration', () => {
  it('renders hand metadata from provided card ids', () => {
    render(<CardHand cardIds={[0, 42]} />);

    expect(screen.getByText('Your Cards')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('coins')).toBeInTheDocument();
  });

  it('dispatches troop trade payload via public callback only', () => {
    const onTradeForTroops = vi.fn();

    render(<CardHand cardIds={[0, 1]} onTradeForTroops={onTradeForTroops} canTrade />);

    fireEvent.click(screen.getByTitle('Alaska'));
    fireEvent.click(screen.getByTitle('Northwest Territory'));
    fireEvent.click(screen.getByRole('button', { name: /Trade for .* Troops/i }));

    expect(onTradeForTroops).toHaveBeenCalledTimes(1);
    const payload = onTradeForTroops.mock.calls[0][0] as number[];
    expect(payload).toHaveLength(2);
    expect(payload).toEqual(expect.arrayContaining([0, 1]));
  });

  it('dispatches star trade payload only when exactly four cards are selected', () => {
    const onTradeForStar = vi.fn();

    render(<CardHand cardIds={[0, 1, 2, 3]} onTradeForStar={onTradeForStar} canTrade />);

    fireEvent.click(screen.getByTitle('Alaska'));
    fireEvent.click(screen.getByTitle('Northwest Territory'));
    fireEvent.click(screen.getByTitle('Greenland'));

    const starButton = screen.getByTitle('Trade 4 cards for 1 Red Star');
    expect(starButton).toBeDisabled();

    fireEvent.click(screen.getByTitle('Alberta'));
    expect(starButton).toBeEnabled();

    fireEvent.click(starButton);

    expect(onTradeForStar).toHaveBeenCalledTimes(1);
    const payload = onTradeForStar.mock.calls[0][0] as number[];
    expect(payload).toHaveLength(4);
    expect(payload).toEqual(expect.arrayContaining([0, 1, 2, 3]));
  });
});
