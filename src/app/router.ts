// A tiny hash router. The join link is "#/join/<sessionId>"; once somebody has joined, the
// session ID is removed from the address bar (so it does not stay in screenshots and history).

export type NewStep = 'questionnaire' | 'recommendation' | 'library' | 'details' | 'custom' | 'time';

export type Route =
  | { name: 'home' }
  | { name: 'new'; step: NewStep; formatId?: string }
  | { name: 'create' }
  | { name: 'join'; target: string }
  | { name: 'session' };

/** The address of a step of the format selection. */
export function newHash(step: NewStep, formatId?: string): string {
  switch (step) {
    case 'recommendation':
      return '#/new/recommendation';
    case 'library':
      return '#/new/library';
    case 'details':
      return `#/new/library/${encodeURIComponent(formatId ?? '')}`;
    case 'custom':
      return '#/new/custom';
    case 'time':
      return '#/new/time';
    default:
      return '#/new';
  }
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'new') {
    if (parts[1] === 'recommendation') return { name: 'new', step: 'recommendation' };
    if (parts[1] === 'library' && parts[2])
      return { name: 'new', step: 'details', formatId: decodeURIComponent(parts[2]) };
    if (parts[1] === 'library') return { name: 'new', step: 'library' };
    if (parts[1] === 'custom') return { name: 'new', step: 'custom' };
    if (parts[1] === 'time') return { name: 'new', step: 'time' };
    return { name: 'new', step: 'questionnaire' };
  }
  if (parts[0] === 'create') return { name: 'create' };
  if (parts[0] === 'join') return { name: 'join', target: decodeURIComponent(parts[1] ?? '') };
  if (parts[0] === 'session') return { name: 'session' };
  return { name: 'home' };
}

export function joinLink(baseUrl: string, sessionId: string): string {
  return `${baseUrl.split('#')[0]}#/join/${encodeURIComponent(sessionId)}`;
}

/** What a person typed or pasted into "join code or link": a code, or the session ID from a join link. */
export function targetFromInput(input: string): string {
  const text = input.trim();
  const marker = '#/join/';
  const at = text.indexOf(marker);
  if (at >= 0) return decodeURIComponent(text.slice(at + marker.length).split(/[/?#\s]/)[0] ?? '');
  return text;
}

export interface Router {
  current(): Route;
  navigate(hash: string): void;
  /** Replaces the address bar entry without adding a history entry (removes the session ID). */
  replace(hash: string): void;
  subscribe(cb: (route: Route) => void): () => void;
}

export function createBrowserRouter(win: Window = window): Router {
  return {
    current: () => parseHash(win.location.hash),
    navigate(hash) {
      win.location.hash = hash;
    },
    replace(hash) {
      const url = `${win.location.pathname}${win.location.search}${hash.startsWith('#') ? hash : `#${hash}`}`;
      win.history.replaceState(null, '', url);
      win.dispatchEvent(new HashChangeEvent('hashchange'));
    },
    subscribe(cb) {
      const handler = () => cb(parseHash(win.location.hash));
      win.addEventListener('hashchange', handler);
      return () => win.removeEventListener('hashchange', handler);
    },
  };
}
