/**
 * DiceRoller - Wrapper managing roll physics animation
 * Generates random start rotations for variety and handles bounce/tumble animation
 */

import { useMemo } from 'react';
import { Dice3D } from './Dice3D';

interface DiceRollerProps {
  value: 1 | 2 | 3 | 4 | 5 | 6;
  color: 'red' | 'blue';
  isRolling: boolean;
  dieIndex: number;
  size?: number;
}

export function DiceRoller({ value, color, isRolling, dieIndex, size = 56 }: DiceRollerProps) {
  // Random delay for staggered rolling effect
  const animationDelay = useMemo(() => `${dieIndex * 50}ms`, [dieIndex]);

  // Random initial position offset for variety
  const initialOffset = useMemo(() => ({
    x: (Math.random() - 0.5) * 20,
    y: -30 - Math.random() * 20,
  }), []);

  return (
    <div
      className={`
        relative
        ${isRolling ? 'animate-dice-physics-roll' : ''}
      `}
      style={{
        animationDelay,
        '--dice-start-x': `${initialOffset.x}px`,
        '--dice-start-y': `${initialOffset.y}px`,
      } as React.CSSProperties}
    >
      <Dice3D
        value={value}
        color={color}
        isRolling={isRolling}
        size={size}
      />
    </div>
  );
}

export default DiceRoller;
