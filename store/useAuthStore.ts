"use client";

import { create } from "zustand";

import { authApi, getRuntimeMode } from "@/lib/api";
import type { AppUser, RuntimeMode } from "@/types";

interface AuthState {
  user: AppUser | null;
  is_loading: boolean;
  initialized: boolean;
  error: string | null;
  runtime_mode: RuntimeMode;
  initialize: () => Promise<void>;
  sign_in: (email: string, password: string) => Promise<boolean>;
  sign_in_with_google: () => Promise<boolean>;
  enter_demo: () => Promise<boolean>;
  sign_out: () => Promise<void>;
  clear_error: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  is_loading: true,
  initialized: false,
  error: null,
  runtime_mode: getRuntimeMode(),

  initialize: async () => {
    set({ is_loading: true, runtime_mode: getRuntimeMode() });
    const response = await authApi.getCurrentUser();

    set({
      user: response.data ?? null,
      is_loading: false,
      initialized: true,
      error: response.error?.message ?? null,
    });
  },

  sign_in: async (email, password) => {
    set({ is_loading: true, error: null });
    const response = await authApi.signIn(email, password);

    if (response.data) {
      set({
        user: response.data,
        is_loading: false,
        initialized: true,
      });
      return true;
    }

    set({
      is_loading: false,
      error: response.error?.message ?? "로그인에 실패했습니다.",
    });
    return false;
  },

  sign_in_with_google: async () => {
    set({ is_loading: true, error: null });
    const response = await authApi.signInWithGoogle();

    if (response.data) {
      set({
        user: response.data,
        is_loading: false,
        initialized: true,
      });
      return true;
    }

    if (!response.error) {
      set({
        is_loading: false,
        initialized: true,
      });
      return true;
    }

    set({
      is_loading: false,
      error: response.error?.message ?? "Google 로그인에 실패했습니다.",
    });
    return false;
  },

  enter_demo: async () => {
    set({ is_loading: true, error: null });
    const response = await authApi.enterDemo();

    if (response.data) {
      set({
        user: response.data,
        is_loading: false,
        initialized: true,
      });
      return true;
    }

    set({
      is_loading: false,
      error: response.error?.message ?? "데모 세션을 시작하지 못했습니다.",
    });
    return false;
  },

  sign_out: async () => {
    set({ is_loading: true, error: null });
    await authApi.signOut();
    set({
      user: null,
      is_loading: false,
      initialized: true,
    });
  },

  clear_error: () => set({ error: null }),
}));
