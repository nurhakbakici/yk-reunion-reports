import type { DeptDesign } from '../types';

// Department symbols and the Atlas mark for künyeler, redrawn as lines after the
// wiki's "Departmanlar" player guide and the Atlas Company logo, so they stay
// sharp at twice the size in the exported PNG.

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const GLYPHS: Record<DeptDesign, JSX.Element> = {
  // Compass
  yonetim: (
    <>
      <circle cx="32" cy="32" r="25" />
      <path d="M32 9L36.5 27.5L55 32L36.5 36.5L32 55L27.5 36.5L9 32L27.5 27.5Z" />
      <circle cx="32" cy="32" r="3" />
    </>
  ),
  // Two-tone shield
  guvenlik: (
    <>
      <path d="M32 7L53 14.5V31C53 45 44 53 32 57.5C20 53 11 45 11 31V14.5Z" />
      <path d="M32 7V57.5C44 53 53 45 53 31V14.5Z" fill="currentColor" />
    </>
  ),
  // Leaf and molecule
  bilim: (
    <>
      <path d="M8 52C8 30 20 16 36 13C37 34 27 49 8 52Z" />
      <path d="M8 52L27 31" />
      <circle cx="47" cy="22" r="4.5" />
      <circle cx="56" cy="40" r="4.5" />
      <circle cx="41" cy="46" r="4.5" />
      <path d="M49 26L54 36M52 41L45.5 44.5M42.5 41.5L45.5 26" />
    </>
  ),
  // Spanner
  teknik: (
    <path d="M46 8C38 8 32.5 15.5 35 23L11 47C9 49 9 52.5 11 54.5C13 56.5 16.5 56.5 18.5 54.5L42.5 30.5C50 33 57.5 27.5 57.5 19.5L50.5 26.5L43 24.5L41 17Z" />
  ),
  // People over an open book
  kultur: (
    <>
      <circle cx="20" cy="16" r="5" />
      <circle cx="32" cy="12" r="5.5" />
      <circle cx="44" cy="16" r="5" />
      <path d="M11 33C11 26 15 23 20 23C23 23 25 24 26 25M53 33C53 26 49 23 44 23C41 23 39 24 38 25M22 35C22 25 27 20 32 20C37 20 42 25 42 35" />
      <path d="M7 41C16 38 25 39 32 44C39 39 48 38 57 41V56C48 53 39 54 32 58C25 54 16 53 7 56Z" />
      <path d="M32 44V58" />
    </>
  ),
};

export function DeptSymbol({ design, size = 44 }: { design: DeptDesign; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" data-symbol={design}>
      <g {...line}>{GLYPHS[design]}</g>
    </svg>
  );
}

const GLOBE = (
  <>
    <circle cx="32" cy="29" r="22" strokeWidth="3" />
    <ellipse cx="32" cy="29" rx="22" ry="7.5" strokeWidth="1.4" />
    <ellipse cx="32" cy="29" rx="9" ry="22" strokeWidth="1.4" />
    <path d="M14 18H50M14 40H50" strokeWidth="1.4" />
  </>
);
const LETTER = 'M32 5L59 60H47L32 30L17 60H5Z';
const ARC = 'M12 47Q32 62 52 47';
/** Light from the top left: the raised A catches it there and casts its shadow down-right. */
const RAISED: [number, number, string][] = [
  [-0.9, -0.9, '#e4e7eb'],
  [1.2, 1.2, '#6b7178'],
  [0, 0, '#b3b8be'],
];

/** The Atlas mark on the dog tag: a globe cut into the plate and a raised A with its arc. Colours are fixed, the plate's own. */
export function AtlasMark({ size = 104 }: { size?: number }) {
  return (
    <svg className="kunye-atlas-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Cut in: the shadow falls on the upper-left edge, the light on the lower-right one. */}
      <g fill="none" stroke="#6b7178" transform="translate(-0.7 -0.7)">{GLOBE}</g>
      <g fill="none" stroke="#e4e7eb" transform="translate(0.8 0.8)">{GLOBE}</g>
      <g fill="none" stroke="#a3a9b0">{GLOBE}</g>
      {/* A plate-coloured gap keeps the globe's lines off the letter. */}
      <path d={LETTER} fill="none" stroke="#b9bec4" strokeWidth="5" strokeLinejoin="round" />
      <path d={ARC} fill="none" stroke="#b9bec4" strokeWidth="9" strokeLinecap="round" />
      {RAISED.map(([dx, dy, colour]) => (
        <g key={colour} transform={`translate(${dx} ${dy})`} fill={colour} stroke={colour}>
          <path d={LETTER} stroke="none" />
          <path d={ARC} fill="none" strokeWidth="4.5" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
