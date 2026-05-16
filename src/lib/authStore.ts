import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';
import { authApi, diaryApi, type AuthResponse } from './api';
import {
  clearEntries,
  mergeEntriesToUser,
  loadAnonymousEntries,
  clearAnonymousEntries,
  loadEntries,
  saveEntry,
  dateKeyToLocalIso,
  type JournalEntry,
} from './store';

function isoToDateKey(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd');
}

export interface AuthState {
  isAnonymous: boolean;
  userId?: string;
  token?: string;
  refreshToken?: string;
  deviceId: string;
  email?: string;
  entries: JournalEntry[];
}

export type SyncStatus = 'idle' | 'syncing' | 'failed' | 'unsynced' | 'saved';

export interface SyncState {
  hasUnsyncedData: boolean;
  lastSyncTime?: number;
  syncStatus: SyncStatus;
  showSyncPrompt: boolean;
}

interface AppStore extends AuthState, SyncState {
  setAuth: (auth: Partial<AuthState>) => void;
  setSync: (sync: Partial<SyncState>) => void;
  markUnsynced: () => void;
  markSynced: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string, acceptTerms: boolean) => Promise<void>;
  mockLogin: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  setEntries: (entries: JournalEntry[]) => void;
  loadUserEntries: () => Promise<void>;
  /** 已登入時將單條日記推送到後端（Redis 雲端依部署而定） */
  pushDiaryToServer: (entry: JournalEntry) => Promise<void>;
  syncAnonymousEntries: () => Promise<void>;
  dismissSyncPrompt: () => void;
}

