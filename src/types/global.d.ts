import type { Preferences, CredentialsPayload } from '../main/main';
type PreferencesListener = (preferences: Preferences) => void;
type VoidCallback = () => void;

declare global {
  interface Window {
    angui: {
      getPreferences: () => Promise<Preferences>;
      setPreferences: (update: Partial<Preferences>) => Promise<Preferences>;
      onPreferencesChanged: (callback: PreferencesListener) => VoidCallback;
      requestToggleSettings: () => void;
      onToggleSettings: (callback: VoidCallback) => VoidCallback;
      getCredentials: () => Promise<CredentialsPayload | null>;
      setCredentials: (payload: CredentialsPayload) => Promise<CredentialsPayload | null>;
      clearCredentials: () => Promise<CredentialsPayload | null>;
      getPaths: () => Promise<{ gamePreload: string }>;
      openExternal: (url: string) => void;
    };
  }
}

export {};
