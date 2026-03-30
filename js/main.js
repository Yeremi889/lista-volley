import { db } from './database.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';

let playerToRemove = null;

// ACCESO
document.getElementById('accessBtn').onclick = () => {
    const pass = document.getElementById('passwordInput').value;
    if (pass === CONFIG.ADMIN_PASSWORD) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainScreen').classList.remove('hidden');
        document.getElementById('clearListBtn').classList.remove('hidden');
        initApp();
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

    db.subscribeToChanges((payload) => {
        initApp();
    });
}

// ANOTAR JUGADOR y COOLDOWN
document.getElementById('addPlayerBtn').onclick = async () => {
    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    
    if (!name) return;

    await db.addPlayer(name);
    nameInput.value = '';
    
    // Cooldown
    let timeLeft = 60;
    ui.toggleLoading(document.getElementById('addPlayerBtn'), true, timeLeft);
    
    const timer = setInterval(() => {
        timeLeft--;
        ui.toggleLoading(document.getElementById('addPlayerBtn'), true, timeLeft);
        if (timeLeft <= 0) {
            clearInterval(timer);
            ui.toggleLoading(document.getElementById('addPlayerBtn'), false);
        }
    }, 1000);
};

// MODAL SALIDA - BOTONES
document.getElementById('confirmExitBtn').onclick = async () => {
    if (playerToRemove) {
        await db.removePlayer(playerToRemove.id);
        document.getElementById('exitModal').classList.add('hidden');
    }
};
document.getElementById('cancelExitBtn').onclick = () => {
    document.getElementById('exitModal').classList.add('hidden');
};

// MODAL NUEVA LISTA - BOTONES
document.getElementById('clearListBtn').onclick = () => {
    document.getElementById('clearListModal').classList.remove('hidden');
};
document.getElementById('confirmClearBtn').onclick = async () => {
    await db.clearTable();
    document.getElementById('clearListModal').classList.add('hidden');
};
document.getElementById('cancelClearBtn').onclick = () => {
    document.getElementById('clearListModal').classList.add('hidden');
};