import { CreateSessionPage } from '../ui/CreateSessionPage';
import { EndedPage } from '../ui/EndedPage';
import { HomePage } from '../ui/HomePage';
import { JoinPage } from '../ui/JoinPage';
import { LobbyPage } from '../ui/LobbyPage';
import { RemovedPage } from '../ui/RemovedPage';
import { SessionShell } from '../ui/SessionShell';
import { texts } from '../texts';
import type { AppController } from './AppController';
import { ConnectionBanner } from './ConnectionBanner';
import { InternalNotice } from './InternalNotice';
import { TakeOverDialog } from './TakeOverDialog';
import { AppContext, useApp } from './context';

function Screen() {
  const app = useApp();
  switch (app.screen.value) {
    case 'create':
      return <CreateSessionPage />;
    case 'join':
      return <JoinPage />;
    case 'lobby':
      return <LobbyPage />;
    case 'session':
      return <SessionShell />;
    case 'ended':
      return <EndedPage />;
    case 'removed':
      return <RemovedPage />;
    default:
      return <HomePage />;
  }
}

export function App(props: { controller: AppController }) {
  return (
    <AppContext.Provider value={props.controller}>
      <div class="app">
        <header class="app-header">
          <h1>{texts.appName}</h1>
        </header>
        <ConnectionBanner />
        <div class="app-body">
          <Screen />
        </div>
        <TakeOverDialog />
        <InternalNotice />
      </div>
    </AppContext.Provider>
  );
}
