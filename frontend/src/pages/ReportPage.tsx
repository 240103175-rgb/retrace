import { Link, useParams } from 'react-router-dom';
import { RiskView } from '../components/RiskTab';
import { ErrorBox, Loading } from '../components/ui';
import { date, dateTime, money } from '../lib/format';
import { ENTITY_ICON, ENTITY_TYPE, EVIDENCE_TYPE, RELATIONSHIP, STATUS, T, VERIFICATION } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';

export function ReportPage() {
  const api = useApi();
  const { id, reportId } = useParams();
  const report = useAsync(() => api.getReport(Number(id), Number(reportId)), [api, id, reportId]);
  if (report.error) return <ErrorBox error={report.error} onRetry={report.reload} />;
  if (!report.data) return <Loading />;
  const r = report.data;
  const s = r.snapshot;
  const entity = new Map(s.entities.map((e) => [e.id, e]));
  const name = (eid: number) => (entity.get(eid) ? `${ENTITY_ICON[entity.get(eid)!.type]} ${entity.get(eid)!.label}` : '?');

  return (
    <>
      <div className="no-print row-between">
        <Link to={`/cases/${id}?tab=reports`} className="back">
          ← {T.back}
        </Link>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
          {T.print}
        </button>
      </div>
      <article className="report" data-testid="report">
        <header>
          <p className="report-kicker">Re:Trace · {T.reportFrom} {dateTime(r.createdAt)}</p>
          <h1>{s.case.title}</h1>
          <p>{s.case.description}</p>
          <p className="small">
            {T.status}: {STATUS[s.case.status]} · {T.owner}: {s.case.ownerName} · {T.generatedBy}: {r.createdByName}
          </p>
        </header>

        <section>
          <h2>1. {T.risk}</h2>
          <RiskView risk={s.risk} />
        </section>

        <section>
          <h2>2. {T.evidence} ({s.evidence.length})</h2>
          <table>
            <thead>
              <tr>
                <th>{T.observedOn}</th>
                <th>{T.type}</th>
                <th>{T.content}</th>
                <th>{T.verification}</th>
              </tr>
            </thead>
            <tbody>
              {s.evidence.map((e) => (
                <tr key={e.id}>
                  <td>{e.observedOn ? date(e.observedOn) : '—'}</td>
                  <td>{EVIDENCE_TYPE[e.type]}</td>
                  <td>
                    {e.content}
                    {e.amount != null && ` (${money(e.amount)})`}
                    {e.source && <div className="small">{e.source}</div>}
                  </td>
                  <td>{VERIFICATION[e.verification]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>3. {T.entities} ({s.entities.length})</h2>
          <ul>
            {s.entities.map((e) => (
              <li key={e.id}>
                {ENTITY_ICON[e.type]} <b>{e.label}</b> — {ENTITY_TYPE[e.type]}
                {e.note && `, ${e.note}`}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>4. {T.relationships} ({s.relationships.length})</h2>
          <ul>
            {s.relationships.map((rel) => (
              <li key={rel.id}>
                {name(rel.sourceId)} <i>{RELATIONSHIP[rel.type]}</i> {name(rel.targetId)} — {T.evidence.toLowerCase()}: {rel.evidenceIds.length}
              </li>
            ))}
          </ul>
        </section>

        <section className="limits">
          <h2>5. Ограничения</h2>
          <p>{T.reportLimits}</p>
        </section>
      </article>
    </>
  );
}
