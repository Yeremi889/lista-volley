import { db } from './database.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';

const TOTAL_COOLDOWN_SECONDS = CONFIG.COOLDOWN_TIME / 1000;
const BACKUP_REFRESH_MS = 20000;
const CHANGE_DEBOUNCE_MS = 150;

const el = (id) => document.getElementById(id);

let playerToRemove = null;
let cooldownInterval = null;
let listIsActive = null;
let firstLoad = true;
let isAdding = false;
let isRefreshing = false;
let refreshQueued = false;
let refreshTimer = null;
let connectionLost = false;
let renderedPlayersKey = null;
let renderedHistoryKey = null;

function stopCooldown() {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
    ui.toggleLoading(false);
}

function startCooldownTimer(initialSeconds) {
    clearInterval(cooldownInterval);

    let timeLeft = initialSeconds;
    ui.toggleLoading(true, timeLeft, TOTAL_COOLDOWN_SECONDS);

    cooldownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            stopCooldown();
        } else {
            ui.toggleLoading(true, timeLeft, TOTAL_COOLDOWN_SECONDS);
        }
    }, 1000);
}

async function syncDeviceState() {
    try {
        const [seconds, isAdmin] = await Promise.all([db.getCooldown(), db.isAdmin()]);
        if (seconds > 0) startCooldownTimer(seconds);
        el('clearListBtn').classList.toggle('hidden', !isAdmin);
    } catch (error) {
        console.error('Error al leer el dispositivo:', error);
    }
}

function applyListStatus(isActive) {
    if (isActive === listIsActive) return;
    listIsActive = isActive;

    el('loginScreen').classList.toggle('hidden', isActive);
    el('mainScreen').classList.toggle('hidden', !isActive);

    if (isActive) {
        syncDeviceState();
    } else {
        stopCooldown();
        ['exitModal', 'clearListModal'].forEach(ui.closeModal);
    }
}

function askToRemove(player) {
    playerToRemove = player;
    el('exitModalText').innerText = `¿Seguro que querés quitar a ${player.nombre}?`;
    ui.openModal('exitModal');
}

// Los cambios seguidos se agrupan en una consulta, y una respuesta vieja
// nunca puede pisar a una más nueva.
async function refresh() {
    if (isRefreshing) {
        refreshQueued = true;
        return;
    }

    isRefreshing = true;
    try {
        if (firstLoad) ui.showInitialLoader();
        const { isActive, players, history } = await db.fetchState();

        applyListStatus(isActive);

        const playersKey = JSON.stringify(players);
        if (playersKey !== renderedPlayersKey) {
            renderedPlayersKey = playersKey;
            ui.renderPlayers(players, askToRemove);
        }

        const historyKey = JSON.stringify(history);
        if (historyKey !== renderedHistoryKey) {
            renderedHistoryKey = historyKey;
            ui.renderHistory(history);
        }

        firstLoad = false;
        connectionLost = false;
    } catch (error) {
        console.error('Error al actualizar:', error);
        if (!connectionLost) ui.showToast('Sin conexión, reintentando...', 'error');
        connectionLost = true;
    } finally {
        isRefreshing = false;
        if (refreshQueued) {
            refreshQueued = false;
            refresh();
        }
    }
}

function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, CHANGE_DEBOUNCE_MS);
}

function shakeLoginCard() {
    const card = el('loginScreen');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
}

async function openList() {
    const button = el('accessBtn');
    if (button.disabled) return;

    button.disabled = true;
    try {
        if (await db.openList(el('passwordInput').value)) {
            el('passwordInput').value = '';
            el('clearListBtn').classList.remove('hidden');
            await refresh();
        } else {
            shakeLoginCard();
            ui.showToast('Contraseña incorrecta, maleta 😅', 'error');
        }
    } catch (error) {
        console.error('Error al abrir la lista:', error);
        ui.showToast('No se pudo abrir la lista. Intentá otra vez.', 'error');
    } finally {
        button.disabled = false;
    }
}

