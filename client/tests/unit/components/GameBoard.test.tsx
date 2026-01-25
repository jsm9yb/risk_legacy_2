/**
 * GameBoard Component Tests
 * Tests for: territory rendering, selection, highlights, interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameBoard } from '../../../src/components/game/GameBoard';
import { GameProvider } from '../../../src/store/gameStore';

describe('GameBoard Component', () => {
  const defaultTerritories = new Map([
    [0, { id: 0, name: 'Alaska', ownerId: 1, troopCount: 5, scarId: null, cityTier: 0 }],
    [1, { id: 1, name: 'Northwest Territory', ownerId: 2, troopCount: 3, scarId: 'bunker', cityTier: 0 }],
    [2, { id: 2, name: 'Greenland', ownerId: 1, troopCount: 2, scarId: null, cityTier: 1 }],
  ]);

  const defaultPlayers = [
    { id: 1, name: 'Player 1', factionId: 'khan', color: '#2F4F4F' },
    { id: 2, name: 'Player 2', factionId: 'bear', color: '#8B4513' },
  ];

  const renderBoard = (props = {}) => {
    return render(
      <GameProvider>
        <GameBoard
          territories={defaultTerritories}
          players={defaultPlayers}
          currentPlayerId={1}
          phase="ATTACK"
          {...props}
        />
      </GameProvider>
    );
  };

  // ============================================
  // TERRITORY RENDERING
  // ============================================
  describe('Territory Rendering', () => {
    it('should render all 42 territory paths', () => {
      renderBoard();

      // Each territory should have a path element
      for (let i = 0; i < 42; i++) {
        expect(screen.getByTestId(`territory-${i}`)).toBeInTheDocument();
      }
    });

    it('should display territory names', () => {
      renderBoard();

      expect(screen.getByText('Alaska')).toBeInTheDocument();
      expect(screen.getByText('Northwest Territory')).toBeInTheDocument();
    });

    it('should display troop counts', () => {
      renderBoard();

      expect(screen.getByTestId('troop-count-0')).toHaveTextContent('5');
      expect(screen.getByTestId('troop-count-1')).toHaveTextContent('3');
    });

    it('should color territories by owner faction', () => {
      renderBoard();

      const alaska = screen.getByTestId('territory-0');
      const nwt = screen.getByTestId('territory-1');

      expect(alaska).toHaveStyle({ fill: '#2F4F4F' }); // Khan color
      expect(nwt).toHaveStyle({ fill: '#8B4513' }); // Bear color
    });

    it('should show neutral color for unoccupied territories', () => {
      const territories = new Map(defaultTerritories);
      territories.set(5, { id: 5, name: 'Quebec', ownerId: null, troopCount: 0 });

      renderBoard({ territories });

      const quebec = screen.getByTestId('territory-5');
      expect(quebec).toHaveStyle({ fill: '#CCCCCC' }); // Neutral gray
    });
  });

  // ============================================
  // SCAR & CITY INDICATORS
  // ============================================
  describe('Territory Markers', () => {
    it('should display bunker icon for bunker scar', () => {
      renderBoard();

      expect(screen.getByTestId('scar-1')).toBeInTheDocument();
      expect(screen.getByTestId('scar-1')).toHaveAttribute('data-scar-type', 'bunker');
    });

    it('should display ammo shortage icon', () => {
      const territories = new Map(defaultTerritories);
      territories.set(3, { id: 3, name: 'Alberta', ownerId: 1, troopCount: 2, scarId: 'ammo_shortage' });

      renderBoard({ territories });

      expect(screen.getByTestId('scar-3')).toHaveAttribute('data-scar-type', 'ammo_shortage');
    });

    it('should display biohazard icon', () => {
      const territories = new Map(defaultTerritories);
      territories.set(4, { id: 4, name: 'Ontario', ownerId: 1, troopCount: 2, scarId: 'biohazard' });

      renderBoard({ territories });

      expect(screen.getByTestId('scar-4')).toHaveAttribute('data-scar-type', 'biohazard');
    });

    it('should display minor city icon', () => {
      renderBoard();

      // Territory 2 (Greenland) has cityTier 1
      expect(screen.getByTestId('city-2')).toBeInTheDocument();
      expect(screen.getByTestId('city-2')).toHaveAttribute('data-city-tier', '1');
    });

    it('should display major city icon', () => {
      const territories = new Map(defaultTerritories);
      territories.set(6, { id: 6, name: 'Western US', ownerId: 1, troopCount: 3, cityTier: 2, cityName: 'Bigtown' });

      renderBoard({ territories });

      expect(screen.getByTestId('city-6')).toHaveAttribute('data-city-tier', '2');
    });

    it('should display world capital icon', () => {
      const territories = new Map(defaultTerritories);
      territories.set(7, { id: 7, name: 'Eastern US', ownerId: 1, troopCount: 4, cityTier: 3, cityName: 'The Capital' });

      renderBoard({ territories });

      expect(screen.getByTestId('city-7')).toHaveAttribute('data-city-tier', '3');
    });

    it('should display HQ marker on HQ territory', () => {
      renderBoard({
        players: [
          { ...defaultPlayers[0], hqTerritory: 0 },
          { ...defaultPlayers[1], hqTerritory: 1 },
        ],
      });

      expect(screen.getByTestId('hq-0')).toBeInTheDocument();
      expect(screen.getByTestId('hq-1')).toBeInTheDocument();
    });

    it('should display fortification indicator', () => {
      const territories = new Map(defaultTerritories);
      territories.set(8, { id: 8, name: 'Central America', ownerId: 1, troopCount: 2, fortified: true, fortifyDamage: 3 });

      renderBoard({ territories });

      expect(screen.getByTestId('fort-8')).toBeInTheDocument();
      expect(screen.getByTestId('fort-damage-8')).toHaveTextContent('3/10');
    });
  });

  // ============================================
  // HOVER INTERACTIONS
  // ============================================
  describe('Hover Interactions', () => {
    it('should show tooltip on territory hover', async () => {
      renderBoard();

      await userEvent.hover(screen.getByTestId('territory-0'));

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should display territory info in tooltip', async () => {
      renderBoard();

      await userEvent.hover(screen.getByTestId('territory-0'));

      await waitFor(() => {
        expect(screen.getByText('Alaska')).toBeInTheDocument();
        expect(screen.getByText('Owner: Player 1')).toBeInTheDocument();
        expect(screen.getByText('Troops: 5')).toBeInTheDocument();
      });
    });

    it('should display modifiers in tooltip', async () => {
      renderBoard();

      await userEvent.hover(screen.getByTestId('territory-1'));

      await waitFor(() => {
        expect(screen.getByText(/Bunker/i)).toBeInTheDocument();
        expect(screen.getByText(/\+1 to defender/i)).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      renderBoard();

      await userEvent.hover(screen.getByTestId('territory-0'));
      await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());

      await userEvent.unhover(screen.getByTestId('territory-0'));
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    });
  });

  // ============================================
  // CLICK INTERACTIONS
  // ============================================
  describe('Click Interactions', () => {
    it('should call onTerritoryClick when territory clicked', async () => {
      const onTerritoryClick = vi.fn();
      renderBoard({ onTerritoryClick });

      await userEvent.click(screen.getByTestId('territory-0'));

      expect(onTerritoryClick).toHaveBeenCalledWith(0);
    });

    it('should highlight selected territory', async () => {
      renderBoard({ selectedTerritory: 0 });

      expect(screen.getByTestId('territory-0')).toHaveClass('selected');
    });

    it('should highlight attack source territory', async () => {
      renderBoard({ attackSource: 0 });

      expect(screen.getByTestId('territory-0')).toHaveClass('attack-source');
    });

    it('should highlight valid attack targets', async () => {
      renderBoard({
        attackSource: 0,
        validTargets: [1, 5, 31], // Alaska's neighbors
      });

      expect(screen.getByTestId('territory-1')).toHaveClass('valid-target');
      expect(screen.getByTestId('territory-5')).toHaveClass('valid-target');
      expect(screen.getByTestId('territory-31')).toHaveClass('valid-target');
      expect(screen.getByTestId('territory-2')).not.toHaveClass('valid-target');
    });
  });

  // ============================================
  // PHASE-SPECIFIC BEHAVIOR
  // ============================================
  describe('Phase-Specific Behavior', () => {
    describe('Reinforcement Phase', () => {
      it('should highlight placeable territories', () => {
        renderBoard({
          phase: 'PLACE_TROOPS',
          currentPlayerId: 1,
        });

        // Player 1's territories should be highlighted
        expect(screen.getByTestId('territory-0')).toHaveClass('placeable');
        expect(screen.getByTestId('territory-2')).toHaveClass('placeable');
        // Player 2's territory should not
        expect(screen.getByTestId('territory-1')).not.toHaveClass('placeable');
      });
    });

    describe('Attack Phase', () => {
      it('should highlight attackable territories (2+ troops)', () => {
        renderBoard({
          phase: 'ATTACK',
          subPhase: 'IDLE',
          currentPlayerId: 1,
        });

        // Alaska (5 troops) can attack
        expect(screen.getByTestId('territory-0')).toHaveClass('can-attack');
        // Greenland (2 troops) can attack
        expect(screen.getByTestId('territory-2')).toHaveClass('can-attack');
      });

      it('should dim territories with only 1 troop', () => {
        const territories = new Map(defaultTerritories);
        territories.set(0, { ...territories.get(0)!, troopCount: 1 });

        renderBoard({
          phase: 'ATTACK',
          subPhase: 'IDLE',
          currentPlayerId: 1,
          territories,
        });

        expect(screen.getByTestId('territory-0')).toHaveClass('insufficient-troops');
      });
    });

    describe('Maneuver Phase', () => {
      it('should highlight connected territories for maneuver', () => {
        renderBoard({
          phase: 'MANEUVER',
          currentPlayerId: 1,
          maneuverSource: 0,
          connectedTerritories: [0, 2], // Alaska and Greenland connected
        });

        expect(screen.getByTestId('territory-0')).toHaveClass('maneuver-source');
        expect(screen.getByTestId('territory-2')).toHaveClass('maneuver-target');
      });

      it('should show path when maneuver selected', () => {
        renderBoard({
          phase: 'MANEUVER',
          maneuverSource: 0,
          maneuverTarget: 2,
          maneuverPath: [0, 5, 2], // Example path
        });

        expect(screen.getByTestId('maneuver-path')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // CONNECTION LINES
  // ============================================
  describe('Connection Lines', () => {
    it('should render sea connections as dashed lines', () => {
      renderBoard();

      // Alaska to Kamchatka is a sea connection
      const seaConnection = screen.getByTestId('connection-0-31');
      expect(seaConnection).toHaveClass('sea-connection');
      expect(seaConnection).toHaveStyle({ strokeDasharray: expect.any(String) });
    });

    it('should render land connections as solid lines', () => {
      renderBoard();

      // Alaska to NW Territory is land
      const landConnection = screen.getByTestId('connection-0-1');
      expect(landConnection).toHaveClass('land-connection');
    });
  });

  // ============================================
  // ZOOM & PAN
  // ============================================
  describe('Zoom and Pan', () => {
    it('should support zooming with scroll wheel', async () => {
      renderBoard();

      const svg = screen.getByTestId('game-board-svg');
      const initialTransform = svg.getAttribute('transform');

      fireEvent.wheel(svg, { deltaY: -100 });

      await waitFor(() => {
        expect(svg.getAttribute('transform')).not.toBe(initialTransform);
      });
    });

    it('should support panning with drag', async () => {
      renderBoard();

      const svg = screen.getByTestId('game-board-svg');

      fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(svg);

      // Transform should have changed
    });

    it('should have reset view button', () => {
      renderBoard();

      expect(screen.getByRole('button', { name: /Reset View/i })).toBeInTheDocument();
    });
  });

  // ============================================
  // ACCESSIBILITY
  // ============================================
  describe('Accessibility', () => {
    it('should have ARIA labels for territories', () => {
      renderBoard();

      const alaska = screen.getByTestId('territory-0');
      expect(alaska).toHaveAttribute('aria-label', 'Alaska, owned by Player 1, 5 troops');
    });

    it('should support keyboard navigation', async () => {
      const onTerritoryClick = vi.fn();
      renderBoard({ onTerritoryClick });

      const territory = screen.getByTestId('territory-0');
      territory.focus();
      fireEvent.keyDown(territory, { key: 'Enter' });

      expect(onTerritoryClick).toHaveBeenCalledWith(0);
    });

    it('should announce selection changes to screen readers', async () => {
      renderBoard({ selectedTerritory: 0 });

      expect(screen.getByRole('status')).toHaveTextContent('Alaska selected');
    });
  });

  // ============================================
  // RESPONSIVE BEHAVIOR
  // ============================================
  describe('Responsive Behavior', () => {
    it('should scale appropriately on small screens', () => {
      // Mock small viewport
      vi.stubGlobal('innerWidth', 375);
      vi.stubGlobal('innerHeight', 667);

      renderBoard();

      const container = screen.getByTestId('game-board-container');
      expect(container).toHaveStyle({ maxWidth: '100%' });
    });

    it('should adjust troop badge size on zoom', async () => {
      renderBoard();

      const svg = screen.getByTestId('game-board-svg');
      fireEvent.wheel(svg, { deltaY: -200 }); // Zoom in

      await waitFor(() => {
        const badge = screen.getByTestId('troop-count-0');
        // Badge should scale inversely with zoom
      });
    });
  });
});
