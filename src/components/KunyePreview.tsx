import { useDeferredValue, useLayoutEffect, useRef, useState } from 'react';
import { KUNYE_HEIGHT, KUNYE_WIDTH } from '../lib/kunye';
import type { Kunye } from '../types';
import { KunyeCard } from './KunyeCard';

/** The künye at its real size, or smaller when the pane is narrower than the card. */
export function KunyePreview({ kunye, label }: { kunye: Kunye; label: string }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const shown = useDeferredValue(kunye);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const measure = () => setScale(Math.max(0.3, Math.min(1, (pane.clientWidth - 32) / KUNYE_WIDTH)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="preview-pane kunye-preview" ref={paneRef}>
      <p className="kunye-preview-label">{label}</p>
      <div className="kunye-preview-sizer" style={{ width: KUNYE_WIDTH * scale, height: KUNYE_HEIGHT * scale }}>
        <div className="kunye-preview-scaler" style={{ transform: `scale(${scale})` }}>
          <KunyeCard kunye={shown} />
        </div>
      </div>
    </div>
  );
}
