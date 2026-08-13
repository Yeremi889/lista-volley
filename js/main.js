import { db } from './database.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';

let playerToRemove = null;
let isCooldown = false;
let cooldownInterval = null;

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

    if (secondsPassed < 60) {
        startCooldownTimer(60 - secondsPassed);
    }
}

function startCooldownTimer(initialSeconds) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    
    isCooldown = true;
    let timeLeft = initialSeconds;
    ui.toggleLoading(true, timeLeft);

    cooldownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(cooldownInterval);
            isCooldown = false;
            ui.toggleLoading(false);
        } else {
            ui.toggleLoading(true, timeLeft);
        }
    }, 1000);
}

async function loadPlayerData() {
    const players = await db.fetchPlayers();
    ui.renderPlayers(players, (player) => {
        playerToRemove = player;
        document.getElementById('exitModalText').innerText = `¿Seguro que querés quitar a ${player.nombre}?`;
        document.getElementById('exitModal').classList.remove('hidden');
    });
}

document.getElementById('accessBtn').onclick = async () => {
    const pass = document.getElementById('passwordInput').value;
    if (pass === CONFIG.ADMIN_PASSWORD) {
        await db.setListStatus(true);
        showMainScreen();
    } else {
        alert("Contraseña incorrecta, maleta.");
    }
};

document.getElementById('addPlayerBtn').onclick = async () => {
    if (isCooldown) return;

    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    if (!name) return;

    await db.addPlayer(name);
    nameInput.value = '';

    startCooldownTimer(60);
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
        document.getElementById('exitModal').classList.add('hidden');
    }
};

document.getElementById('clearListBtn').onclick = () => document.getElementById('clearListModal').classList.remove('hidden');

document.getElementById('confirmClearBtn').onclick = async () => {
    await db.clearTable();
    location.reload();
};

document.getElementById('cancelExitBtn').onclick = () => document.getElementById('exitModal').classList.add('hidden');
document.getElementById('cancelClearBtn').onclick = () => document.getElementById('clearListModal').classList.add('hidden');

init();