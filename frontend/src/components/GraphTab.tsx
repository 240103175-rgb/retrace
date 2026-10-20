import { useEffect, useState } from 'react';
import { ENTITY_ICON, ENTITY_TYPE, RELATIONSHIP, T } from '../lib/text';
import { useAsync } from '../lib/useAsync';
import type { CaseTabProps } from '../pages/CasePage';
import { useApi } from '../services/ApiContext';
import type { Graph } from '../services/types';
import { Empty, ErrorBox, Loading } from './ui';

const W = 640;
const H = 440;
const NODE_R = 22;

/** Circular layout: deterministic, centres never overlap, readable up to a few dozen nodes. */
export function layout(graph: Graph) {
  const n = graph.nodes.length;
  const radius = n <= 1 ? 0 : Math.min(W, H) / 2 - NODE_R - 30;
  return new Map(
    graph.nodes.map((node, i) => {
      const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
      return [node.id, { x: W / 2 + radius * Math.cos(a), y: H / 2 + radius * Math.sin(a) }];
    }),
  );
}

const NARROW = '(max-width: 760px)';

/** True on phone-width screens, where the SVG is scaled down ~2× (#31). */
function useNarrow(): boolean {
  const query = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;
  const [narrow, setNarrow] = useState(query);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

export function GraphTab({ caseData }: CaseTabProps) {
  const narrow = useNarrow();
  const api = useApi();
  const graph = useAsync(() => api.graph(caseData.id), [api, caseData.id, caseData.updatedAt]);
  const [selected, setSelected] = useState<number | null>(null);

  if (graph.error) return <ErrorBox error={graph.error} onRetry={graph.reload} />;
  if (!graph.data) return <Loading />;
  const g = graph.data;
  if (g.nodes.length === 0) return <Empty>{T.emptyGraph}</Empty>;
  const pos = layout(g);
  const node = g.nodes.find((x) => x.id === selected) ?? null;
  const label = (id: number) => g.nodes.find((x) => x.id === id)?.label ?? '?';
  // Edge captions only when there is room: not on phones, not on crowded graphs.
  const captions = !narrow && g.nodes.length <= 14;
  const labelSize = narrow ? 22 : 11;
  const iconSize = narrow ? 22 : 15;

  return (
    <div className="graph-wrap">
      <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.graph} data-testid="graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" className="arrow-head" />
          </marker>
        </defs>
        {g.edges.map((e) => {
          const a = pos.get(e.sourceId)!;
          const b = pos.get(e.targetId)!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const x1 = a.x + (dx / len) * NODE_R;
          const y1 = a.y + (dy / len) * NODE_R;
          const x2 = b.x - (dx / len) * (NODE_R + 4);
          const y2 = b.y - (dy / len) * (NODE_R + 4);
          const active = selected === e.sourceId || selected === e.targetId;
          return (
            <g key={e.id} className={`edge${active ? ' is-active' : ''}`} data-testid="graph-edge">
              <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#arrow)" />
              {captions && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle">
                  {RELATIONSHIP[e.type]}
                </text>
              )}
            </g>
          );
        })}
        {g.nodes.map((n) => {
          const p = pos.get(n.id)!;
          return (
            <g
              key={n.id}
              className={`node node-${n.type}${selected === n.id ? ' is-selected' : ''}`}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => setSelected(n.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(n.id)}
              tabIndex={0}
              role="button"
              aria-label={`${ENTITY_TYPE[n.type]} ${n.label}`}
              data-testid="graph-node"
            >
              <circle r={NODE_R} />
              <text className="node-icon" dy={narrow ? 8 : 5} textAnchor="middle" fontSize={iconSize}>
                {ENTITY_ICON[n.type]}
              </text>
              <text className="node-label" dy={NODE_R + (narrow ? 24 : 14)} textAnchor="middle" fontSize={labelSize}>
                {n.label.length > (narrow ? 14 : 22) ? `${n.label.slice(0, narrow ? 13 : 21)}…` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <aside className="graph-panel" aria-live="polite">
        {node ? (
          <>
            <h3>
              {ENTITY_ICON[node.type]} {node.label}
            </h3>
            <p className="muted">{ENTITY_TYPE[node.type]}</p>
            <p>
              {T.degree}: <b>{node.degree}</b>
            </p>
            <h4>{T.links}</h4>
            <ul>
              {g.edges
                .filter((e) => e.sourceId === node.id || e.targetId === node.id)
                .map((e) => (
                  <li key={e.id}>
                    {label(e.sourceId)} <i>{RELATIONSHIP[e.type]}</i> {label(e.targetId)}
                    {e.evidenceCount > 0 && <span className="muted"> · {e.evidenceCount} док.</span>}
                  </li>
                ))}
            </ul>
          </>
        ) : (
          <p className="muted">{T.selectNode}</p>
        )}
      </aside>
    </div>
  );
}
