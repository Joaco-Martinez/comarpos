'use client';
import { create } from 'zustand';
import { User } from '@/types';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  me: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (u) => set({ user: u }),
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const user = data.content ?? data;
    set({ user });
    return user;
  },
  logout: async () => {
    await api.post('/auth/logout').catch(() => {});
    set({ user: null });
    window.location.href = '/login';
  },
  me: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.content ?? data, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