const ADD_ERRORS = {
    nombre_invalido: 'Escribí un nombre válido.',
    nombre_repetido: 'Ese nombre ya está en la lista.',
    lista_cerrada: 'La lista está cerrada.',
    sin_sesion: 'Recargá la página e intentá otra vez.'
};

async function addPlayer() {
    const nameInput = el('playerName');
    const name = nameInput.value.trim();
    if (isAdding || cooldownInterval || !name) return;

    isAdding = true;
    el('addPlayerBtn').disabled = true;
    try {
        const result = await db.addPlayer(name);

        if (result.ok) {
            nameInput.value = '';
            startCooldownTimer(result.segundos);
            await refresh();
        } else if (result.error === 'espera') {
            startCooldownTimer(result.segundos);
        } else {
            ui.showToast(ADD_ERRORS[result.error] || 'No se pudo anotar.', 'error');
        }
    } catch (error) {
        console.error('Error al anotar:', error);
        ui.showToast('No se pudo anotar. Tu nombre sigue escrito, intentá otra vez.', 'error');
    } finally {
        isAdding = false;
        if (!cooldownInterval) el('addPlayerBtn').disabled = false;
    }
}

async function confirmRemove() {
    if (!playerToRemove) return;
    const player = playerToRemove;
    playerToRemove = null;
    ui.closeModal('exitModal');

    try {
        const result = await db.removePlayer(player.id);

        if (result.ok) {
            ui.showToast('Te has quitado de la lista.', 'default');
        } else if (result.error === 'no_autorizado') {
            ui.showToast('¡Ni lo piense RATA', 'error');
        } else if (result.error !== 'no_existe') {
            ui.showToast('No se pudo quitar. Recargá la página.', 'error');
        }
        await refresh();
    } catch (error) {
        console.error('Error al quitar:', error);
        ui.showToast('No se pudo quitar. Intentá otra vez.', 'error');
    }
}

async function confirmNewList() {
    ui.closeModal('clearListModal');

    try {
        if (await db.newList()) {
            await refresh();
        } else {
            ui.showToast('Solo quien abrió la lista puede crear otra.', 'error');
        }
    } catch (error) {
        console.error('Error al crear la lista:', error);
        ui.showToast('No se pudo crear la lista. Intentá otra vez.', 'error');
    }
}

function submitOnEnter(input, action) {
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') action();
    });
}

function bindEvents() {
    el('accessBtn').onclick = openList;
    el('addPlayerBtn').onclick = addPlayer;
    el('confirmExitBtn').onclick = confirmRemove;
    el('confirmClearBtn').onclick = confirmNewList;
    el('clearListBtn').onclick = () => ui.openModal('clearListModal');
    el('cancelExitBtn').onclick = () => ui.closeModal('exitModal');
    el('cancelClearBtn').onclick = () => ui.closeModal('clearListModal');
    el('varHelpBtn').onclick = () => ui.openModal('varModal');
    el('closeVarBtn').onclick = () => ui.closeModal('varModal');

    submitOnEnter(el('passwordInput'), openList);
    submitOnEnter(el('playerName'), addPlayer);
}

function keepListUpdated() {
    db.subscribeToChanges(scheduleRefresh, scheduleRefresh);

    // Al volver a la app, el celular pudo haber cortado la conexión en vivo.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') scheduleRefresh();
    });
    window.addEventListener('focus', scheduleRefresh);
    window.addEventListener('online', scheduleRefresh);
    window.addEventListener('pageshow', scheduleRefresh);

    setInterval(() => {
        if (document.visibilityState === 'visible') refresh();
    }, BACKUP_REFRESH_MS);
}

async function init() {
    bindEvents();

    try {
        await db.ensureSession();
    } catch (error) {
        console.error('Error de sesión:', error);
        ui.showToast('No se pudo conectar. Recargá la página.', 'error');
        return;
    }

    keepListUpdated();
    await refresh();
}

init();