/**
 * CombatModal Component Tests
 * Tests for: dice display, modifiers, missile countdown, results
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CombatModal } from '../../../src/components/game/CombatModal';
import { GameProvider } from '../../../src/store/gameStore';

describe('CombatModal Component', () => {
  const defaultProps = {
    isOpen: true,
    attackerId: 1,
    defenderId: 2,
    fromTerritory: { id: 0, name: 'Alaska', troopCount: 5 },
    toTerritory: { id: 1, name: 'Northwest Territory', troopCount: 3, scarId: null },
    onClose: vi.fn(),
  };

  const renderModal = (props = {}) => {
    return render(
      <GameProvider>
        <CombatModal {...defaultProps} {...props} />
      </GameProvider>
    );
  };

  // ============================================
  // INITIAL RENDERING
  // ============================================
  describe('Initial Rendering', () => {
    it('should display territory names', () => {
      renderModal();

      expect(screen.getByText('Alaska')).toBeInTheDocument();
      expect(screen.getByText('Northwest Territory')).toBeInTheDocument();
    });

    it('should display attacker and defender labels', () => {
      renderModal({
        attackerName: 'Player 1',
        defenderName: 'Player 2',
      });

      expect(screen.getByText(/Player 1/)).toBeInTheDocument();
      expect(screen.getByText(/Player 2/)).toBeInTheDocument();
    });

    it('should display faction information', () => {
      renderModal({
        attackerFaction: 'Khan Industries',
        defenderFaction: 'Enclave of the Bear',
      });

      expect(screen.getByText('Khan Industries')).toBeInTheDocument();
      expect(screen.getByText('Enclave of the Bear')).toBeInTheDocument();
    });
  });

  // ============================================
  // DICE SELECTION PHASE
  // ============================================
  describe('Dice Selection', () => {
    it('should show dice count selector for attacker', () => {
      renderModal({ phase: 'ATTACKER_DICE' });

      expect(screen.getByText(/Select attack dice/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    });

    it('should disable dice options above troop limit', () => {
      renderModal({
        phase: 'ATTACKER_DICE',
        fromTerritory: { ...defaultProps.fromTerritory, troopCount: 2 },
      });

      // With 2 troops, can only attack with 1 die
      expect(screen.getByRole('button', { name: '1' })).toBeEnabled();
      expect(screen.getByRole('button', { name: '2' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '3' })).toBeDisabled();
    });

    it('should call onSelectDice when dice count selected', () => {
      const onSelectDice = vi.fn();
      renderModal({ phase: 'ATTACKER_DICE', onSelectDice });

      fireEvent.click(screen.getByRole('button', { name: '3' }));

      expect(onSelectDice).toHaveBeenCalledWith(3);
    });

    it('should show waiting message for defender during attacker selection', () => {
      renderModal({
        phase: 'ATTACKER_DICE',
        isDefender: true,
      });

      expect(screen.getByText(/Attacker is selecting dice/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // DEFENDER DICE SELECTION
  // ============================================
  describe('Defender Dice Selection', () => {
    it('should show dice selector for defender', () => {
      renderModal({
        phase: 'DEFENDER_DICE',
        isDefender: true,
      });

      expect(screen.getByText(/Select defense dice/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    });

    it('should show countdown timer for defender', () => {
      renderModal({
        phase: 'DEFENDER_DICE',
        isDefender: true,
        timeRemaining: 8,
      });

      expect(screen.getByText(/8s/)).toBeInTheDocument();
    });

    it('should limit defender to 1 die when only 1 troop', () => {
      renderModal({
        phase: 'DEFENDER_DICE',
        isDefender: true,
        toTerritory: { ...defaultProps.toTerritory, troopCount: 1 },
      });

      expect(screen.getByRole('button', { name: '1' })).toBeEnabled();
      expect(screen.getByRole('button', { name: '2' })).toBeDisabled();
    });
  });

  // ============================================
  // DICE DISPLAY
  // ============================================
  describe('Dice Display', () => {
    const diceResults = {
      attackerDice: [
        { value: 6, modifiable: true },
        { value: 4, modifiable: true },
        { value: 2, modifiable: true },
      ],
      defenderDice: [
        { value: 5, modifiable: true },
        { value: 3, modifiable: true },
      ],
    };

    it('should display all rolled dice', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        ...diceResults,
      });

      // Attacker dice
      expect(screen.getByTestId('attacker-die-0')).toHaveTextContent('6');
      expect(screen.getByTestId('attacker-die-1')).toHaveTextContent('4');
      expect(screen.getByTestId('attacker-die-2')).toHaveTextContent('2');

      // Defender dice
      expect(screen.getByTestId('defender-die-0')).toHaveTextContent('5');
      expect(screen.getByTestId('defender-die-1')).toHaveTextContent('3');
    });

    it('should sort dice highest to lowest', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        attackerDice: [
          { value: 2, modifiable: true },
          { value: 6, modifiable: true },
          { value: 4, modifiable: true },
        ],
      });

      const dice = screen.getAllByTestId(/attacker-die-/);
      expect(dice[0]).toHaveTextContent('6');
      expect(dice[1]).toHaveTextContent('4');
      expect(dice[2]).toHaveTextContent('2');
    });

    it('should display modifier indicators', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        ...diceResults,
        toTerritory: { ...defaultProps.toTerritory, scarId: 'bunker' },
        modifiers: [{ type: 'bunker', target: 'defender', bonus: 1 }],
      });

      expect(screen.getByText(/\+1 Bunker/i)).toBeInTheDocument();
    });

    it('should show modified die value with indicator', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        defenderDice: [
          { value: 5, modifiable: true, modifiedValue: 6, modifiedBy: 'bunker' },
          { value: 3, modifiable: true },
        ],
      });

      const die = screen.getByTestId('defender-die-0');
      expect(die).toHaveTextContent('6'); // Modified value shown
      expect(screen.getByText(/\+1/)).toBeInTheDocument();
    });

    it('should highlight missile-modified dice', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        attackerDice: [
          { value: 6, modifiable: false, missileUsed: true },
          { value: 4, modifiable: true },
        ],
      });

      const missileDie = screen.getByTestId('attacker-die-0');
      expect(missileDie).toHaveClass('missile-modified');
    });
  });

  // ============================================
  // MISSILE WINDOW
  // ============================================
  describe('Missile Window', () => {
    it('should show missile button when player has missiles', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        playerMissiles: 2,
        attackerDice: [{ value: 3, modifiable: true }],
      });

      expect(screen.getByRole('button', { name: /Use Missile/i })).toBeInTheDocument();
    });

    it('should hide missile button when no missiles', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        playerMissiles: 0,
      });

      expect(screen.queryByRole('button', { name: /Use Missile/i })).not.toBeInTheDocument();
    });

    it('should display missile countdown timer', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        missileTimeRemaining: 4,
      });

      expect(screen.getByTestId('missile-timer')).toHaveTextContent('4');
    });

    it('should call onUseMissile when missile button clicked', () => {
      const onUseMissile = vi.fn();
      renderModal({
        phase: 'MISSILE_WINDOW',
        playerMissiles: 2,
        attackerDice: [
          { value: 2, modifiable: true },
          { value: 1, modifiable: true },
        ],
        onUseMissile,
      });

      // Click on die to select, then use missile
      fireEvent.click(screen.getByTestId('attacker-die-1'));
      fireEvent.click(screen.getByRole('button', { name: /Use Missile/i }));

      expect(onUseMissile).toHaveBeenCalledWith(1);
    });

    it('should disable missile on already-unmodifiable die', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        playerMissiles: 2,
        attackerDice: [
          { value: 6, modifiable: false, missileUsed: true },
          { value: 3, modifiable: true },
        ],
      });

      // First die should not be selectable
      fireEvent.click(screen.getByTestId('attacker-die-0'));
      expect(screen.getByRole('button', { name: /Use Missile/i })).toBeDisabled();
    });

    it('should show remaining missiles count', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        playerMissiles: 2,
      });

      expect(screen.getByText(/2 left/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // COMBAT RESOLUTION
  // ============================================
  describe('Combat Resolution', () => {
    it('should display win/lose indicators for each comparison', () => {
      renderModal({
        phase: 'RESOLVE',
        attackerDice: [
          { value: 6, modifiable: true },
          { value: 3, modifiable: true },
        ],
        defenderDice: [
          { value: 5, modifiable: true },
          { value: 4, modifiable: true },
        ],
        results: {
          comparisons: [
            { attacker: 6, defender: 5, winner: 'attacker' },
            { attacker: 3, defender: 4, winner: 'defender' },
          ],
        },
      });

      expect(screen.getByText(/6 vs 5/)).toBeInTheDocument();
      expect(screen.getByText(/WIN/)).toBeInTheDocument();
      expect(screen.getByText(/3 vs 4/)).toBeInTheDocument();
      expect(screen.getByText(/LOSE/)).toBeInTheDocument();
    });

    it('should display tie as defender win', () => {
      renderModal({
        phase: 'RESOLVE',
        attackerDice: [{ value: 4, modifiable: true }],
        defenderDice: [{ value: 4, modifiable: true }],
        results: {
          comparisons: [
            { attacker: 4, defender: 4, winner: 'defender', tie: true },
          ],
        },
      });

      expect(screen.getByText(/TIE - Defender wins/i)).toBeInTheDocument();
    });

    it('should display casualty counts', () => {
      renderModal({
        phase: 'RESOLVE',
        results: {
          attackerLosses: 1,
          defenderLosses: 2,
        },
      });

      expect(screen.getByText(/Attacker loses 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Defender loses 2/i)).toBeInTheDocument();
    });

    it('should show conquest message when defender eliminated', () => {
      renderModal({
        phase: 'RESOLVE',
        results: {
          conquered: true,
          defenderLosses: 3,
          newDefenderTroops: 0,
        },
      });

      expect(screen.getByText(/CONQUERED/i)).toBeInTheDocument();
    });

    it('should display Supreme Firepower result', () => {
      renderModal({
        phase: 'RESOLVE',
        results: {
          supremeFirepower: true,
          defenderLosses: 3,
        },
      });

      expect(screen.getByText(/Supreme Firepower!/i)).toBeInTheDocument();
      expect(screen.getByText(/3 troops/i)).toBeInTheDocument();
    });

    it('should display Stubborn bonus result', () => {
      renderModal({
        phase: 'RESOLVE',
        results: {
          stubbornBonus: true,
          attackerLosses: 2,
        },
      });

      expect(screen.getByText(/Stubborn!/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // TROOP MOVEMENT (Post-Conquest)
  // ============================================
  describe('Troop Movement', () => {
    it('should show troop movement slider after conquest', () => {
      renderModal({
        phase: 'TROOP_MOVE',
        diceUsed: 3,
        availableTroops: 5,
      });

      expect(screen.getByText(/Move troops/i)).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('should enforce minimum troops based on dice used', () => {
      renderModal({
        phase: 'TROOP_MOVE',
        diceUsed: 3,
        availableTroops: 5,
      });

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '3');
    });

    it('should enforce maximum troops (all but 1)', () => {
      renderModal({
        phase: 'TROOP_MOVE',
        diceUsed: 3,
        availableTroops: 5,
      });

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('max', '4'); // 5 - 1
    });

    it('should call onMoveTroops with selected count', () => {
      const onMoveTroops = vi.fn();
      renderModal({
        phase: 'TROOP_MOVE',
        diceUsed: 2,
        availableTroops: 6,
        onMoveTroops,
      });

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '4' } });
      fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

      expect(onMoveTroops).toHaveBeenCalledWith(4);
    });
  });

  // ============================================
  // ANIMATIONS
  // ============================================
  describe('Animations', () => {
    it('should show dice roll animation', async () => {
      renderModal({
        phase: 'ROLLING',
        isRolling: true,
      });

      expect(screen.getByTestId('dice-animation')).toBeInTheDocument();
    });

    it('should show casualty animation after resolution', async () => {
      renderModal({
        phase: 'RESOLVE',
        showCasualtyAnimation: true,
        results: { defenderLosses: 2 },
      });

      await waitFor(() => {
        expect(screen.getByTestId('casualty-animation')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // ACCESSIBILITY
  // ============================================
  describe('Accessibility', () => {
    it('should have proper ARIA labels for dice', () => {
      renderModal({
        phase: 'MISSILE_WINDOW',
        attackerDice: [{ value: 6, modifiable: true }],
      });

      expect(screen.getByTestId('attacker-die-0')).toHaveAttribute(
        'aria-label',
        'Attacker die showing 6'
      );
    });

    it('should announce combat results to screen readers', () => {
      renderModal({
        phase: 'RESOLVE',
        results: { attackerLosses: 1, defenderLosses: 1 },
      });

      expect(screen.getByRole('alert')).toHaveTextContent(/Combat resolved/i);
    });

    it('should support keyboard navigation for dice selection', () => {
      const onSelectDice = vi.fn();
      renderModal({
        phase: 'ATTACKER_DICE',
        onSelectDice,
      });

      const button = screen.getByRole('button', { name: '3' });
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(onSelectDice).toHaveBeenCalledWith(3);
    });
  });
});
