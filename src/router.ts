import { useEffect, useState } from 'react';

// Hash routing: works the same on GitHub Pages and from a file on disk.
//   #/reports  #/report/<id>  #/templates  #/template/<id>  #/archive  #/archive/<id>

export type Route =
  | { view: 'reports' }
  | { view: 'report'; id: string }
  | { view: 'templates' }
  | { view: 'template'; id: string }
  | { view: 'archive' }
  | { view: 'archived'; id: string };

function parse(hash: string): Route {
  const [view, id] = hash.replace(/^#\/?/, '').split('/');
  if (view === 'report' && id) return { view, id: decodeURIComponent(id) };
  if (view === 'template' && id) return { view, id: decodeURIComponent(id) };
  if (view === 'templates') return { view };
  if (view === 'archive') return id ? { view: 'archived', id: decodeURIComponent(id) } : { view };
  return { view: 'reports' };
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
