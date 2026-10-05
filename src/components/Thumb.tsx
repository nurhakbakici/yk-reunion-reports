import { useMemo } from 'react';
import type { Report, Template } from '../types';
import { Document } from './Document';

/** A blank report for a template: used for card thumbnails and the template editor preview. */
export function sampleReport(template: Template, title = ''): Report {
  return {
    id: `sample-${template.id}`,
    title,
    docNo: `${template.codePrefix || 'DOC'}-2326-0000`,
    classification: template.classification,
    stamp: '',
    hideEmpty: false,
    watermark: true,
    template,
    values: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Miniature of a document: the top of the real thing, scaled down. */
export function Thumb({ report }: { report: Report }) {
  return (
    <div className="thumb" aria-hidden="true">
      <div className="thumb-inner">
        <Document report={report} />
      </div>
    </div>
  );
}

export function TemplateThumb({ template }: { template: Template }) {
  const report = useMemo(() => sampleReport(template), [template]);
  return <Thumb report={report} />;
}
