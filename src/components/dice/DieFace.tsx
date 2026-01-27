/**
 * DieFace - SVG component rendering pip patterns for dice values 1-6
 * Uses standard die pip positions with white pips on colored background
 */

interface DieFaceProps {
  value: 1 | 2 | 3 | 4 | 5 | 6;
  color: 'red' | 'blue';
}

// Pip positions in a 100x100 viewBox
const PIP_POSITIONS = {
  center: { cx: 50, cy: 50 },
  topLeft: { cx: 26, cy: 26 },
  topRight: { cx: 74, cy: 26 },
  middleLeft: { cx: 26, cy: 50 },
  middleRight: { cx: 74, cy: 50 },
  bottomLeft: { cx: 26, cy: 74 },
  bottomRight: { cx: 74, cy: 74 },
};

// Which pips to show for each die value
const PIP_PATTERNS: Record<number, (keyof typeof PIP_POSITIONS)[]> = {
  1: ['center'],
  2: ['topRight', 'bottomLeft'],
  3: ['topRight', 'center', 'bottomLeft'],
  4: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
  5: ['topLeft', 'topRight', 'center', 'bottomLeft', 'bottomRight'],
  6: ['topLeft', 'topRight', 'middleLeft', 'middleRight', 'bottomLeft', 'bottomRight'],
};

// Background colors for attacker (red) and defender (blue)
const BG_COLORS = {
  red: {
    face: '#dc2626',    // red-600
    border: '#f87171',  // red-400
  },
  blue: {
    face: '#2563eb',    // blue-600
    border: '#60a5fa',  // blue-400
  },
};

const PIP_RADIUS = 9;

export function DieFace({ value, color }: DieFaceProps) {
  const pips = PIP_PATTERNS[value];
  const colors = BG_COLORS[color];

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Face background with rounded corners */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="12"
        ry="12"
        fill={colors.face}
        stroke={colors.border}
        strokeWidth="3"
      />

      {/* Pips (white dots) */}
      {pips.map((position) => {
        const { cx, cy } = PIP_POSITIONS[position];
        return (
          <circle
            key={position}
            cx={cx}
            cy={cy}
            r={PIP_RADIUS}
            fill="white"
            className="drop-shadow-sm"
          />
        );
      })}
    </svg>
  );
}

export default DieFace;
