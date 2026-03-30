import { db } from './database.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';

let playerToRemove = null;

// 1. COMPROBACIÓN INICIAL (Para que el celular entre directo)
async function checkAccess() {
    const isActive = await db.getListStatus();
    if (isActive) {
        showMainScreen();
    }
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    document.getElementById('clearListBtn').classList.remove('hidden');
    initApp();
}

// 2. BOTÓN ABRIR LISTA (Con contraseña)
document.getElementById('accessBtn').onclick = async () => {
    const pass = document.getElementById('passwordInput').value;
    if (pass === CONFIG.ADMIN_PASSWORD) {
        await db.setListStatus(true); // Encendemos el interruptor en la DB
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

    db.subscribeToChanges(() => initApp());
}

// 3. REGISTRO Y COOLDOWN
document.getElementById('addPlayerBtn').onclick = async () => {
    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    if (!name) return;

    await db.addPlayer(name);
    nameInput.value = '';
    
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

// 4. MODALES
document.getElementById('confirmExitBtn').onclick = async () => {
    if (playerToRemove) {
        await db.removePlayer(playerToRemove.id);
        document.getElementById('exitModal').classList.add('hidden');
    }
};
document.getElementById('cancelExitBtn').onclick = () => document.getElementById('exitModal').classList.add('hidden');

document.getElementById('clearListBtn').onclick = () => document.getElementById('clearListModal').classList.remove('hidden');
document.getElementById('confirmClearBtn').onclick = async () => {
    await db.clearTable();
    location.reload(); // Recargamos para volver al login
};
document.getElementById('cancelClearBtn').onclick = () => document.getElementById('clearListModal').classList.add('hidden');

// Ejecutar check al cargar
checkAccess();