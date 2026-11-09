// #144 what happened when: evidence grouped by day, gaps between days, payments with a running total.
import { date, money } from '../lib/format';
import { EVIDENCE_TYPE, T, tf } from '../lib/text';
import type { Evidence } from '../services/types';
import { VerificationPill } from './ui';

const ICON = { message: '✉', link: '🔗', account: '@', payment: '₸', observation: '👁' } as const;
const DAY = 24 * 60 * 60 * 1000;

export interface Day {
  key: string; // YYYY-MM-DD or '' for undated
  gapDays: number; // days since the previous dated group (0 for the first)
  items: { evidence: Evidence; total: number | null }[];
}

/** Groups evidence by observed day (undated last) and keeps a running total of payments. */
export function groupByDay(evidence: Evidence[]): Day[] {
  const sorted = [...evidence].sort((a, b) => (a.observedOn ?? '9999').localeCompare(b.observedOn ?? '9999') || a.id - b.id);
  const days: Day[] = [];
  let total = 0;
  let prev: number | null = null;
  for (const e of sorted) {
    const key = e.observedOn ?? '';
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      const at = key ? Date.parse(`${key}T00:00:00Z`) : null;
      day = { key, gapDays: at != null && prev != null ? Math.round((at - prev) / DAY) : 0, items: [] };
      if (at != null) prev = at;
      days.push(day);
    }
    if (e.type === 'payment' && e.amount != null) total += e.amount;
    day.items.push({ evidence: e, total: e.type === 'payment' && e.amount != null ? total : null });
  }
  return days;
}

export function Timeline({ evidence }: { evidence: Evidence[] }) {
  return (
    <ol className="timeline2" data-testid="timeline">
      {groupByDay(evidence).map((d) => (
        <li key={d.key || 'undated'} className="tl-day">
          {d.gapDays >= 2 && <div className="tl-gap">{tf('daysLater', { n: d.gapDays })}</div>}
          <h3 className="tl-day-title">{d.key ? date(d.key) : T.noDate}</h3>
          <ol className="tl-items">
            {d.items.map(({ evidence: e, total }) => (
              <li key={e.id} className={`tl-item tl-${e.type}`}>
                <span className="tl-icon" aria-hidden="true">
                  {ICON[e.type]}
                </span>
                <div>
                  <span className="tl-type">{EVIDENCE_TYPE[e.type]}</span> <VerificationPill value={e.verification} />
                  {e.amount != null && <b className="mono"> {money(e.amount)}</b>}
                  <p>{e.content}</p>
                  {total != null && <p className="muted small">{tf('paidTotal', { sum: money(total) })}</p>}
                </div>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
