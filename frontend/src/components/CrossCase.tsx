// #136 identifiers of this case found in other investigations, and #148 similar cases.
import { Link } from 'react-router-dom';
import { ENTITY_ICON, T, tf } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';

export function Matches({ caseId, version }: { caseId: number; version: string }) {
  const api = useApi();
  const list = useAsync(() => api.matches(caseId), [api, caseId, version]);
  if (!list.data?.length) return null;
  return (
    <section className="subpanel matches" aria-labelledby="matches-title" data-testid="matches">
      <h3 id="matches-title">{T.matches}</h3>
      <p className="muted small">{T.matchesHint}</p>
      <ul className="items">
        {list.data.map((m) => (
          <li key={m.entityId} className="match">
            <span aria-hidden="true">{ENTITY_ICON[m.type]}</span> <b className="mono break">{m.label}</b>
            {m.visibleCases.length > 0 && (
              <span className="small">
                {' '}
                {T.inYourCases}{' '}
                {m.visibleCases.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ', '}
                    <Link to={`/cases/${c.id}`}>{c.title}</Link>
                  </span>
                ))}
              </span>
            )}
            {m.otherCases > 0 && <span className="pill status-in_review">{tf('otherCasesN', { n: m.otherCases })}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SimilarCases({ caseId, version }: { caseId: number; version: string }) {
  const api = useApi();
  const list = useAsync(() => api.similar(caseId), [api, caseId, version]);
  if (!list.data?.length) return null;
  return (
    <>
      <h2>{T.similar}</h2>
      <ul className="items" data-testid="similar">
        {list.data.map((c) => (
          <li key={c.id} className="item">
            <Link to={`/cases/${c.id}`}>{c.title}</Link>
            <p className="muted small">
              {T.sharedLabel} {c.shared.map((s) => s.label).join(', ')}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
