import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { AppController } from './AppController';

export const AppContext = createContext<AppController | null>(null);

export function useApp(): AppController {
  const app = useContext(AppContext);
  if (!app) throw new Error('AppContext is missing');
  return app;
}
