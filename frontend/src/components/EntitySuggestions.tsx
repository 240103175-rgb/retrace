// #23 entities found in evidence text by fixed rules. Shown as hints; nothing is added without a click.
import { useState } from 'react';
import { ENTITY_ICON, ENTITY_TYPE, T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { EntitySuggestion } from '../services/types';

interface Props {
  caseId: number;
  /** Changes whenever entities or evidence change, so the list is refreshed. */
  version: string;
  onAdded(): void;
}

export function EntitySuggestions({ caseId, version, onAdded }: Props) {
  const api = useApi();
  const toast = useToast();
  const list = useAsync(() => api.entitySuggestions(caseId), [api, caseId, version]);
  const [open, setOpen] = useState(true);
  const items = list.data ?? [];
  if (!items.length) return null;

  const add = async (s: EntitySuggestion) => {
    try {
      await api.createEntity(caseId, { type: s.type, label: s.label, note: `${T.suggestionNote} #${s.evidenceIds.join(', #')}` });
      onAdded();
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

  return (
    <section className="subpanel suggestions" aria-labelledby="suggestions-title" data-testid="suggestions">
      <div className="row-between">
        <h3 id="suggestions-title">
          {T.suggestions} <span className="count">{items.length}</span>
        </h3>
        <button type="button" className="btn btn-ghost btn-xs" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? T.hide : T.show}
        </button>
      </div>
      {open && (
        <>
          <p className="muted small">{T.suggestionsHint}</p>
          <ul className="items">
            {items.map((s) => (
              <li key={`${s.type}-${s.label}`} className="suggestion">
                <span aria-hidden="true">{ENTITY_ICON[s.type]}</span>
                <span className="mono break">{s.label}</span>
                <span className="muted small">
                  {ENTITY_TYPE[s.type]} · {T.foundIn} {s.evidenceIds.map((id) => `#${id}`).join(', ')}
                </span>
                <button type="button" className="btn btn-ghost btn-xs" aria-label={`${T.add} ${s.label}`} onClick={() => void add(s)}>
                  + {T.add}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
