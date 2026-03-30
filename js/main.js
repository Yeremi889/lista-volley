import { db } from './database.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';

let playerToRemove = null;
let isCooldown = false;

async function checkAccess() {
    const isActive = await db.getListStatus();
    if (isActive) showMainScreen();
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    initApp();
}

document.getElementById('accessBtn').onclick = async () => {
    const pass = document.getElementById('passwordInput').value;
    if (pass === CONFIG.ADMIN_PASSWORD) {
        await db.setListStatus(true);
        showMainScreen();
    } else {
        alert("Contraseña incorrecta");
    }
};

async function initApp() {
    const players = await db.fetchPlayers();
    ui.renderPlayers(players, (player) => {
        playerToRemove = player;
        document.getElementById('exitModalText').innerText = `¿Seguro que querés quitar a ${player.nombre}?`;
        document.getElementById('exitModal').classList.remove('hidden');
    });

    db.subscribeToChanges(
        () => initApp(),
        (payload) => {
            if (payload.new && payload.new.lista_activa) showMainScreen();
            else if (payload.new && !payload.new.lista_activa) location.reload();
        }
    );
}

// Lógica de Registro con COOLDOWN restaurado
document.getElementById('addPlayerBtn').onclick = async () => {
    if (isCooldown) return;

    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    if (!name) return;

    await db.addPlayer(name);
    nameInput.value = '';

    // Iniciar Cooldown
    isCooldown = true;
    let timeLeft = 60;
    ui.toggleLoading(true, timeLeft);

    const timer = setInterval(() => {
        timeLeft--;
        ui.toggleLoading(true, timeLeft);
        if (timeLeft <= 0) {
            clearInterval(timer);
            isCooldown = false;
            ui.toggleLoading(false);
        }
    }, 1000);
};

// Modales y Limpieza
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

checkAccess();