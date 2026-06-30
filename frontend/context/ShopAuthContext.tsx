/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ShopUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  isActive?: boolean;
  client?: {
    id: string;
    nombre?: string;
    apellido?: string;
    dni?: string;
    telefono?: string | null;
    gmail?: string | null;
    category?: string;
    currentBalance?: number;
    creditLimit?: number | null;
    isAccountEnabled?: boolean;
  } | null;
};

type LoginInput = {
  email: string;
  password: string;
};

type ShopAuthContextValue = {
  user: ShopUser | null;
  client: ShopUser["client"] | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (data: LoginInput) => Promise<ShopUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<ShopUser | null>;
};

const ShopAuthContext = createContext<ShopAuthContextValue | null>(null);

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

function getApiMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string;
          error?: string;
        }
      | undefined;

    return data?.message || data?.error || fallback;
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
}

function extractUser(data: any): ShopUser | null {
  return data?.content?.user ?? data?.content ?? data?.user ?? null;
}

function clearClientCookies() {
  if (typeof document === "undefined") return;

  document.cookie = "user=; Max-Age=0; path=/";
  document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

export function ShopAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ShopUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutInProgress, setLogoutInProgress] = useState(false);

  const refreshUser = useCallback(async () => {
    if (logoutInProgress) {
      setUser(null);
      return null;
    }

    try {
      const res = await api.get("/auth/me");

      const currentUser = extractUser(res.data);

      if (!currentUser?.id) {
        setUser(null);
        return null;
      }

      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  }, [logoutInProgress]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await api.get("/auth/me");

        if (!mounted) return;

        const currentUser = extractUser(res.data);

        if (currentUser?.id) {
          setUser(currentUser);
        } else {
          setUser(null);
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    try {
      setLogoutInProgress(false);

      const res = await api.post("/auth/login", {
        email: input.email,
        password: input.password,
      });

      const loggedUser = extractUser(res.data);

      if (!loggedUser?.id) {
        throw new Error("El login fue correcto, pero no se pudo leer el usuario");
      }

      setUser(loggedUser);

      return loggedUser;
    } catch (error) {
      throw new Error(getApiMessage(error, "No se pudo iniciar sesión"));
    }
  }, []);

  const logout = useCallback(async () => {
    setLogoutInProgress(true);
    setUser(null);
    clearClientCookies();

    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    } finally {
      setUser(null);
      clearClientCookies();

      setTimeout(() => {
        setLogoutInProgress(false);
      }, 700);
    }
  }, []);

  const value = useMemo<ShopAuthContextValue>(
    () => ({
      user,
      client: user?.client ?? null,
      isLoggedIn: Boolean(user?.id) && !logoutInProgress,
      loading,
      login,
      logout,
      refreshUser,
    }),
    [user, loading, login, logout, refreshUser, logoutInProgress]
  );

  return (
    <ShopAuthContext.Provider value={value}>
      {children}
    </ShopAuthContext.Provider>
  );
}

export function useShopAuth() {
  const ctx = useContext(ShopAuthContext);

  if (!ctx) {
    throw new Error("useShopAuth debe usarse dentro de ShopAuthProvider");
  }

  return ctx;
}