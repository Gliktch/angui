type WindowMode = 'windowed' | 'borderless' | 'fullscreen';

type Preferences = {
  windowMode: WindowMode;
  collapseChat: boolean;
  collapseSidebar: boolean;
  username?: string;
};

type LayoutPreferences = {
  collapseChat: boolean;
  collapseSidebar: boolean;
};

const GAME_URL = 'https://angband.live/play';
const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.6;

type CredentialsState = {
  username: string;
  password: string;
};

type AppState = {
  preferences: Preferences | null;
  credentials: CredentialsState | null;
  settingsVisible: boolean;
};

const state: AppState = {
  preferences: null,
  credentials: null,
  settingsVisible: false
};

let webviewElement: Electron.WebviewTag | null = null;
let zoomUpdateHandle: number | null = null;
let currentZoomFactor = 1;
let settingsPanel: HTMLElement | null = null;
let startupOverlay: HTMLElement | null = null;
let startupOverlayTimer: number | null = null;
let startupOverlayDismissed = false;

let statusLabel: HTMLSpanElement | null = null;
let windowModeInputs: NodeListOf<HTMLInputElement>;
let collapseChatCheckbox: HTMLInputElement | null = null;
let collapseSidebarCheckbox: HTMLInputElement | null = null;
let usernameInput: HTMLInputElement | null = null;
let passwordInput: HTMLInputElement | null = null;
let cursorHideTimer: number | null = null;
let credentialsPushInterval: number | null = null;
let credentialsPushAttempts = 0;
const MAX_CREDENTIAL_PUSH_ATTEMPTS = 10;
const CURSOR_HIDE_DELAY = 2000;


const setStatus = (message: string) => {
  if (!statusLabel) return;
  statusLabel.textContent = message;
  if (message) {
    statusLabel.dataset.visible = 'true';
    setTimeout(() => {
      if (statusLabel) {
        statusLabel.textContent = '';
        delete statusLabel.dataset.visible;
      }
    }, 4000);
  }
};

const applySettingsVisibility = () => {
  if (!settingsPanel) return;
  if (state.settingsVisible) {
    settingsPanel.dataset.visible = 'true';
  } else {
    delete settingsPanel.dataset.visible;
  }
};

const setSettingsVisible = (visible: boolean) => {
  state.settingsVisible = visible;
  applySettingsVisibility();
  if (visible && settingsPanel) {
    settingsPanel.focus();
  }
};

const scheduleZoomUpdate = () => {
  if (!webviewElement) return;
  if (zoomUpdateHandle !== null) {
    return;
  }
  zoomUpdateHandle = window.requestAnimationFrame(() => {
    zoomUpdateHandle = null;
    applyZoomForWindowSize();
  });
};

const stopCredentialPush = () => {
  if (credentialsPushInterval !== null) {
    window.clearInterval(credentialsPushInterval);
    credentialsPushInterval = null;
  }
  credentialsPushAttempts = 0;
};

const attemptCredentialPush = () => {
  if (!state.credentials) {
    return;
  }
  sendCredentialsToWebview(state.credentials);
  credentialsPushAttempts += 1;
  if (credentialsPushAttempts >= MAX_CREDENTIAL_PUSH_ATTEMPTS) {
    stopCredentialPush();
  }
};

const scheduleCredentialPush = () => {
  if (!state.credentials) {
    return;
  }
  if (!state.credentials.username && !state.credentials.password) {
    return;
  }
  stopCredentialPush();
  credentialsPushAttempts = 0;
  attemptCredentialPush();
  credentialsPushInterval = window.setInterval(() => {
    attemptCredentialPush();
  }, 1200);
};

const showCursor = () => {
  if (document.body.dataset.cursorHidden === 'true') {
    delete document.body.dataset.cursorHidden;
  }
};

const scheduleCursorHide = () => {
  if (cursorHideTimer !== null) {
    window.clearTimeout(cursorHideTimer);
  }
  cursorHideTimer = window.setTimeout(() => {
    document.body.dataset.cursorHidden = 'true';
  }, CURSOR_HIDE_DELAY);
};

const handleMouseMove = () => {
  showCursor();
  scheduleCursorHide();
};

const applyZoomForWindowSize = () => {
  if (!webviewElement) return;
  const widthRatio = window.innerWidth / BASE_WIDTH;
  const heightRatio = window.innerHeight / BASE_HEIGHT;
  const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(widthRatio, heightRatio)));
  if (Math.abs(targetZoom - currentZoomFactor) < 0.02) {
    return;
  }
  currentZoomFactor = targetZoom;
  webviewElement.setZoomFactor(currentZoomFactor);
};

const sendCredentialsToWebview = (creds: CredentialsState | null) => {
  if (!webviewElement || !creds) {
    return;
  }
  webviewElement.send('credentials:apply', creds);
};

const requestToggleSettings = () => {
  window.angui.requestToggleSettings();
};

const updatePreferencesState = (preferences: Preferences) => {
  state.preferences = preferences;
  refreshPreferenceControls();
  pushLayoutToWebview(preferences);
};

