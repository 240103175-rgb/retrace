import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/types';

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload(): void;
}

/** Runs an async loader when `deps` change; ignores results of outdated calls. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const callId = useRef(0);

  useEffect(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (id === callId.current) setData(result);
      })
      .catch((err: unknown) => {
        if (id === callId.current) setError(err instanceof ApiError ? err : new ApiError('server_error', 0, String(err)));
      })
      .finally(() => {
        if (id === callId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

export function errorKey(err: unknown): string {
  return `err_${err instanceof ApiError ? err.code : 'server_error'}`;
}
