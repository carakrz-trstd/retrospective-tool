import { useState } from 'preact/hooks';
import { getPhaseTexts } from '../../flow/data/schema';
import { texts } from '../../texts';

/** The Facilitator's help: what to do in each situation, including the limits of this version. */
export function FacilitatorGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        {texts.flow.guideButton}
      </button>
      {open && (
        <div class="dialog-backdrop">
          <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
            <h2 id="guide-title">{texts.flow.guideTitle}</h2>
            <div class="dialog-body">
              {getPhaseTexts().guide.map((g) => (
                <section key={g.title}>
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                </section>
              ))}
            </div>
            <div class="row">
              <button type="button" class="primary" onClick={() => setOpen(false)}>
                {texts.flow.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
