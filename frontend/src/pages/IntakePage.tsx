// #152 investigators see victims' reports from the public form and take one as their case.
import { useNavigate } from 'react-router-dom';
import { useTitle } from '../components/kit';
import { Empty, ErrorBox, Loading } from '../components/ui';
import { fileSize } from '../components/Attachments';
import { dateTime } from '../lib/format';
import { T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';

export function IntakePage() {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  useTitle(T.intake);
  const list = useAsync(() => api.listIntake('new'), [api]);
  const take = async (id: number) => {
    try {
      const c = await api.takeIntake(id);
      toast('ok', T.ok_taken);
      navigate(`/cases/${c.id}`);
    } catch (err) {
      toast('err', t(errorKey(err)));
      list.reload();
    }
  };
  return (
    <>
      <h1>{T.intake}</h1>
      <p className="muted">{T.intakeHint}</p>
      {list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.length === 0 ? (
        <Empty>{T.noIntake}</Empty>
      ) : (
        <ul className="items" data-testid="intake">
          {list.data.map((r) => (
            <li key={r.id} className="item" data-testid="intake-row">
              <div className="item-head">
                <b className="mono">{r.reference}</b>
                <span className="muted">{dateTime(r.createdAt)}</span>
              </div>
              <p className="pre">{r.description}</p>
              {r.contact && (
                <p className="small">
                  {T.contact}: {r.contact}
                </p>
              )}
              {r.file && (
                <p className="small muted">
                  {T.attachedFile}: {r.file.filename} · {fileSize(r.file.size)}
                </p>
              )}
              <div className="item-actions">
                <button type="button" className="btn btn-primary btn-xs" onClick={() => void take(r.id)}>
                  {T.take}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
