import { useMemo } from 'react';

interface AnimatedSvgClipProps {
  markup: string;
  replayKey: string;
  className?: string;
}

function sanitizeSvgMarkup(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '');
}

export function AnimatedSvgClip({ markup, replayKey, className }: AnimatedSvgClipProps) {
  const sanitizedMarkup = useMemo(() => sanitizeSvgMarkup(markup), [markup]);

  return (
    <div
      key={replayKey}
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
    />
  );
}

export default AnimatedSvgClip;
