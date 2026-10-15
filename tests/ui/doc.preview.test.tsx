import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import { renderHtmlFragment } from '../../src/doc/html';
import { SPECIAL } from '../doc/sample';
import { docApp } from './docHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  localStorage.clear();
});

const textOf = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content.textContent;
};

describe('preview (AC-4, AC-18)', () => {
  it('has the same text content as the exported HTML fragment', () => {
    const { container, model } = docApp();
    expect(container.querySelector('.doc-preview')!.textContent).toBe(textOf(renderHtmlFragment(model)));
  });

  it('has the same text content also for an incomplete model with special characters', () => {
    const { container, model } = docApp({ incomplete: true, special: true });
    expect(model.incomplete).toBe(true);
    expect(container.querySelector('.doc-preview')!.textContent).toBe(textOf(renderHtmlFragment(model)));
  });

  it('shows special characters as text, never as markup', () => {
    const { container } = docApp({ special: true });
    const preview = container.querySelector('.doc-preview')!;
    expect(preview.textContent).toContain(SPECIAL);
    expect(preview.querySelector('b')).toBeNull();
    expect(preview.querySelector('script')).toBeNull();
  });
});
