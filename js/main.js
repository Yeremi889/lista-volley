import { db } from './database.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';

let playerToRemove = null;
let isCooldown = false;
let cooldownInterval = null;
let firstLoad = true;

const TOTAL_COOLDOWN_SECONDS = CONFIG.COOLDOWN_TIME / 1000;

async function init() {
    const isActive = await db.getListStatus();
    if (isActive) {
        showMainScreen();
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
    }
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    document.getElementById('clearListBtn').classList.remove('hidden');
    loadPlayerData();
    checkCooldown();
}

async function checkCooldown() {
    const lastRegistrationTime = await db.getLastPlayerTimeByDevice();
    if (!lastRegistrationTime) return;

    const lastTime = new Date(lastRegistrationTime).getTime();
    const now = new Date().getTime();
    const secondsPassed = Math.floor((now - lastTime) / 1000);

    if (secondsPassed < TOTAL_COOLDOWN_SECONDS) {
        startCooldownTimer(TOTAL_COOLDOWN_SECONDS - secondsPassed);
    }
}

function startCooldownTimer(initialSeconds) {
    if (cooldownInterval) clearInterval(cooldownInterval);

    isCooldown = true;
    let timeLeft = initialSeconds;
    ui.toggleLoading(true, timeLeft, TOTAL_COOLDOWN_SECONDS);

    cooldownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(cooldownInterval);
            isCooldown = false;
            ui.toggleLoading(false);
        } else {
            ui.toggleLoading(true, timeLeft, TOTAL_COOLDOWN_SECONDS);
        }
    }, 1000);
}

async function loadPlayerData() {
    if (firstLoad) ui.showInitialLoader();
    const players = await db.fetchPlayers();
    ui.renderPlayers(players, (player) => {
        playerToRemove = player;
        document.getElementById('exitModalText').innerText = `¿Seguro que querés quitar a ${player.nombre}?`;
        ui.openModal('exitModal');
    });
    firstLoad = false;
}

function shakeLoginCard() {
    const card = document.getElementById('loginScreen');
    card.classList.remove('shake');
    void card.offsetWidth; // reflow para poder re-disparar la animacion
    card.classList.add('shake');
}

document.getElementById('accessBtn').onclick = async () => {
    const pass = document.getElementById('passwordInput').value;
    if (pass === CONFIG.ADMIN_PASSWORD) {
        await db.setListStatus(true);
        showMainScreen();
    } else {
        shakeLoginCard();
        ui.showToast('Contraseña incorrecta, maleta 😅', 'error');
    }
};

document.getElementById('addPlayerBtn').onclick = async () => {
    if (isCooldown) return;

    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    if (!name) return;

    await db.addPlayer(name);
    nameInput.value = '';

    startCooldownTimer(TOTAL_COOLDOWN_SECONDS);
};

db.subscribeToChanges(
    () => loadPlayerData(),
    (payload) => {
        if (payload.new && payload.new.lista_activa) {
            showMainScreen();
        } else if (payload.new && !payload.new.lista_activa) {
            location.reload();
        }
    }
);

document.getElementById('confirmExitBtn').onclick = async () => {
    if (playerToRemove) {
        await db.removePlayer(playerToRemove.id);
        ui.closeModal('exitModal');
    }
};

document.getElementById('clearListBtn').onclick = () => ui.openModal('clearListModal');

document.getElementById('confirmClearBtn').onclick = async () => {
    await db.clearTable();
    location.reload();
};

document.getElementById('cancelExitBtn').onclick = () => ui.closeModal('exitModal');
document.getElementById('cancelClearBtn').onclick = () => ui.closeModal('clearListModal');

init();