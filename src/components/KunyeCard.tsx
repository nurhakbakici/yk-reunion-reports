import {
  CRYO_SHORT,
  DEPARTMENT_OF,
  clearanceBar,
  initials,
  kunyeDesign,
  nameSize,
  shortOrigin,
  surnameFirst,
  upperText,
  upperTr,
} from '../lib/kunye';
import type { DeptDesign, Kunye } from '../types';
import { AtlasMark, DeptSymbol } from './DeptSymbol';

// The künye as it is exported: 600×190, fixed pixels, named fonts (kunye.css).
// Its fixed text is Turkish whatever the app's language, like any in-game document;
// what the player typed is capitalised word by word (upperText), English words the English way.

const join = (parts: (string | false | undefined)[]): string => parts.filter(Boolean).join(' · ');
const blood = (k: Kunye): string => (k.blood ? `KAN ${upperText(k.blood)}` : '');
const cryo = (k: Kunye): string => (k.cryo ? CRYO_SHORT[k.cryo] : '');

export function KunyeCard({ kunye }: { kunye: Kunye }) {
  const design = kunyeDesign(kunye);
  return design === 'atlas' ? <AtlasTag kunye={kunye} /> : <DeptCard kunye={kunye} design={design} />;
}

function DeptCard({ kunye: k, design }: { kunye: Kunye; design: DeptDesign }) {
  const name = k.name.trim();
  const ids = join([k.serial, upperText(shortOrigin(k.origin)), cryo(k)]);
  return (
    <div className={`kunye kunye-card kunye-${design}`} data-design={design}>
      <div className="kunye-portrait">{k.portrait ? <img src={k.portrait} alt="" /> : <span>{initials(name)}</span>}</div>
      <div className="kunye-info">
        <div className="kunye-head">ANKH-A · {upperTr(DEPARTMENT_OF[design])}</div>
        <div className={`kunye-name size-${nameSize(name)}${name ? '' : ' empty'}`}>{name || 'Ad Soyad'}</div>
        {k.title.trim() && <div className="kunye-role">{k.title.trim()}</div>}
        {ids && <div className="kunye-line mono">{ids}</div>}
        <Marks kunye={k} />
        {k.note.trim() && <div className="kunye-note">“{k.note.trim()}”</div>}
      </div>
      <div className="kunye-symbol">
        <DeptSymbol design={design} />
      </div>
    </div>
  );
}

/** Clearance and blood type. The bar is drawn as boxes, as the reports draw their scales: the card's fonts have no ▰. */
function Marks({ kunye: k }: { kunye: Kunye }) {
  if (k.clearance > 0) {
    return (
      <div className="kunye-line mono accent">
        YETKİ <span className="kunye-pips" aria-label={clearanceBar(k.clearance)}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={i < k.clearance ? 'kunye-pip on' : 'kunye-pip'} />
          ))}
        </span>
        {` ${k.clearance}/5${k.blood ? ` · ${blood(k)}` : ''}`}
      </div>
    );
  }
  return k.blood ? <div className="kunye-line mono accent">{blood(k)}</div> : null;
}

function AtlasTag({ kunye: k }: { kunye: Kunye }) {
  const name = surnameFirst(k.name);
  const unit = join([upperText(k.rank.trim()), upperText(k.squad.trim())]);
  const last = join([blood(k), upperText(shortOrigin(k.origin)), cryo(k)]);
  return (
    <div className="kunye kunye-atlas" data-design="atlas">
      <div className="kunye-chain" />
      <div className="kunye-plate">
        <div className="kunye-hole" />
        <div className="kunye-plate-text">
          <div className="kunye-org">ATLAS GÜVENLİK ŞİRKETİ</div>
          <div className={`kunye-name size-${nameSize(name)}${name ? '' : ' empty'}`}>{name || 'SOYAD, AD'}</div>
          {unit && <div>{unit}</div>}
          <div>{k.serial}</div>
          {last && <div>{last}</div>}
        </div>
        <AtlasMark />
      </div>
    </div>
  );
}
