const isUnlocked = localStorage.getItem('lifeStampUnlocked') === 'true';
const STORAGE_KEYS = {
  buttons: 'lifeStampButtons',
  logs: 'lifeStampLogs'
};

const defaultButtons = [
  { id: crypto.randomUUID(), label: 'Woke Up' },
  { id: crypto.randomUUID(), label: 'Took Medicine' },
  { id: crypto.randomUUID(), label: 'Fed Animals' },
  { id: crypto.randomUUID(), label: 'Started Laundry' },
  { id: crypto.randomUUID(), label: 'Left Home' },
  { id: crypto.randomUUID(), label: 'Went to Bed' }
];

let buttons = loadButtons();
let logs = loadLogs();
let deferredPrompt = null;

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

  const label = buttonNameInput.value.trim();
  if (!label) return;

  buttons.unshift({
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

  buttons = structuredClone(defaultButtons).map(button => ({
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

  buttons.forEach((button) => {
    const fragment = buttonTemplate.content.cloneNode(true);
    const tapButton = fragment.querySelector('.tap-button');
    const removeButton = fragment.querySelector('.remove-button');

    tapButton.textContent = button.label;
    tapButton.addEventListener('click', () => logTimestamp(button.label));

    removeButton.addEventListener('click', () => {
      const confirmed = window.confirm(`Remove "${button.label}"?`);
      if (!confirmed) return;

      buttons = buttons.filter((item) => item.id !== button.id);
      persistButtons();
      renderButtons();
    });

    buttonsGrid.appendChild(fragment);
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
