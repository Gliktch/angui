import { ipcRenderer } from 'electron';

type LayoutPreferences = {
  collapseChat: boolean;
  collapseSidebar: boolean;
};

type DomTarget = 'chat' | 'sidebar';

const selectors: Record<DomTarget, string[]> = {
  chat: ['#chat', '.chat', "[data-panel='chat']", "[data-testid='chat']"],
  sidebar: ['#sidebar', '.sidebar', "[data-panel='sidebar']", "[data-testid='sidebar']"]
};

const CHAT_TOGGLES = [
  '.tab-buttons.isaf',
  '.tab-panels.isaf',
  '.tab-buttons.ucel',
  '.tab-panels.ucel',
  '.pane-side'
];

const getChatInput = () => document.querySelector<HTMLInputElement>("#tab-chat input[type=\"text\"]") || document.querySelector<HTMLInputElement>("#new-message-input input[type=\"text\"]");
const getTerminal = () => document.querySelector<HTMLElement>('#terminal-container');

const applyChatSidebarVisibility = (hidden: boolean) => {
  if (hidden) {
    document.body.dataset.anguiSidebarHidden = 'true';
  } else {
    delete document.body.dataset.anguiSidebarHidden;
  }
  CHAT_TOGGLES.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      if (hidden) {
        if (!node.dataset.anguiDisplayCached) {
          node.dataset.anguiDisplayCached = node.style.display || '';
        }
        node.style.display = 'none';
      } else {
        if (node.dataset.anguiDisplayCached !== undefined) {
          node.style.display = node.dataset.anguiDisplayCached;
          delete node.dataset.anguiDisplayCached;
        } else {
          node.style.removeProperty('display');
        }
      }
    });
  });
};

const blockedShortcuts: Array<(event: KeyboardEvent) => boolean> = [
  (event) => event.ctrlKey && !event.altKey && !event.shiftKey && ['KeyR', 'KeyW', 'KeyL', 'KeyN', 'KeyT', 'KeyP', 'KeyO', 'KeyS'].includes(event.code),
  (event) => event.ctrlKey && event.shiftKey && ['KeyR', 'KeyI', 'KeyJ', 'KeyN', 'KeyW'].includes(event.code),
  (event) => event.ctrlKey && event.altKey && ['KeyI', 'KeyJ'].includes(event.code),
  (event) => event.code === 'F5' || event.code === 'F12' || event.code === 'F11'
];

const toggleSettingsCombo = (event: KeyboardEvent): boolean => {
  return event.ctrlKey && event.shiftKey && !event.altKey && event.code === 'KeyA';
};

const applyVisibility = (target: DomTarget, hidden: boolean) => {
  const candidates = selectors[target];
  candidates.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      if (hidden) {
        if (!node.dataset.anguiDisplayCached) {
          node.dataset.anguiDisplayCached = node.style.display || '';
        }
        node.style.display = 'none';
      } else {
        if (node.dataset.anguiDisplayCached !== undefined) {
          node.style.display = node.dataset.anguiDisplayCached;
          delete node.dataset.anguiDisplayCached;
        } else {
          node.style.removeProperty('display');
        }
      }
    });
  });
};

const applyLayout = (layout: LayoutPreferences) => {
  applyVisibility('chat', layout.collapseChat);
  applyVisibility('sidebar', layout.collapseSidebar);
  applyChatSidebarVisibility(layout.collapseSidebar);
};

const ensureStyle = () => {
  if (document.getElementById('angui-style')) return;
  const style = document.createElement('style');
  style.id = 'angui-style';
  style.textContent = `
    :root {
      --angui-overlay-z: 99999;
    }
    .angui-intercept a[href] {
      cursor: pointer;
    }
  `;
  document.head.append(style);
};

window.addEventListener('DOMContentLoaded', () => {
  ensureStyle();

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.href;
    if (!href) return;
    const sameOrigin = anchor.origin === window.location.origin;
    if (sameOrigin && href.startsWith(window.location.origin)) {
      return;
    }
    event.preventDefault();
    ipcRenderer.sendToHost('open-external', href);
  });
});

window.addEventListener('keydown', (event) => {
  if (toggleSettingsCombo(event)) {
    event.stopPropagation();
    event.preventDefault();
    ipcRenderer.sendToHost('settings:toggle');
    return;
  }

  if (event.ctrlKey && event.shiftKey && event.code === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    toggleChatSidebar();
    return;
  }

  if (event.ctrlKey && !event.altKey && !event.shiftKey && event.code === 'KeyR') {
    event.preventDefault();
    event.stopPropagation();
    focusTerminal();
    return;
  }

  const shouldBlock = blockedShortcuts.some((matcher) => matcher(event));
  if (shouldBlock) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

const focusChatInput = () => {
  const input = getChatInput() || document.querySelector<HTMLInputElement>("input[placeholder='type message here..']");
  if (!input) return;
  const attemptFocus = () => {
    if (!document.body.contains(input)) {
      return false;
    }
    input.focus({ preventScroll: true });
    if (typeof input.setSelectionRange === 'function') {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    return document.activeElement === input;
  };

  if (!attemptFocus()) {
    window.setTimeout(attemptFocus, 100);
  }
};

const focusTerminal = () => {
  const terminal = getTerminal();
  if (terminal instanceof HTMLElement) {
    terminal.focus();
  }
};

const toggleChatSidebar = () => {
  const hidden = document.body.dataset.anguiSidebarHidden === 'true';
  const nextHidden = !hidden;
  applyChatSidebarVisibility(nextHidden);
  if (nextHidden) {
    focusTerminal();
  } else {
    focusChatInput();
  }
  ipcRenderer.sendToHost('sidebar:toggled', nextHidden);
};

ipcRenderer.on('layout:update', (_event, layout: LayoutPreferences) => {
  applyLayout(layout);
});


const fillCredentials = (username: string, password: string) => {
  const userInput = document.querySelector<HTMLInputElement>("#username, input[name=\"username\" i]");
  const passInput = document.querySelector<HTMLInputElement>("#password, input[name=\"password\" i]");
  let filled = false;
  if (userInput) {
    userInput.value = username;
    userInput.dispatchEvent(new Event('input', { bubbles: true }));
    userInput.dispatchEvent(new Event('change', { bubbles: true }));
    filled = true;
  }
  if (passInput) {
    passInput.value = password;
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
    passInput.dispatchEvent(new Event('change', { bubbles: true }));
    filled = true;
  }
  if (filled) {
    ipcRenderer.sendToHost('credentials:applied');
  }
};

ipcRenderer.on('credentials:apply', (_event, creds: { username: string; password: string }) => {
  if (!creds) return;
  fillCredentials(creds.username, creds.password);
});

const CREDS_REQUESTED_FLAG = '__anguiCredsRequested';

const maybeRequestCredentials = (force = false) => {
  if (!force && (window as any)[CREDS_REQUESTED_FLAG]) {
    return;
  }
  const userInput = document.querySelector('#username, input[name=\"username\" i]');
  const passInput = document.querySelector('#password, input[name=\"password\" i]');
  if (userInput && passInput) {
    (window as any)[CREDS_REQUESTED_FLAG] = true;
    ipcRenderer.sendToHost('credentials:request');
  }
};

const observer = new MutationObserver(() => {
  maybeRequestCredentials();
});

observer.observe(document.documentElement, { subtree: true, childList: true });

window.addEventListener('load', () => maybeRequestCredentials());


