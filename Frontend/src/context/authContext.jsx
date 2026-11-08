/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi } from "../services/authApi.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);

    try {
      const response = await authApi.getSession();
      const sessionUser = response?.user || null;

      if (!sessionUser?.id || !sessionUser?.role) {
        setUser(null);
        return null;
      }

      setUser(sessionUser);
      return sessionUser;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUser(null);
        return null;
      }

      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestOtp = useCallback((payload) => {
    return authApi.requestOtp(payload);
  }, []);

  const verifyOtp = useCallback(async (payload) => {
    const response = await authApi.verifyOtp(payload);
    const authenticatedUser = response?.user;

    if (!authenticatedUser?.id || !authenticatedUser?.role) {
      throw new Error(
        "The backend did not return a valid authenticated user.",
      );
    }

    setUser(authenticatedUser);

    return response;
  }, []);

  const login = verifyOtp;

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  // Initial bootstrap: the component starts in loading=true.
  // State updates occur only after the network request settles.
  useEffect(() => {
    let active = true;

    authApi
      .getSession()
      .then((response) => {
        if (!active) return;

        const sessionUser = response?.user || null;

        if (sessionUser?.id && sessionUser?.role) {
          setUser(sessionUser);
        } else {
          setUser(null);
        }
      })
      .catch((error) => {
        if (!active) return;

        setUser(null);

        if (error.status !== 401 && error.status !== 403) {
          console.error(
            "Unable to restore the authentication session:",
            error,
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      loading,
      login,
      requestOtp,
      verifyOtp,
      logout,
      refreshSession,
    }),
    [
      user,
      loading,
      login,
      requestOtp,
      verifyOtp,
      logout,
      refreshSession,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}