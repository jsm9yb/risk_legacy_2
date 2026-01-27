/**
 * Dice3D - CSS 3D cube with 6 DieFace components
 * Creates a true 3D die using transform-style: preserve-3d
 */

import { useMemo } from 'react';
import { DieFace } from './DieFace';

interface Dice3DProps {
  value: 1 | 2 | 3 | 4 | 5 | 6;
  color: 'red' | 'blue';
  isRolling?: boolean;
  size?: number;
}

// Rotation to show each face value on top/front
// These are the final rotations to land on each value
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },      // Front face
  2: { x: 0, y: -90 },    // Right face
  3: { x: 90, y: 0 },     // Bottom (rotated to front)
  4: { x: -90, y: 0 },    // Top (rotated to front)
  5: { x: 0, y: 90 },     // Left face
  6: { x: 0, y: 180 },    // Back face
};

export function Dice3D({ value, color, isRolling = false, size = 56 }: Dice3DProps) {
  const halfSize = size / 2;

  // Generate random extra rotations for variety (multiples of 360)
  const randomRotations = useMemo(() => ({
    extraX: Math.floor(Math.random() * 3) * 360,
    extraY: Math.floor(Math.random() * 3) * 360,
  }), []);

  const finalRotation = FACE_ROTATIONS[value];

  // Calculate transform for final position
  const finalTransform = isRolling
    ? undefined
    : `rotateX(${finalRotation.x + randomRotations.extraX}deg) rotateY(${finalRotation.y + randomRotations.extraY}deg)`;

  return (
    <div
      className="dice-perspective relative"
      style={{ width: size, height: size }}
    >
      <div
        className={`
          dice-preserve-3d relative w-full h-full
          ${isRolling ? 'animate-dice-3d-roll' : 'transition-transform duration-500 ease-out'}
        `}
        style={{ transform: finalTransform }}
      >
        {/* Front face - value 1 */}
        <div
          className="absolute inset-0 dice-face"
          style={{ transform: `translateZ(${halfSize}px)` }}
        >
          <DieFace value={1} color={color} />
        </div>

        {/* Back face - value 6 */}
        <div
          className="absolute inset-0 dice-face"
          style={{ transform: `rotateY(180deg) translateZ(${halfSize}px)` }}
        >
          <DieFace value={6} color={color} />
        </div>

        {/* Right face - value 2 */}
        <div
          className="absolute inset-0 dice-face"
          style={{ transform: `rotateY(90deg) translateZ(${halfSize}px)` }}
        >
          <DieFace value={2} color={color} />
        </div>

        {/* Left face - value 5 */}
        <div
          className="absolute inset-0 dice-face"
          style={{ transform: `rotateY(-90deg) translateZ(${halfSize}px)` }}
        >
          <DieFace value={5} color={color} />
        </div>

        {/* Top face - value 4 */}
        <div
          className="absolute inset-0 dice-face"
          style={{ transform: `rotateX(90deg) translateZ(${halfSize}px)` }}
        >
          <DieFace value={4} color={color} />
        </div>

        {/* Bottom face - value 3 */}
        <div
          className="absolute inset-0 dice-face"
          style={{ transform: `rotateX(-90deg) translateZ(${halfSize}px)` }}
        >
          <DieFace value={3} color={color} />
        </div>
      </div>
    </div>
  );
}

export default Dice3D;
