import { contextBridge, ipcRenderer } from 'electron';
import type { CredentialsPayload, Preferences } from '../main/main';

export interface LayoutPreferences {
  collapseChat: boolean;
  collapseSidebar: boolean;
}

type PreferencesListener = (preferences: Preferences) => void;
type VoidCallback = () => void;

const api = {
  getPreferences: (): Promise<Preferences> => ipcRenderer.invoke('preferences:get'),
  setPreferences: (update: Partial<Preferences>): Promise<Preferences> => ipcRenderer.invoke('preferences:set', update),
  onPreferencesChanged: (callback: PreferencesListener): VoidCallback => {
    const channel = 'preferences:changed';
    const listener = (_event: Electron.IpcRendererEvent, payload: Preferences) => callback(payload);
    ipcRenderer.on(channel, listener);
    const disposer = () => ipcRenderer.removeListener(channel, listener);
    return disposer;
  },
  requestToggleSettings: () => ipcRenderer.send('settings:toggle'),
  onToggleSettings: (callback: VoidCallback): VoidCallback => {
    const channel = 'settings:toggle';
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    const disposer = () => ipcRenderer.removeListener(channel, listener);
    return disposer;
  },
  getCredentials: (): Promise<CredentialsPayload | null> => ipcRenderer.invoke('credentials:get'),
  setCredentials: (payload: CredentialsPayload): Promise<CredentialsPayload | null> => ipcRenderer.invoke('credentials:set', payload),
  clearCredentials: (): Promise<CredentialsPayload | null> => ipcRenderer.invoke('credentials:clear'),
  getPaths: (): Promise<{ gamePreload: string }> => ipcRenderer.invoke('paths:get'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url)
};

contextBridge.exposeInMainWorld('angui', api);

