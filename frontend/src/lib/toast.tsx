import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'ok' | 'err';
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

const ToastContext = createContext<(kind: Kind, text: string) => void>(() => {});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((kind: Kind, text: string) => {
    const toast = { id: nextId++, kind, text };
    setToasts((list) => [...list, toast]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== toast.id)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'err' ? 'alert' : 'status'}>
              {t.text}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
