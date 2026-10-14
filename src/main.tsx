import { render } from 'preact';
import { App } from './app/App';
import { AppController } from './app/AppController';
import { createBrowserRouter } from './app/router';
import { config } from './config';
import { store } from './storage/storage';
import { TabGuard } from './tabs/TabGuard';
import { PeerTransport } from './transport/PeerTransport';
import './styles.css';

const router = createBrowserRouter();
const controller = new AppController({
  createTransport: () => new PeerTransport(),
  store,
  tabGuard: new TabGuard(),
  router,
  baseUrl: () => window.location.href,
  hostOfflineHintMs: config.hostOfflineHintMs,
});

controller.boot();

render(<App controller={controller} />, document.getElementById('app')!);

// When the page is really going away, close the connections at once so that the others see the
// change immediately instead of waiting for the network to notice. The session is saved already.
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) controller.closeConnections();
});