const generateDeviceId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      isAnonymous: true,
      deviceId: generateDeviceId(),
      hasUnsyncedData: false,
      syncStatus: 'idle',
      entries: [],
      showSyncPrompt: false,
      
      setAuth: (auth) => set((state) => ({ ...state, ...auth })),
      setSync: (sync) => set((state) => ({ ...state, ...sync })),
      
      markUnsynced: () => {
          if (get().isAnonymous) {
              set({ hasUnsyncedData: true, syncStatus: 'unsynced' });
          } else {
              set({ hasUnsyncedData: true, syncStatus: 'syncing' });
              setTimeout(() => {
                  set({ hasUnsyncedData: false, syncStatus: 'saved', lastSyncTime: Date.now() });
              }, 1500);
          }
      },
      
      markSynced: () => set({ hasUnsyncedData: false, syncStatus: 'saved', lastSyncTime: Date.now() }),
      
      setEntries: (entries) => set({ entries }),
      
      loadUserEntries: async () => {
        const { isAnonymous, userId, token, deviceId } = get();
        if (!isAnonymous && userId) {
          try {
            if (token) {
              try {
                const response = await diaryApi.list(token, deviceId);
                const mappedEntries = response.list.map((entry) => ({
                  id: entry.id,
                  date: dateKeyToLocalIso(entry.dateKey),
                  content: entry.content,
                  emotions: entry.emotions || [],
                  version: entry.version ?? 1,
                }));
                set({ entries: mappedEntries });
              } catch (apiError) {
                // API不可用时回退到本地存储
                console.log('API不可用，使用本地存储:', apiError);
                set({ entries: loadEntries(userId) });
              }
            } else {
              set({ entries: loadEntries(userId) });
            }
          } catch (e) {
            console.error('Failed to load user entries:', e);
            set({ entries: loadEntries(userId) });
          }
        }
      },

      pushDiaryToServer: async (entry: JournalEntry) => {
        const { token, deviceId, userId, isAnonymous } = get();
        if (isAnonymous || !token || !deviceId || !userId) return;
        if (token.startsWith('mock_token_')) return;

        const dateKey = isoToDateKey(entry.date);
        const canPatch = entry.version != null && entry.version >= 1;

        try {
          const item = canPatch
            ? {
                id: entry.id,
                content: entry.content,
                dateKey,
                version: entry.version,
                emotions: entry.emotions,
              }
            : {
                content: entry.content,
                dateKey,
                emotions: entry.emotions,
                clientMutationId: entry.id,
              };

          const res = await diaryApi.sync(token, deviceId, [item]);
          const first = res.results?.[0];
          if (first?.status === 'ok' && first.entry) {
            const se = first.entry;
            const merged: JournalEntry = {
              id: se.id,
              date: dateKeyToLocalIso(se.dateKey),
              content: se.content,
              emotions: se.emotions || [],
              version: se.version,
            };
            saveEntry(merged, userId);
            set({ entries: loadEntries(userId) });
          } else if (first?.status === 'conflict') {
            await get().loadUserEntries();
          }
        } catch (e) {
          console.error('云端同步日记失败:', e);
        }
      },
      
      syncAnonymousEntries: async () => {
          const { userId, token, deviceId } = get();
          if (!userId) return;
          
          const anonymousEntries = loadAnonymousEntries();
          if (anonymousEntries.length === 0) {
              set({ showSyncPrompt: false });
              return;
          }
          
          try {
              if (token) {
                  const syncItems = anonymousEntries.map((entry: JournalEntry) => ({
                      content: entry.content,
                      emotions: entry.emotions,
                      dateKey: entry.date,
                      clientMutationId: entry.id
                  }));
                  await diaryApi.sync(token, deviceId, syncItems);
              }
              
              mergeEntriesToUser(anonymousEntries, userId);
              clearAnonymousEntries();
              
              await get().loadUserEntries();
              set({ showSyncPrompt: false });
          } catch (e) {
              console.error('Failed to sync entries:', e);
              mergeEntriesToUser(anonymousEntries, userId);
              clearAnonymousEntries();
              await get().loadUserEntries();
              set({ showSyncPrompt: false });
          }
      },
      
      dismissSyncPrompt: () => {
          set({ showSyncPrompt: false });
      },
      
      login: async (email: string, password: string) => {
          set({ syncStatus: 'syncing' });
          
          const anonymousEntries = loadAnonymousEntries();
          const hasAnonymousData = anonymousEntries.length > 0;
          
          try {
              const response: AuthResponse = await authApi.login({
                  email,
                  password,
                  deviceId: get().deviceId,
              });
              
              set({ 
                  isAnonymous: false, 
                  userId: response.user.id,
                  token: response.accessToken,
                  refreshToken: response.refreshToken,
                  email: response.user.email,
                  hasUnsyncedData: false,
                  syncStatus: 'saved',
                  lastSyncTime: Date.now(),
                  showSyncPrompt: hasAnonymousData
              });
              
              await get().loadUserEntries();
          } catch (e) {
              set({ syncStatus: 'idle' });
              throw e;
          }
      },
      
      register: async (email: string, password: string, passwordConfirm: string, acceptTerms: boolean) => {
          set({ syncStatus: 'syncing' });
          
          const anonymousEntries = loadAnonymousEntries();
          const hasAnonymousData = anonymousEntries.length > 0;
          
          try {
              const response: AuthResponse = await authApi.register({
                  email,
                  password,
                  passwordConfirm,
                  acceptTerms,
                  deviceId: get().deviceId,
              });
              
              set({ 
                  isAnonymous: false, 
                  userId: response.user.id,
                  token: response.accessToken,
                  refreshToken: response.refreshToken,
                  email: response.user.email,
                  hasUnsyncedData: false,
                  syncStatus: 'saved',
                  lastSyncTime: Date.now(),
                  showSyncPrompt: hasAnonymousData
              });
              
              await get().loadUserEntries();
          } catch (e) {
              set({ syncStatus: 'idle' });
              throw e;
          }
      },
      
      mockLogin: async (email: string) => {
          set({ syncStatus: 'syncing' });
          
          const anonymousEntries = loadAnonymousEntries();
          const hasAnonymousData = anonymousEntries.length > 0;
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const userId = 'user_' + generateDeviceId();
          
          set({ 
              isAnonymous: false, 
              userId: userId,
              token: 'mock_token_' + Date.now(),
              email: email,
              hasUnsyncedData: false,
              syncStatus: 'saved',
              lastSyncTime: Date.now(),
              showSyncPrompt: hasAnonymousData
          });
          
          await get().loadUserEntries();
      },
      
      logout: async () => {
          const { token, userId } = get();
          if (token) {
              try {
                  await authApi.logout(token);
              } catch (e) {
                  console.log('Logout API call failed, but clearing local state anyway');
              }
          }
          
          if (userId) {
              clearEntries(userId);
          }
          
          set({ 
              isAnonymous: true, 
              userId: undefined, 
              token: undefined, 
              refreshToken: undefined, 
              email: undefined, 
              hasUnsyncedData: false, 
              syncStatus: 'idle',
              entries: [],
              showSyncPrompt: false
          });
      }
    }),
    {
      name: 'whisper_auth_storage',
      partialize: (state) => ({ 
          isAnonymous: state.isAnonymous, 
          userId: state.userId, 
          token: state.token, 
          refreshToken: state.refreshToken,
          email: state.email,
          deviceId: state.deviceId,
          hasUnsyncedData: state.hasUnsyncedData
      }),
    }
  )
);
