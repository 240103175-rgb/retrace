import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dateTime } from '../lib/format';
import { T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import type { CaseTabProps } from '../pages/CasePage';
import { useApi } from '../services/ApiContext';
import { Empty, ErrorBox, Loading } from './ui';

export function ReportsTab({ caseData, owner }: CaseTabProps) {
  const api = useApi();
  const toast = useToast();
  const list = useAsync(() => api.listReports(caseData.id), [api, caseData.id]);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      await api.createReport(caseData.id);
      toast('ok', T.ok_created);
      list.reload();
    } catch (err) {
      toast('err', t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="tab-head">
        <h2>{T.reports}</h2>
        {owner && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void generate()}>
            {T.generateReport}
          </button>
        )}
      </div>
      {list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.length === 0 ? (
        <Empty>{T.noReports}</Empty>
      ) : (
        <ul className="items">
          {list.data.map((r) => (
            <li key={r.id} className="item report-item" data-testid="report-row">
              <Link to={`/cases/${caseData.id}/reports/${r.id}`}>
                {T.reportFrom} {dateTime(r.createdAt)}
              </Link>
              <span className="muted small">
                {' · '}
                {T.generatedBy}: {r.createdByName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
