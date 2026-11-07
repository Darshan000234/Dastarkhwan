import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { mockOutletManagerApi } from "../services/mockOutletManagerApi";

const ManagerContext = createContext(null);

export function ManagerProvider({ children }) {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const next = await mockOutletManagerApi.getWorkspace();
      setWorkspace(next);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load manager workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const update = () => {
      if (alive) setRevision((value) => value + 1);
    };
    const unsubscribe = mockOutletManagerApi.subscribe(update);
    refresh();
    const poll = window.setInterval(() => {
      if (alive) refresh();
    }, 15000);
    return () => {
      alive = false;
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    if (revision) refresh();
  }, [revision, refresh]);

  const run = useCallback(
    async (action) => {
      const result = await action();
      await refresh();
      return result;
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      ...workspace,
      loading,
      error,
      refresh,
      run,
      manager: workspace?.outlet?.manager || null,
      outlet: workspace?.outlet || null,
      orders: workspace?.orders || [],
      menu: workspace?.menu || [],
      overview: workspace?.overview || null,
    }),
    [workspace, loading, error, refresh, run],
  );

  return (
    <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>
  );
}

export function useManager() {
  const context = useContext(ManagerContext);
  if (!context)
    throw new Error("useManager must be used inside ManagerProvider.");
  return context;
}