const refreshPreferenceControls = () => {
  const preferences = state.preferences;
  if (!preferences) return;

  windowModeInputs?.forEach((input) => {
    input.checked = input.value === preferences.windowMode;
  });

  if (collapseChatCheckbox) {
    collapseChatCheckbox.checked = preferences.collapseChat;
  }

  if (collapseSidebarCheckbox) {
    collapseSidebarCheckbox.checked = preferences.collapseSidebar;
  }
};

const refreshCredentialControls = () => {
  if (!state.credentials) return;
  if (usernameInput) usernameInput.value = state.credentials.username;
  if (passwordInput) passwordInput.value = state.credentials.password;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const DEFAULT_FONT_SIZE = 14;

const adjustFontSize = (element: HTMLElement, delta: number) => {
  const current = window.getComputedStyle(element).fontSize;
  const numeric = parseFloat(current) || DEFAULT_FONT_SIZE;
  const next = clamp(numeric + delta, 8, 42);
  element.style.fontSize = `${next}px`;
};

const handleWheelZoom = (event: WheelEvent) => {
  if (!event.ctrlKey || !event.shiftKey) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const delta = event.deltaY < 0 ? 1 : -1;
  let target = event.target as HTMLElement | null;
  while (target && target instanceof HTMLElement) {
    if (target.hasAttribute('data-zoom-root') || target.id === 'settings-panel' || target.closest('#settings-panel')) {
      adjustFontSize(target as HTMLElement, delta);
      return;
    }
    target = target.parentElement;
  }
  if (webviewElement) {
    const zoomDelta = event.deltaY < 0 ? 0.05 : -0.05;
    const nextZoom = clamp(currentZoomFactor + zoomDelta, MIN_ZOOM, MAX_ZOOM);
    currentZoomFactor = nextZoom;
    webviewElement.setZoomFactor(currentZoomFactor);
  }
};

const pushLayoutToWebview = (preferences: Preferences) => {
  if (!webviewElement) return;
  const layout: LayoutPreferences = {
    collapseChat: preferences.collapseChat,
    collapseSidebar: preferences.collapseSidebar
  };
  webviewElement.send('layout:update', layout);
  scheduleZoomUpdate();
};

const requestCredentialsFromHost = async () => {
  const creds = await window.angui.getCredentials();
  if (!creds) {
    return;
  }
  state.credentials = creds;
  refreshCredentialControls();
  scheduleCredentialPush();
};

const buildSettingsPanel = () => {
  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.setAttribute('tabindex', '-1');
  panel.innerHTML = `
    <div class="settings-header">
      <h1>AnGUI Settings</h1>
      <button id="close-settings" title="Close settings">×</button>
    </div>
    <section>
      <h2>Window Mode</h2>
      <div class="field-group" id="window-mode-group">
        <label><input type="radio" name="windowMode" value="windowed"> Windowed</label>
        <label><input type="radio" name="windowMode" value="borderless"> Borderless Fullscreen</label>
        <label><input type="radio" name="windowMode" value="fullscreen"> Fullscreen</label>
      </div>
    </section>
    <section>
      <h2>Layout</h2>
      <label class="field"><input type="checkbox" id="collapse-chat"> Collapse chat</label>
      <label class="field"><input type="checkbox" id="collapse-sidebar"> Collapse sidebar</label>
    </section>
    <section>
      <h2>Angband.live Login</h2>
      <div class="field">
        <label for="login-username">Username</label>
        <input id="login-username" name="login-username" type="text" autocomplete="username">
      </div>
      <div class="field">
        <label for="login-password">Password</label>
        <input id="login-password" name="login-password" type="password" autocomplete="current-password">
      </div>
      <div class="button-row">
        <button id="save-credentials">Save Login</button>
        <button id="clear-credentials" class="secondary">Forget Login</button>
      </div>
    </section>
    <section>
      <br/>
      <h2>About</h2>
      <p>Wrapper for angband.live by gliktch. Designed for minimal distractions & maximum efficiency.</p>
      <p class="placeholder">Update check not yet implemented.</p>
    </section>
    <footer>
      <span id="status"></span>
      <small>Press Ctrl + Shift + A to close settings.</small>
    </footer>
  `;
  document.body.appendChild(panel);
  settingsPanel = panel;

  const closeButton = panel.querySelector<HTMLButtonElement>('#close-settings');
  closeButton?.addEventListener('click', () => requestToggleSettings());

  windowModeInputs = panel.querySelectorAll<HTMLInputElement>('input[name="windowMode"]');
  collapseChatCheckbox = panel.querySelector<HTMLInputElement>('#collapse-chat');
  collapseSidebarCheckbox = panel.querySelector<HTMLInputElement>('#collapse-sidebar');
  usernameInput = panel.querySelector<HTMLInputElement>('#login-username');
  passwordInput = panel.querySelector<HTMLInputElement>('#login-password');
  statusLabel = panel.querySelector<HTMLSpanElement>('#status');

  windowModeInputs.forEach((input) => {
    input.addEventListener('change', async (event) => {
      const target = event.target as HTMLInputElement;
      if (!target.checked) return;
      await window.angui.setPreferences({ windowMode: target.value as Preferences['windowMode'] });
    });
  });

  collapseChatCheckbox?.addEventListener('change', async () => {
    if (!collapseChatCheckbox) return;
    await window.angui.setPreferences({ collapseChat: collapseChatCheckbox.checked });
  });

  collapseSidebarCheckbox?.addEventListener('change', async () => {
    if (!collapseSidebarCheckbox) return;
    await window.angui.setPreferences({ collapseSidebar: collapseSidebarCheckbox.checked });
  });

  panel.querySelector<HTMLButtonElement>('#save-credentials')?.addEventListener('click', async () => {
    if (!usernameInput || !passwordInput) return;
    const payload = {
      username: usernameInput.value.trim(),
      password: passwordInput.value
    };
    const stored = await window.angui.setCredentials(payload);
    state.credentials = stored ?? payload;
    refreshCredentialControls();
    scheduleCredentialPush();
    setStatus('Login saved securely.');
  });

  panel.querySelector<HTMLButtonElement>('#clear-credentials')?.addEventListener('click', async () => {
    await window.angui.clearCredentials();
    state.credentials = null;
    refreshCredentialControls();
    stopCredentialPush();
    sendCredentialsToWebview({ username: '', password: '' });
    setStatus('Stored login cleared.');
  });
};

const configureWebview = async () => {
  const container = document.getElementById('app');
  if (!container) throw new Error('Missing app container.');
  const paths = await window.angui.getPaths();

  const webview = document.createElement('webview');
  webview.id = 'game-webview';
  webview.src = GAME_URL;
  webview.preload = paths.gamePreload;
  webview.setAttribute('partition', 'persist:angui');
  webview.setAttribute('disableblinkfeatures', 'Auxclick');
  webview.setAttribute('autofocus', 'autofocus');

  webview.addEventListener('ipc-message', (event) => {
    switch (event.channel) {
      case 'settings:toggle':
        requestToggleSettings();
        break;
      case 'open-external': {
        const [url] = event.args;
        if (typeof url === 'string') {
          window.angui.openExternal(url);
        }
        break;
      }
      case 'credentials:request':
        requestCredentialsFromHost();
        break;
      case 'credentials:applied':
        stopCredentialPush();
        break;
      case 'sidebar:toggled': {
        const [hidden] = event.args;
        scheduleZoomUpdate();
        if (typeof hidden === 'boolean' && state.preferences?.collapseSidebar !== hidden) {
          window.angui.setPreferences({ collapseSidebar: hidden });
        }
        break;
      }
      case 'window:resized':
        scheduleZoomUpdate();
        break;
      default:
        break;
    }
  });

  webview.addEventListener('dom-ready', () => {
    if (state.preferences) {
      pushLayoutToWebview(state.preferences);
    }
    scheduleZoomUpdate();
  });

  webview.addEventListener('did-stop-loading', () => {
    if (state.credentials) {
      scheduleCredentialPush();
    } else {
      requestCredentialsFromHost();
    }
    scheduleZoomUpdate();
  });

  webview.addEventListener('before-input-event', (event) => {
    const input = event as any;
    // reserved to keep TypeScript quiet; behaviour handled in preload
    return input;
  });

  container.appendChild(webview);
  webviewElement = webview;
  scheduleZoomUpdate();
};

const initialize = async () => {
  await configureWebview();
  buildSettingsPanel();

  startupOverlay = document.getElementById('startup-overlay');
  if (startupOverlay && !startupOverlayDismissed) {
    startupOverlay.dataset.visible = 'true';
    if (startupOverlayTimer !== null) {
      window.clearTimeout(startupOverlayTimer);
    }
    startupOverlayTimer = window.setTimeout(() => {
      startupOverlay?.removeAttribute('data-visible');
      startupOverlayDismissed = true;
    }, 8000);
  }

  const [preferences, credentials] = await Promise.all([
    window.angui.getPreferences(),
    window.angui.getCredentials()
  ]);

  updatePreferencesState(preferences);
  state.credentials = credentials ?? null;
  refreshCredentialControls();
  applySettingsVisibility();
  scheduleCredentialPush();

  window.angui.onToggleSettings(() => setSettingsVisible(!state.settingsVisible));
  window.angui.onPreferencesChanged((prefs) => updatePreferencesState(prefs));
  window.addEventListener('resize', () => scheduleZoomUpdate(), { passive: true });
  window.addEventListener('wheel', handleWheelZoom, { passive: false });
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  scheduleCursorHide();
};

window.addEventListener('DOMContentLoaded', () => {
  initialize().catch((error) => {
    console.error('Failed to initialize AnGUI', error);
  });
});


window.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.shiftKey && !event.altKey && event.code === 'KeyA') {
    event.preventDefault();
    requestToggleSettings();
  }
  if (event.key === 'Escape' && state.settingsVisible) {
    event.preventDefault();
    setSettingsVisible(false);
  }
}, true);
