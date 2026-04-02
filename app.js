const STORAGE_KEYS = {
  buttons: 'lifeStampButtons',
  logs: 'lifeStampLogs'
};

const params = new URLSearchParams(window.location.search);

if (params.get('unlock') === 'true') {
  localStorage.setItem('lifeStampUnlocked', 'true');
  alert('Unlocked! Thank you for your purchase.');
}

function getIsUnlocked() {
  return localStorage.getItem('lifeStampUnlocked') === 'true';
}

const defaultButtons = [
  { id: crypto.randomUUID(), label: 'Woke Up' },
  { id: crypto.randomUUID(), label: 'Took Medicine' },
  { id: crypto.randomUUID(), label: 'Fed Animals' }
];

let buttons = loadButtons();
let logs = loadLogs();
let deferredPrompt = null;

let draggedButtonId = null;
let touchDragButtonId = null;

const buttonsGrid = document.getElementById('buttonsGrid');
const logList = document.getElementById('logList');
const emptyState = document.getElementById('emptyState');
const buttonForm = document.getElementById('buttonForm');
const buttonNameInput = document.getElementById('buttonName');
const clearLogBtn = document.getElementById('clearLogBtn');
const exportTxtBtn = document.getElementById('exportTxtBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
const installBtn = document.getElementById('installBtn');
const buttonTemplate = document.getElementById('buttonTemplate');
const logTemplate = document.getElementById('logTemplate');

renderButtons();
renderLogs();
registerServiceWorker();
setupInstallPrompt();

buttonForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const isUnlocked = getIsUnlocked();

  if (!isUnlocked && buttons.length >= 3) {
    showUnlock();
    return;
  }

  const label = buttonNameInput.value.trim();
  if (!label) return;

  buttons.push({
    id: crypto.randomUUID(),
    label
  });

  persistButtons();
  renderButtons();
  buttonForm.reset();
  buttonNameInput.focus();
});

clearLogBtn.addEventListener('click', () => {
  if (!logs.length) return;

  const confirmed = window.confirm('Clear the full timestamp log?');
  if (!confirmed) return;

  logs = [];
  persistLogs();
  renderLogs();
});

exportTxtBtn.addEventListener('click', () => exportFile('txt'));
exportCsvBtn.addEventListener('click', () => exportFile('csv'));

resetDefaultsBtn.addEventListener('click', () => {
  const confirmed = window.confirm('Reset buttons to the default set? Your custom buttons will be removed.');
  if (!confirmed) return;

  buttons = structuredClone(defaultButtons).map((button) => ({
    ...button,
    id: crypto.randomUUID()
  }));

  persistButtons();
  renderButtons();
});

function loadButtons() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.buttons));
    return Array.isArray(saved) && saved.length ? saved : structuredClone(defaultButtons);
  } catch {
    return structuredClone(defaultButtons);
  }
}

function loadLogs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.logs));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persistButtons() {
  localStorage.setItem(STORAGE_KEYS.buttons, JSON.stringify(buttons));
}

function persistLogs() {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
}

function renderButtons() {
  buttonsGrid.innerHTML = '';
  const isUnlocked = getIsUnlocked();

  buttons.forEach((button, index) => {
    if (!isUnlocked && index >= 3) return;

    const fragment = buttonTemplate.content.cloneNode(true);
    const wrap = fragment.querySelector('.tap-button-wrap');
    const tapButton = fragment.querySelector('.tap-button');
    const removeButton = fragment.querySelector('.remove-button');

    wrap.dataset.id = button.id;
    wrap.draggable = true;
    wrap.classList.add('draggable-button-wrap');

    tapButton.textContent = button.label;
    tapButton.dataset.id = button.id;

    tapButton.addEventListener('click', () => logTimestamp(button.label));

    removeButton.addEventListener('click', (event) => {
      event.stopPropagation();

      const confirmed = window.confirm(`Remove "${button.label}"?`);
      if (!confirmed) return;

      buttons = buttons.filter((item) => item.id !== button.id);
      persistButtons();
      renderButtons();
    });

    addDragEvents(wrap);
    addTouchDragEvents(wrap);

    buttonsGrid.appendChild(fragment);
  });
}

