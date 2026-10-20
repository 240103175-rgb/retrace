// Small shared building blocks added in v1.1.
import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { T } from '../lib/text';

/** #74 page titles. */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} — Re:Trace` : 'Re:Trace';
  }, [title]);
}

/** #76 remaining characters under a field. */
export function CharCounter({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  return (
    // aria-hidden: keeps the field's accessible name clean; maxLength already limits input.
    <span className={`counter${left < max * 0.1 ? ' counter-low' : ''}`} aria-hidden="true">
      {T.charsLeft} {left}
    </span>
  );
}

/** #73 in-app confirmation dialog. */
interface ConfirmOptions {
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}
type Confirm = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<Confirm>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve(v: boolean): void }) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirm = useCallback<Confirm>((o) => new Promise((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  useEffect(() => {
    if (!state) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-backdrop" onClick={() => close(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="modal-title">{state.title}</h2>
            {state.text && <p className="muted">{state.text}</p>}
            <div className="row-end">
              <button type="button" ref={cancelRef} className="btn btn-ghost" onClick={() => close(false)}>
                {state.cancelLabel ?? T.cancel}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => close(true)}>
                {state.confirmLabel ?? T.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

/** #79 warn before closing the tab while a form has unsaved input. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}

/** Asks before discarding a dirty form; resolves true when it is fine to close. */
export function useDiscardGuard() {
  const confirm = useConfirm();
  return (dirty: boolean) =>
    dirty ? confirm({ title: T.discardTitle, text: T.discardText, confirmLabel: T.discard, cancelLabel: T.keepEditing }) : Promise.resolve(true);
}

/** Saves a downloaded blob under its file name (#64). */
export function saveDownload({ filename, blob }: { filename: string; blob: Blob }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** #83 recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Re:Trace crashed:', error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="panel center crash" role="alert">
        <h1>{T.crashTitle}</h1>
        <p className="muted">{T.crashText}</p>
        <div className="row-center">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {T.reload}
          </button>
          <a className="btn btn-ghost" href="/cases">
            {T.toCases}
          </a>
        </div>
      </section>
    );
  }
}
