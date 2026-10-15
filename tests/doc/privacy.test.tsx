import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import { buildDocumentModel } from '../../src/doc/build';
import { renderCsv } from '../../src/doc/csv';
import { renderHtmlDocument, renderHtmlFragment } from '../../src/doc/html';
import { renderMarkdown } from '../../src/doc/markdown';
import { renderPlainText } from '../../src/doc/text';
import { docApp } from '../ui/docHelpers';
import { sampleSession } from './sample';

let fetchSpy: ReturnType<typeof vi.fn>;
let xhrSpy: ReturnType<typeof vi.fn>;
let beaconSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  xhrSpy = vi.fn();
  beaconSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('XMLHttpRequest', xhrSpy);
  Object.defineProperty(navigator, 'sendBeacon', { value: beaconSpy, configurable: true });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  resetRegistries();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('nothing is sent during generation or export (AC-22, NFR-1)', () => {
  it('building the model and rendering every format makes no network call', () => {
    const model = buildDocumentModel(sampleSession({ special: true }), { incomplete: false });
    renderMarkdown(model);
    renderHtmlFragment(model);
    renderHtmlDocument(model);
    renderPlainText(model);
    renderCsv(model);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  });

  it('every export action in the page makes no network call', async () => {
    const { q } = docApp({ special: true });
    for (const name of [
      'Download Markdown',
      'Download HTML',
      'Download CSV for Miro',
      'Copy for Confluence',
    ]) {
      fireEvent.click(q.getByRole('button', { name }));
    }
    await q.findByText('CSV file downloaded.');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  });
});
