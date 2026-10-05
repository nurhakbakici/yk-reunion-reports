import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import type { Report } from '../types';
import { Document } from './Document';

const DOC_WIDTH = 794;

/** Shows the document scaled to fit the available width. The ref points at the
 *  unscaled document element, which is what the exporters photograph. */
export const PreviewPane = forwardRef<HTMLElement, { report: Report }>(function PreviewPane(
  { report },
  ref,
) {
  const paneRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(1123);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    const inner = innerRef.current;
    if (!pane || !inner) return;
    const measure = () => {
      const available = pane.clientWidth - 32;
      setScale(Math.max(0.2, Math.min(1, available / DOC_WIDTH)));
      setHeight(inner.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="preview-pane" ref={paneRef}>
      <div className="preview-sizer" style={{ width: DOC_WIDTH * scale, height: height * scale }}>
        <div className="preview-scaler" ref={innerRef} style={{ transform: `scale(${scale})` }}>
          <Document ref={ref} report={report} />
        </div>
      </div>
    </div>
  );
});
