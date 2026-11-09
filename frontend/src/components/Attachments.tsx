// #25 files attached to one piece of evidence: list, upload with a SHA-256 checksum, download, delete.
// #146 image files: recognise their text in the browser and hand it to the evidence form for review.
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { OCR_TYPES, recognizeText, type OcrJob } from '../lib/ocr';
import { T, t, tf } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { Attachment, FileType } from '../services/types';
import { saveDownload, useConfirm } from './kit';

export const FILE_TYPES: FileType[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'];
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const fileSize = (n: number) => (n < 1024 ? `${n} ${T.unitB}` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} ${T.unitKB}` : `${(n / 1024 / 1024).toFixed(2)} ${T.unitMB}`);

/** Bytes → base64 without building one huge string argument. */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** jsdom's File has no arrayBuffer(); FileReader works everywhere. */
const readBytes = (file: File) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });

interface Props {
  caseId: number;
  evidenceId: number;
  files: Attachment[];
  editable: boolean;
  onChanged(): void;
  /** Recognised text from an image attachment; nothing is saved until the person saves the form. */
  onRecognized?(text: string, filename: string): void;
}

export function Attachments({ caseId, evidenceId, files, editable, onChanged, onRecognized }: Props) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [ocr, setOcr] = useState<{ id: number; percent: number } | null>(null);
  const job = useRef<OcrJob | null>(null);
  useEffect(() => () => job.current?.cancel(), []);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!FILE_TYPES.includes(file.type as FileType)) return toast('err', t('err_unsupported_file'));
    if (file.size > MAX_FILE_BYTES) return toast('err', t('err_file_too_large'));
    setBusy(true);
    try {
      const bytes = await readBytes(file);
      // The checksum is computed here and checked by the server, so a corrupted upload is refused.
      await api.uploadAttachment(caseId, evidenceId, { filename: file.name, mimeType: file.type as FileType, dataBase64: toBase64(bytes), sha256: await sha256Hex(bytes) });
      toast('ok', T.ok_fileAdded);
      onChanged();
    } catch (err) {
      toast('err', t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Attachment) => {
    if (!(await confirm({ title: T.confirmDelete, text: a.filename }))) return;
    try {
      await api.deleteAttachment(caseId, evidenceId, a.id);
      toast('ok', T.ok_deleted);
      onChanged();
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

  const download = async (a: Attachment) => {
    try {
      saveDownload(await api.downloadAttachment(caseId, evidenceId, a));
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

  const recognize = async (a: Attachment) => {
    if (!onRecognized || job.current) return;
    setOcr({ id: a.id, percent: 0 });
    try {
      const { blob } = await api.downloadAttachment(caseId, evidenceId, a);
      job.current = recognizeText(blob, (p) => setOcr({ id: a.id, percent: Math.round(p * 100) }));
      const text = await job.current.result;
      if (!text) toast('err', T.ocrEmpty);
      else {
        onRecognized(text, a.filename);
        toast('ok', T.ocrReview);
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast('err', (err as { status?: number })?.status ? t(errorKey(err)) : T.ocrFailed);
    } finally {
      job.current = null;
      setOcr(null);
    }
  };

  if (!files.length && !editable) return null;
  return (
    <div className="files" data-testid="attachments">
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((a) => (
            <li key={a.id}>
              <span aria-hidden="true">📎</span>
              <button type="button" className="link-btn" onClick={() => void download(a)} title={T.download}>
                {a.filename}
              </button>
              <span className="muted small">{fileSize(a.size)}</span>
              <code className="small" title={`SHA-256: ${a.sha256}`} aria-label={`SHA-256 ${a.sha256}`}>
                SHA-256 {a.sha256.slice(0, 12)}…
              </code>
              {onRecognized && OCR_TYPES.includes(a.mimeType) &&
                (ocr?.id === a.id ? (
                  <>
                    <span className="muted small" role="status" aria-live="polite">
                      {tf('ocrRunning', { p: ocr.percent })}
                    </span>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => job.current?.cancel()}>
                      {T.ocrCancel}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-ghost btn-xs" disabled={ocr !== null} title={T.ocrHint} aria-label={`${T.ocr}: ${a.filename}`} onClick={() => void recognize(a)}>
                    {T.ocr}
                  </button>
                ))}
              {editable && (
                <button type="button" className="btn btn-ghost btn-xs" aria-label={`${T.delete} ${a.filename}`} onClick={() => void remove(a)}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && files.length < 10 && (
        <>
          <input ref={input} type="file" hidden accept={FILE_TYPES.join(',')} aria-label={T.attachFile} onChange={(e) => void upload(e)} />
          <button type="button" className="btn btn-ghost btn-xs" disabled={busy} title={T.fileHint} onClick={() => input.current?.click()}>
            {busy ? T.saving : `+ ${T.attachFile}`}
          </button>
        </>
      )}
    </div>
  );
}
