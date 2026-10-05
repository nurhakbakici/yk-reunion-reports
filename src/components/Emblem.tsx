import type { EmblemId } from '../types';

// Original line emblems drawn for this app, so nothing here depends on the
// wiki's artwork. A template can replace them with an uploaded logo.

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Glyph({ id }: { id: EmblemId }) {
  switch (id) {
    case 'ankh':
      return (
        <g {...common}>
          <circle cx="32" cy="32" r="29" strokeWidth="1.5" strokeDasharray="38 7.5" />
          <ellipse cx="32" cy="21" rx="7" ry="9.5" strokeWidth="4.5" />
          <path d="M32 31v21M20 37h24" strokeWidth="4.5" />
        </g>
      );
    case 'shield':
      return (
        <g {...common}>
          <path d="M32 5l22 8v18c0 14-9.5 23-22 28C19.5 54 10 45 10 31V13z" strokeWidth="3" />
          <path d="M20 25h24M32 25v22" strokeWidth="4.5" />
        </g>
      );
    case 'star':
      return (
        <g {...common}>
          <path
            d="M32 4l5.5 17.5L52 14l-7.5 14.5L60 32l-15.500 3.500L52 50l-14.500-7.500L32 60l-5.500-17.500L12 50l7.500-14.500L4 32l15.500-3.500L12 14l14.500 7.500z"
            strokeWidth="2.5"
          />
          <circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none" />
        </g>
      );
    case 'sun':
      return (
        <g {...common}>
          <circle cx="32" cy="32" r="11" strokeWidth="4" />
          <path
            d="M32 5v9M32 50v9M5 32h9M50 32h9M12.9 12.9l6.4 6.4M44.7 44.7l6.4 6.4M51.1 12.9l-6.4 6.4M19.3 44.7l-6.4 6.4"
            strokeWidth="3.5"
          />
        </g>
      );
    case 'gear':
      return (
        <g {...common}>
          <circle cx="32" cy="32" r="21" strokeWidth="9" strokeDasharray="8.25 8.25" strokeLinecap="butt" />
          <circle cx="32" cy="32" r="16.5" strokeWidth="3" />
          <circle cx="32" cy="32" r="6" strokeWidth="3.5" />
        </g>
      );
    case 'leaf':
      return (
        <g {...common}>
          <path d="M12 52C10 28 24 10 54 10c0 28-16 44-42 42z" strokeWidth="3.5" />
          <path d="M12 52c8-14 18-24 32-32" strokeWidth="3" />
        </g>
      );
    case 'cross':
      return (
        <g {...common}>
          <rect x="6" y="6" width="52" height="52" rx="10" strokeWidth="3" />
          <path d="M32 18v28M18 32h28" strokeWidth="8" strokeLinecap="butt" />
        </g>
      );
    case 'atom':
      return (
        <g {...common} strokeWidth="2.8">
          <ellipse cx="32" cy="32" rx="27" ry="10" />
          <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(60 32 32)" />
          <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(120 32 32)" />
          <circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

export function Emblem({ id, size = 60 }: { id: EmblemId; size?: number }) {
  if (id === 'none') return null;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <Glyph id={id} />
    </svg>
  );
}
