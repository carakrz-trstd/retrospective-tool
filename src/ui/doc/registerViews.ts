import { registerOfflineHintAction } from '../../app/bannerActions';
import { OpenDocumentationAction } from './OpenDocumentationAction';

/** Plugs the documentation into Epic 1's connection banner. Safe to call more than once. */
export function registerDocViews(): void {
  registerOfflineHintAction(OpenDocumentationAction);
}
