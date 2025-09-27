import { app, BrowserWindow, ipcMain, shell, screen, Menu, MenuItemConstructorOptions, WebContents, clipboard } from 'electron';
import type { ContextMenuParams } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import { JsonStore } from './preferencesStore';

export type WindowMode = 'windowed' | 'borderless' | 'fullscreen';

export interface Preferences {
  windowMode: WindowMode;
  collapseChat: boolean;
  collapseSidebar: boolean;
  username?: string;
  password?: string;
}

export interface CredentialsPayload {
  username: string;
  password: string;
}

const GAME_URL = 'https://angband.live/';
const DATA_FILENAME = 'AnGUI-data.json';

const defaultPreferences: Preferences = {
  windowMode: 'windowed',
  collapseChat: false,
  collapseSidebar: false,
  username: '',
  password: ''
};

const getPortableRoot = () => {
  if (!app.isPackaged) {
    return app.getPath('userData');
  }
  return path.dirname(app.getPath('exe'));
};

const getDataFilePath = () => path.join(getPortableRoot(), DATA_FILENAME);

const deriveEncryptionKey = () => {
  const seed = `${os.userInfo().username}|${app.getPath('exe')}`;
  return crypto.createHash('sha256').update(seed).digest();
};

const encryptValue = (value: string): string => {
  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptValue = (payload?: string | null): string => {
  if (!payload) return '';
  try {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    if (!ivB64 || !tagB64 || !dataB64) return '';
    const key = deriveEncryptionKey();
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.warn('[AnGUI] Failed to decrypt stored value.', error);
    return '';
  }
};

const attachedContextMenus = new WeakSet<WebContents>();

const buildContextMenuTemplate = (contents: WebContents, params: ContextMenuParams): MenuItemConstructorOptions[] => {
  const canSelectAll = params.editFlags.canSelectAll ?? false;
  const items: MenuItemConstructorOptions[] = [
    {
      label: 'Refresh',
      accelerator: 'Ctrl+R',
      click: () => contents.reload()
    },
    { type: 'separator' },
    {
      label: 'Copy',
      enabled: params.editFlags.canCopy || Boolean(params.selectionText),
      click: () => contents.copy()
    },
    {
      label: 'Paste',
      enabled: params.editFlags.canPaste,
      click: () => contents.paste()
    },
    {
      label: 'Select All',
      enabled: canSelectAll,
      click: () => contents.selectAll()
    }
  ];

  if (params.linkURL) {
    items.splice(2, 0, {
      label: 'Copy Link Address',
      click: () => clipboard.writeText(params.linkURL)
    });
  }

  items.push({ type: 'separator' });
  items.push({
    label: 'Inspect Element',
    click: () => contents.inspectElement(Math.floor(params.x), Math.floor(params.y))
  });

  return items;
};

const attachContextMenu = (contents: WebContents) => {
  if (attachedContextMenus.has(contents)) {
    return;
  }
  contents.on('context-menu', (event, params) => {
    event.preventDefault();
    const menu = Menu.buildFromTemplate(buildContextMenuTemplate(contents, params));
    menu.popup({ window: BrowserWindow.fromWebContents(contents) ?? undefined });
  });
  attachedContextMenus.add(contents);
};

let preferencesStore: JsonStore<Preferences> | null = null;
let mainWindow: BrowserWindow | null = null;

const resolvePath = (...segments: string[]) => path.join(__dirname, '..', ...segments);

const getPreferences = (): Preferences => {
  return preferencesStore ? preferencesStore.getAll() : { ...defaultPreferences };
};

const updatePreferences = async (update: Partial<Preferences>): Promise<Preferences> => {
  if (!preferencesStore) {
    throw new Error('Preferences store not initialised');
  }
  await preferencesStore.update(update);
  return preferencesStore.getAll();
};

const applyWindowMode = (mode: WindowMode) => {
  if (!mainWindow) return;

  switch (mode) {
    case 'fullscreen': {
      mainWindow.setFullScreenable(true);
      mainWindow.setResizable(true);
      mainWindow.setFullScreen(true);
      break;
    }
    case 'borderless': {
      mainWindow.setFullScreen(false);
      mainWindow.setFullScreenable(false);
      mainWindow.setResizable(false);
      mainWindow.setMenuBarVisibility(false);
      const { workArea } = screen.getPrimaryDisplay();
      mainWindow.setBounds(workArea);
      break;
    }
    default: {
      mainWindow.setFullScreen(false);
      mainWindow.setFullScreenable(true);
      mainWindow.setResizable(true);
      if (!mainWindow.isDestroyed()) {
        const workArea = screen.getPrimaryDisplay().workArea;
        const targetWidth = Math.min(1280, workArea.width);
        const targetHeight = Math.min(720, workArea.height);
        mainWindow.setSize(targetWidth, targetHeight);
        mainWindow.center();
      }
      break;
    }
  }
  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send('window:resized');
  }
};

const broadcastPreferences = () => {
  if (!mainWindow) return;
  const { password: _password, ...rest } = getPreferences();
  mainWindow.webContents.send('preferences:changed', rest);
};

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: resolvePath('preload', 'rendererPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      webviewTag: true
    }
  });

  attachContextMenu(mainWindow.webContents);

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
    applyWindowMode(getPreferences().windowMode);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastPreferences();
  });

  mainWindow.loadFile(resolvePath('renderer', 'index.html'));
};

const getStoredCredentials = async (): Promise<CredentialsPayload | null> => {
  const prefs = getPreferences();
  const username = prefs.username ?? '';
  const password = decryptValue(prefs.password);
  if (!username && !password) {
    return null;
  }
  return {
    username,
    password
  };
};

const setStoredCredentials = async (payload: CredentialsPayload) => {
  const encrypted = payload.password ? encryptValue(payload.password) : '';
  await updatePreferences({ username: payload.username, password: encrypted });
};

const clearStoredCredentials = async () => {
  await updatePreferences({ username: '', password: '' });
};

const registerIpcHandlers = () => {
  ipcMain.handle('preferences:get', () => {
    const { password: _password, ...rest } = getPreferences();
    return rest;
  });

  ipcMain.handle('preferences:set', async (_event, updated: Partial<Preferences>) => {
    const merged = await updatePreferences(updated);
    applyWindowMode(merged.windowMode);
    broadcastPreferences();
    mainWindow?.webContents.send('window:resized');
    const { password: _password, ...rest } = merged;
    return rest;
  });

  ipcMain.handle('credentials:get', async () => {
    return getStoredCredentials();
  });

  ipcMain.handle('credentials:set', async (_event, payload: CredentialsPayload) => {
    await setStoredCredentials(payload);
    return getStoredCredentials();
  });

  ipcMain.handle('credentials:clear', async () => {
    await clearStoredCredentials();
    return getStoredCredentials();
  });

  ipcMain.handle('paths:get', () => {
    return {
      gamePreload: resolvePath('preload', 'gamePreload.js')
    };
  });

  ipcMain.on('open-external', (_event, url: string) => {
    if (!url) return;
    shell.openExternal(url);
  });

  ipcMain.on('settings:toggle', () => {
    if (!mainWindow) return;
    mainWindow.webContents.send('settings:toggle');
  });
};

app.setName('AnGUI');

app.whenReady().then(async () => {
  app.setPath('userData', getPortableRoot());

  const dataFile = getDataFilePath();
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  preferencesStore = new JsonStore<Preferences>(dataFile, defaultPreferences);
  await preferencesStore.load();

  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (_event, contents) => {
  attachContextMenu(contents);

  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(GAME_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

