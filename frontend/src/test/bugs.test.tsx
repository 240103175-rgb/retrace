// Regression tests for user-test-bug issues.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphTab } from '../components/GraphTab';
import { ReportsTab } from '../components/ReportsTab';
import type { RetraceApi } from '../services/api';
import { ApiProvider } from '../services/ApiContext';
import type { CaseSummary } from '../services/types';
import { ToastProvider } from '../lib/toast';

const caseData = { id: 1, updatedAt: '2026-10-20T09:00:00Z' } as CaseSummary;
const wrap = (api: Partial<RetraceApi>, ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ApiProvider api={api as RetraceApi}>
        <ToastProvider>{ui}</ToastProvider>
      </ApiProvider>
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('#30 report list row', () => {
  it('separates the date link from the author', async () => {
    const api = { listReports: async () => [{ id: 7, caseId: 1, createdAt: '2026-10-20T09:14:00Z', createdBy: 1, createdByName: 'Айгерим Нурланова' }] };
    wrap(api, <ReportsTab caseData={caseData} editable owner onChanged={() => {}} />);
    const row = await screen.findByTestId('report-row');
    expect(row.textContent).toMatch(/\d{2}:\d{2} · Составил: Айгерим Нурланова/);
  });
});

describe('#31 graph on a phone', () => {
  const graph = {
    nodes: [
      { id: 1, type: 'account' as const, label: '@hr_manager_astana', degree: 1 },
      { id: 2, type: 'card' as const, label: '4400 ****', degree: 1 },
    ],
    edges: [{ id: 3, sourceId: 1, targetId: 2, type: 'paid' as const, evidenceCount: 0 }],
  };
  const media = (matches: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({ matches, media: q, addEventListener() {}, removeEventListener() {} }));

  it('uses large labels and hides edge captions on narrow screens', async () => {
    media(true);
    wrap({ graph: async () => graph }, <GraphTab caseData={caseData} editable owner onChanged={() => {}} />);
    const svg = await screen.findByTestId('graph');
    const label = svg.querySelector('.node-label')!;
    expect(Number(label.getAttribute('font-size'))).toBeGreaterThanOrEqual(20);
    expect(within(screen.getAllByTestId('graph-edge')[0]).queryByText('заплатил')).toBeNull();
  });

  it('keeps captions and normal labels on wide screens', async () => {
    media(false);
    wrap({ graph: async () => graph }, <GraphTab caseData={caseData} editable owner onChanged={() => {}} />);
    const svg = await screen.findByTestId('graph');
    expect(Number(svg.querySelector('.node-label')!.getAttribute('font-size'))).toBe(11);
    expect(within(screen.getAllByTestId('graph-edge')[0]).getByText('заплатил')).toBeInTheDocument();
  });
});
