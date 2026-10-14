import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/preact';
import { MemoryNetwork } from '../src/transport/MemoryTransport';
import { makeApp, renderApp } from './appHelpers';

describe('app smoke test', () => {
  it('renders <App/> without throwing and shows the internal-use notice', () => {
    renderApp(makeApp(new MemoryNetwork()));
    expect(screen.getByText(/internal use only/i)).toBeTruthy();
  });
});
