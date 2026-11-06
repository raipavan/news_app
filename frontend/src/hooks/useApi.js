import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export function useApi(path, { enabled = true, deps = [], initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(Boolean(enabled && path));
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !path) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, version, ...deps]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, loading, error, reload, setData };
}

export function useDocumentTitle(title, { brand = true } = {}) {
  useEffect(() => {
    if (title) document.title = brand ? `${title} · Thaja Suddi` : title;
  }, [title, brand]);
}
