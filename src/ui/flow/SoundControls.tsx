import { useApp } from '../../app/context';
import { texts } from '../../texts';

export function SoundControls(props: { isFacilitator: boolean }) {
  const app = useApp();
  const flow = app.flowState();
  const localMuted = app.localMuted.value;
  return (
    <div class="sound-controls row">
      <button type="button" onClick={() => app.setLocalMuted(!localMuted)}>
        {localMuted ? texts.flow.unmuteDevice : texts.flow.muteDevice}
      </button>
      {props.isFacilitator ? (
        <button
          type="button"
          onClick={() => app.flowIntent('flow.muteAll', { muted: !flow.soundMutedForAll })}
        >
          {flow.soundMutedForAll ? texts.flow.unmuteAll : texts.flow.muteAll}
        </button>
      ) : (
        flow.soundMutedForAll && <p class="hint">{texts.flow.mutedByFacilitator}</p>
      )}
    </div>
  );
}