function addDragEvents(wrap) {
  wrap.addEventListener('dragstart', () => {
    draggedButtonId = wrap.dataset.id;
    wrap.classList.add('dragging');
  });

  wrap.addEventListener('dragend', () => {
    draggedButtonId = null;
    wrap.classList.remove('dragging');
    clearDragOverStates();
  });

  wrap.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (wrap.dataset.id !== draggedButtonId) {
      wrap.classList.add('drag-over');
    }
  });

  wrap.addEventListener('dragleave', () => {
    wrap.classList.remove('drag-over');
  });

  wrap.addEventListener('drop', (event) => {
    event.preventDefault();
    const targetId = wrap.dataset.id;
    moveButton(draggedButtonId, targetId);
  });
}

function addTouchDragEvents(wrap) {
  wrap.addEventListener(
    'touchstart',
    () => {
      touchDragButtonId = wrap.dataset.id;
      wrap.classList.add('dragging');
    },
    { passive: true }
  );

  wrap.addEventListener(
    'touchmove',
    (event) => {
      if (!touchDragButtonId) return;

      const touch = event.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetWrap = target?.closest('.draggable-button-wrap');

      clearDragOverStates();

      if (targetWrap && targetWrap.dataset.id !== touchDragButtonId) {
        targetWrap.classList.add('drag-over');
      }
    },
    { passive: true }
  );

  wrap.addEventListener(
    'touchend',
    (event) => {
      if (!touchDragButtonId) return;

      const touch = event.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetWrap = target?.closest('.draggable-button-wrap');

      wrap.classList.remove('dragging');

      if (targetWrap && targetWrap.dataset.id !== touchDragButtonId) {
        moveButton(touchDragButtonId, targetWrap.dataset.id);
      }

      touchDragButtonId = null;
      clearDragOverStates();
    },
    { passive: true }
  );
}

function moveButton(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;

  const fromIndex = buttons.findIndex((button) => button.id === fromId);
  const toIndex = buttons.findIndex((button) => button.id === toId);

  if (fromIndex === -1 || toIndex === -1) return;

  const [movedButton] = buttons.splice(fromIndex, 1);
  buttons.splice(toIndex, 0, movedButton);

  persistButtons();
  renderButtons();
}

function clearDragOverStates() {
  document.querySelectorAll('.draggable-button-wrap.drag-over').forEach((element) => {
    element.classList.remove('drag-over');
  });
}

function logTimestamp(label) {
  const now = new Date();

  logs.unshift({
    id: crypto.randomUUID(),
    label,
    iso: now.toISOString(),
    formatted: formatDate(now)
  });

  persistLogs();
  renderLogs();

  if (navigator.vibrate) {
    navigator.vibrate(40);
  }
}

function renderLogs() {
  logList.innerHTML = '';
  emptyState.classList.toggle('hidden', logs.length > 0);

  logs.forEach((entry) => {
    const fragment = logTemplate.content.cloneNode(true);

    fragment.querySelector('.log-label').textContent = entry.label;
    fragment.querySelector('.log-time').textContent = entry.formatted;

    fragment.querySelector('.delete-log').addEventListener('click', () => {
      logs = logs.filter((item) => item.id !== entry.id);
      persistLogs();
      renderLogs();
    });

    logList.appendChild(fragment);
  });
}

function formatDate(date) {
  return new Intl.DateTimeFormat([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

function exportFile(type) {
  if (!logs.length) {
    window.alert('There are no log entries to export yet.');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let content = '';
  let fileName = `life-stamp-log-${timestamp}`;
  let mimeType = 'text/plain;charset=utf-8';

  if (type === 'csv') {
    content =
      'Label,Timestamp (Display),Timestamp (ISO)\n' +
      logs.map((entry) => csvSafe([entry.label, entry.formatted, entry.iso]).join(',')).join('\n');

    fileName += '.csv';
    mimeType = 'text/csv;charset=utf-8';
  } else {
    content = logs.map((entry) => `${entry.label} — ${entry.formatted} — ${entry.iso}`).join('\n');
    fileName += '.txt';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function csvSafe(values) {
  return values.map((value) => `"${String(value).replaceAll('"', '""')}"`);
}

function showUnlock() {
  const confirmUnlock = window.confirm(
    'Unlock Life Stamp for $1.99?\n\nUnlimited buttons. Full access.'
  );

  if (confirmUnlock) {
    window.location.href = 'https://buy.stripe.com/7sY3cx8dV3ET2NL6EAcV200';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    });
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });
}
