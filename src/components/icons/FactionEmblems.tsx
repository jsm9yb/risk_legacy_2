import { FactionId } from '@/types/game';

interface EmblemProps {
  className?: string;
  size?: number;
}

// Die Mechaniker - Gear/Cog icon representing mechanical engineering
export function MechanikerEmblem({ className = '', size = 40 }: EmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-label="Die Mechaniker emblem"
    >
      <circle cx="20" cy="20" r="18" fill="#4A90A4" />
      <g fill="white">
        {/* Outer gear teeth */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="18"
            y="4"
            width="4"
            height="6"
            transform={`rotate(${angle} 20 20)`}
          />
        ))}
        {/* Inner gear ring */}
        <circle cx="20" cy="20" r="10" fill="white" />
        <circle cx="20" cy="20" r="6" fill="#4A90A4" />
        {/* Center dot */}
        <circle cx="20" cy="20" r="2" fill="white" />
      </g>
    </svg>
  );
}

// Enclave of the Bear - Bear head silhouette
export function EnclaveEmblem({ className = '', size = 40 }: EmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-label="Enclave of the Bear emblem"
    >
      <circle cx="20" cy="20" r="18" fill="#8B4513" />
      <g fill="white">
        {/* Bear ears */}
        <circle cx="10" cy="10" r="5" />
        <circle cx="30" cy="10" r="5" />
        {/* Bear head */}
        <ellipse cx="20" cy="20" rx="12" ry="10" />
        {/* Bear snout */}
        <ellipse cx="20" cy="25" rx="5" ry="4" fill="#8B4513" />
        <ellipse cx="20" cy="24" rx="3" ry="2" fill="white" />
        {/* Bear eyes */}
        <circle cx="14" cy="18" r="2" fill="#8B4513" />
        <circle cx="26" cy="18" r="2" fill="#8B4513" />
        {/* Bear nose */}
        <ellipse cx="20" cy="26" rx="2" ry="1.5" fill="#8B4513" />
      </g>
    </svg>
  );
}

// Imperial Balkania - Crown icon representing imperial power
export function BalkaniaEmblem({ className = '', size = 40 }: EmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-label="Imperial Balkania emblem"
    >
      <circle cx="20" cy="20" r="18" fill="#6B3FA0" />
      <g fill="white">
        {/* Crown base */}
        <rect x="8" y="26" width="24" height="4" rx="1" />
        {/* Crown points */}
        <polygon points="8,26 10,14 14,20 20,10 26,20 30,14 32,26" />
        {/* Crown jewels */}
        <circle cx="10" cy="16" r="2" fill="#FFD700" />
        <circle cx="20" cy="12" r="2.5" fill="#FFD700" />
        <circle cx="30" cy="16" r="2" fill="#FFD700" />
        {/* Base jewel */}
        <circle cx="20" cy="28" r="1.5" fill="#FFD700" />
      </g>
    </svg>
  );
}

// Khan Industries - Factory/Industrial icon
export function KhanEmblem({ className = '', size = 40 }: EmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-label="Khan Industries emblem"
    >
      <circle cx="20" cy="20" r="18" fill="#2F4F4F" />
      <g fill="white">
        {/* Factory building */}
        <rect x="6" y="22" width="28" height="12" />
        {/* Factory roof with sawtooth */}
        <polygon points="6,22 6,16 14,22" />
        <polygon points="14,22 14,14 22,22" />
        <polygon points="22,22 22,12 30,22" />
        {/* Smokestack */}
        <rect x="30" y="8" width="4" height="14" />
        {/* Smoke puffs */}
        <circle cx="32" cy="6" r="2" fill="white" opacity="0.8" />
        <circle cx="34" cy="4" r="1.5" fill="white" opacity="0.6" />
        {/* Windows */}
        <rect x="10" y="26" width="4" height="4" fill="#2F4F4F" />
        <rect x="18" y="26" width="4" height="4" fill="#2F4F4F" />
        <rect x="26" y="26" width="4" height="4" fill="#2F4F4F" />
      </g>
    </svg>
  );
}

// Saharan Republic - Sun/Desert icon
export function SaharanEmblem({ className = '', size = 40 }: EmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-label="Saharan Republic emblem"
    >
      <circle cx="20" cy="20" r="18" fill="#DAA520" />
      <g fill="white">
        {/* Sun center */}
        <circle cx="20" cy="20" r="8" />
        {/* Sun rays */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
          <polygon
            key={angle}
            points="20,8 18,12 22,12"
            transform={`rotate(${angle} 20 20)`}
          />
        ))}
        {/* Inner sun face detail */}
        <circle cx="20" cy="20" r="5" fill="#DAA520" />
        {/* Sun face - stylized */}
        <circle cx="17" cy="19" r="1" fill="white" />
        <circle cx="23" cy="19" r="1" fill="white" />
        <path
          d="M 16 23 Q 20 26 24 23"
          stroke="white"
          strokeWidth="1.5"
          fill="none"
        />
      </g>
    </svg>
  );
}

// Map of faction IDs to their emblem components
export const FactionEmblemComponents: Record<FactionId, React.FC<EmblemProps>> = {
  mechaniker: MechanikerEmblem,
  enclave: EnclaveEmblem,
  balkania: BalkaniaEmblem,
  khan: KhanEmblem,
  saharan: SaharanEmblem,
};

// Generic faction emblem component that renders the appropriate emblem
interface FactionEmblemProps extends EmblemProps {
  factionId: FactionId;
}

export function FactionEmblem({ factionId, className = '', size = 40 }: FactionEmblemProps) {
  const EmblemComponent = FactionEmblemComponents[factionId];

  if (!EmblemComponent) {
    // Fallback to a generic circle if faction not found
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        className={className}
        aria-label="Unknown faction emblem"
      >
        <circle cx="20" cy="20" r="18" fill="#666" />
        <text
          x="20"
          y="25"
          textAnchor="middle"
          fill="white"
          fontSize="16"
          fontWeight="bold"
        >
          ?
        </text>
      </svg>
    );
  }

  return <EmblemComponent className={className} size={size} />;
}

export default FactionEmblem;
