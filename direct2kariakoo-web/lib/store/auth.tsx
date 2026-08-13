"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { TOKEN_KEY, USER_KEY, setToken } from "../api";
import type { AuthUser } from "../types";

/**
 * Authentication state.
 *
 * The storefront is fully browsable signed-out, so this provider never gates
 * rendering. Pages that genuinely need an identity (checkout, orders) call
 * `requireAuth()`, which opens the login sheet and resolves once the visitor
 * has signed in — the reference marketplace asks for credentials at the
 * checkout step, not at the door.
 */

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  isAuthenticated: boolean;
  isVendor: boolean;
  login(identifier: string, password: string): Promise<AuthUser>;
  register(payload: RegisterPayload | FormData): Promise<AuthUser>;
  /** Creates the account without signing in — used by the customer sheet. */
  signUp(payload: RegisterPayload): Promise<void>;
  logout(): void;
  /** Opens the auth sheet if needed; resolves true once authenticated. */
  requireAuth(): Promise<boolean>;
  authPromptOpen: boolean;
  openAuthPrompt(): void;
  closeAuthPrompt(): void;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  role?: "user" | "vendor";
  business_name?: string;
  /** Required by the backend for seller applications. */
  nida_number?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);

  // Restore the session from storage, then confirm it is still valid.
  useEffect(() => {
    const cached = window.localStorage.getItem(USER_KEY);
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        window.localStorage.removeItem(USER_KEY);
      }
    }

    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setReady(true);
      return;
    }

    api
      .get("/me")
      .then(({ data }) => {
        const fresh = normalise(data);
        setUser(fresh);
        window.localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      })
      .catch(() => {
        setToken(null);
        window.localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  // The axios interceptor fires this when a token turns out to be stale.
  useEffect(() => {
    const onUnauthenticated = () => setUser(null);
    window.addEventListener("d2k:unauthenticated", onUnauthenticated);
    return () => window.removeEventListener("d2k:unauthenticated", onUnauthenticated);
  }, []);

  const persist = useCallback((token: string, account: AuthUser) => {
    setToken(token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(account));
    setUser(account);
    window.dispatchEvent(new CustomEvent("d2k:authenticated"));
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { data } = await api.post("/login", { email: identifier, password });
      const account = normalise(data.user ?? data);
      persist(data.token ?? data.access_token, account);
      return account;
    },
    [persist]
  );

  const register = useCallback(
    async (payload: RegisterPayload | FormData) => {
      // A seller application carries file uploads, so it must go as multipart.
      // Passing `undefined` lets the browser set the boundary; forcing the
      // instance's JSON content-type would corrupt the body.
      const isUpload = typeof FormData !== "undefined" && payload instanceof FormData;
      const { data } = await api.post("/register", payload, {
        headers: { "Content-Type": isUpload ? undefined : "application/json" },
      });
      const account = normalise(data.user ?? data);
      persist(data.token ?? data.access_token, account);
      return account;
    },
    [persist]
  );

  /**
   * End the session and return to the public marketplace.
   *
   * Both shoppers and sellers land on the storefront rather than a login
   * screen — signing out is not a reason to be locked out of browsing, and a
   * seller leaving their dashboard still wants to see the shop.
   */
  const logout = useCallback(() => {
    // Best-effort server-side revocation; the local session goes either way.
    api.post("/logout").catch(() => undefined);
    setToken(null);
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
    setAuthPromptOpen(false);
    window.dispatchEvent(new CustomEvent("d2k:signed-out"));

    // A full navigation, not a client push: it guarantees no seller-scoped
    // data survives in memory on the way out.
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  }, []);

  /**
   * Create a customer account without persisting the session.
   *
   * The sheet then switches to its login step with the email filled in, which
   * is the flow the storefront asks for: registering proves the account
   * exists, signing in is a separate, deliberate action.
   */
  const signUp = useCallback(async (payload: RegisterPayload) => {
    await api.post("/register", payload);
  }, []);

  const requireAuth = useCallback(() => {
    if (user) return Promise.resolve(true);

    setAuthPromptOpen(true);
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  }, [user]);

  // Close the sheet as soon as a session appears, and resolve any pending
  // requireAuth() alongside it. These used to be one condition, so signing in
  // from the header — where nothing is awaiting a resolver — left the modal
  // sitting open on top of the page the shopper had just authenticated for.
  useEffect(() => {
    if (!user) return;

    setAuthPromptOpen(false);

    if (resolver) {
      resolver(true);
      setResolver(null);
    }
  }, [user, resolver]);

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptOpen(false);
    if (resolver) {
      resolver(false);
      setResolver(null);
    }
  }, [resolver]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      isVendor: user?.role === "vendor",
      login,
      register,
      signUp,
      logout,
      requireAuth,
      authPromptOpen,
      openAuthPrompt: () => setAuthPromptOpen(true),
      closeAuthPrompt,
    }),
    [user, ready, login, register, signUp, logout, requireAuth, authPromptOpen, closeAuthPrompt]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** The API returns the account in a few historic shapes; flatten them. */
function normalise(raw: Record<string, unknown>): AuthUser {
  const source = (raw.user as Record<string, unknown>) ?? raw;
  const vendor = source.vendor as Record<string, unknown> | null | undefined;

  return {
    id: Number(source.id),
    name: String(source.name ?? ""),
    email: String(source.email ?? ""),
    phone: (source.phone as string) ?? null,
    role: (source.role as AuthUser["role"]) ?? "user",
    vendor: vendor
      ? {
          id: Number(vendor.id),
          business_name: String(vendor.business_name ?? ""),
          is_approved: Boolean(vendor.is_approved),
          logo: (vendor.logo as string) ?? null,
        }
      : null,
  };
}
