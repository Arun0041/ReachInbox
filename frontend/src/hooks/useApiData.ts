import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';

interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (fn: (prev: T | null) => T) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiDataState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => setDataState(result))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  const setData = useCallback((fn: (prev: T | null) => T) => {
    setDataState((prev) => fn(prev));
  }, []);

  return { data, loading, error, reload: load, setData };
}