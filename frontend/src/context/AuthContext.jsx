import { createContext, useCallback, useContext, useEffect, useState } from "react";

import * as authApi from "../api/auth";
import { getToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Starts true so ProtectedRoute waits for the token check instead of bouncing
  // a logged-in user to /login on every hard refresh.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        // A rejected token is already cleared by the 401 interceptor; nothing
        // more to do than fall through to the logged-out state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    await authApi.login(email, password);
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const signOut = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
