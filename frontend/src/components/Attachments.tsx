// #25 files attached to one piece of evidence: list, upload with a SHA-256 checksum, download, delete.
import { useRef, useState, type ChangeEvent } from 'react';
import { T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey } from '../lib/useAsync';
import { useApi } from '../services/ApiContext';
import type { Attachment, FileType } from '../services/types';
import { saveDownload, useConfirm } from './kit';

export const FILE_TYPES: FileType[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'];
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const fileSize = (n: number) => (n < 1024 ? `${n} Б` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} КБ` : `${(n / 1024 / 1024).toFixed(2)} МБ`);

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
}

export function Attachments({ caseId, evidenceId, files, editable, onChanged }: Props) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

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
