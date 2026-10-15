// Plugs the contribution screens into the guided flow (Epic 3 registries). Safe to call more than once.
import {
  DefaultPhaseView,
  getPhaseControls,
  getPhaseView,
  registerPhaseControls,
  registerPhaseView,
} from '../../flow/registries';
import { ActionsView } from './ActionsView';
import { CheckInView } from './CheckInView';
import { NotesView } from './NotesView';
import { NoteTakerControl } from './NoteTakerControl';
import { RetroBoard } from './RetroBoard';
import { SurveyControls } from './SurveyControls';
import { SurveyView } from './SurveyView';

export function registerContribViews(): void {
  const views = [
    ['checkIn', 'checkIn', CheckInView],
    ['retro', 'retro.write', RetroBoard],
    ['notes', 'notes', NotesView],
    ['actions', 'actions', ActionsView],
    ['checkOut', 'checkOut', SurveyView],
  ] as const;
  for (const [key, probe, view] of views) {
    if (getPhaseView(probe) === DefaultPhaseView) registerPhaseView(key, view);
  }
  if (!getPhaseControls('notes').includes(NoteTakerControl)) registerPhaseControls('notes', NoteTakerControl);
  if (!getPhaseControls('checkOut').includes(SurveyControls))
    registerPhaseControls('checkOut', SurveyControls);
}
