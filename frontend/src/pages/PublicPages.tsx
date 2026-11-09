// Pages for the public, no account needed: report a scam (#152) and check a number or link (#154).
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FILE_TYPES, MAX_FILE_BYTES, sha256Hex, toBase64 } from '../components/Attachments';
import { useTitle } from '../components/kit';
import { Field, FormError, Logo, PrefsBar } from '../components/ui';
import { LINK_PROBLEM, T, t, tf, type TextKey } from '../lib/text';
import { errorKey } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { AttachmentInput, FileType, PublicCheck } from '../services/types';

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-page">
      <header className="public-head">
        <Logo />
        <nav className="public-links" aria-label={T.forVictims}>
          <Link to="/report">{T.reportScam}</Link>
          <Link to="/check">{T.checkLink}</Link>
          <Link to="/login">{T.investigatorLogin}</Link>
        </nav>
        <PrefsBar />
      </header>
      <main className="public-main" id="main">
        {children}
      </main>
    </div>
  );
}

function Advice() {
  return (
    <section className="advice">
      <h2>{T.adviceTitle}</h2>
      <ol>
        <li>{T.advice1}</li>
        <li>{T.advice2}</li>
        <li>{T.advice3}</li>
        <li>{T.advice4}</li>
      </ol>
    </section>
  );
}

const readBytes = (file: File) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });

export function ReportScamPage() {
  const api = useApi();
  useTitle(T.reportScam);
  const [form, setForm] = useState({ description: '', contact: '', consent: false, website: '' });
  const [file, setFile] = useState<AttachmentInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setError(null);
    if (!f) return setFile(null);
    if (!FILE_TYPES.includes(f.type as FileType)) return setError(t('err_unsupported_file'));
    if (f.size > MAX_FILE_BYTES) return setError(t('err_file_too_large'));
    const bytes = await readBytes(f);
    setFile({ filename: f.name, mimeType: f.type as FileType, dataBase64: toBase64(bytes), sha256: await sha256Hex(bytes) });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.description.trim().length < 20) return setError(T.whatHappenedHint);
    if (!form.consent) return setError(T.consentRequired);
    setBusy(true);
    try {
      const { sha256: _ignored, ...upload } = file ?? ({} as AttachmentInput);
      const res = await api.submitPublicReport({ description: form.description.trim(), contact: form.contact.trim() || null, consent: true, website: form.website, ...(file ? { file: upload } : {}) });
      setReference(res.reference);
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <PublicFrame>
        <section className="panel" data-testid="report-sent">
          <h1>{T.reportSent}</h1>
          <p className="big">{tf('reportRef', { ref: reference })}</p>
          <Advice />
        </section>
      </PublicFrame>
    );
  }
  return (
    <PublicFrame>
      <section className="panel narrow-wide">
        <h1>{T.reportScam}</h1>
        <p className="muted">{T.reportIntro}</p>
        <form className="form" onSubmit={submit} noValidate>
          <FormError message={error} />
          <Field label={T.whatHappened}>
            <textarea rows={7} maxLength={5000} placeholder={T.whatHappenedHint} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label={T.yourContact}>
            <input maxLength={200} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} autoComplete="email" />
          </Field>
          <Field label={T.screenshot}>
            <input type="file" accept={FILE_TYPES.join(',')} onChange={(e) => void pick(e)} />
          </Field>
          {/* Honeypot for bots: hidden from people and screen readers. */}
          <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <label className="check">
            <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /> {T.consent}
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? T.saving : T.send}
          </button>
        </form>
      </section>
      <Advice />
    </PublicFrame>
  );
}

export function CheckPage() {
  const api = useApi();
  useTitle(T.checkTitle);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<PublicCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.publicCheck(value.trim()));
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };
  const danger = result && (result.investigations > 0 || result.signals.length > 0);
  return (
    <PublicFrame>
      <section className="panel narrow-wide">
        <h1>{T.checkTitle}</h1>
        <p className="muted">{T.checkIntro}</p>
        <form className="check-form" onSubmit={submit} role="search">
          <input aria-label={T.checkPlaceholder} placeholder={T.checkPlaceholder} value={value} maxLength={300} onChange={(e) => setValue(e.target.value)} />
          <button className="btn btn-primary" disabled={busy}>
            {T.checkButton}
          </button>
        </form>
        <FormError message={error} />
        {result && (
          <div className={`check-result ${danger ? 'is-danger' : 'is-clear'}`} data-testid="check-result" aria-live="polite">
            {result.kind === 'unknown' ? (
              <p>{T.checkUnknown}</p>
            ) : (
              <>
                <p className="small muted">
                  {T.checkRecognised}: {T[`kind_${result.kind}` as TextKey]} <span className="mono">{result.normalised}</span>
                </p>
                <p className="big">{result.investigations > 0 ? tf('checkFoundN', { n: result.investigations }) : T.checkNotFound}</p>
                {result.signals.length > 0 && (
                  <p>
                    {T.checkSignals}: {result.signals.map((s) => LINK_PROBLEM[s] ?? s).join(', ')}
                  </p>
                )}
              </>
            )}
            <p className="disclaimer">{T.checkDisclaimer}</p>
          </div>
        )}
      </section>
      <Advice />
      <p className="center">
        <Link to="/report">{T.reportScam}</Link>
      </p>
    </PublicFrame>
  );
}
