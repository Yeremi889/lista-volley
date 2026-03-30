import { db } from './database.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';

let playerToRemove = null;

// Verifica si la lista ya está abierta (para el celular)
async function checkAccess() {
    const isActive = await db.getListStatus();
    if (isActive) {
        showMainScreen();
    }
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    initApp();
}

// CORRECCIÓN: Botón "Abrir Lista"
document.getElementById('accessBtn').onclick = async () => {
    const pass = document.getElementById('passwordInput').value;
    if (pass === CONFIG.ADMIN_PASSWORD) {
        await db.setListStatus(true); // Activa el interruptor en la DB
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

    // Suscripción corregida
    db.subscribeToChanges(
        () => initApp(), // Cambios en jugadores
        (payload) => {   // Cambios en configuración
            if (!payload.new.lista_activa) location.reload(); 
        }
    );
}

// Registro de jugadores
document.getElementById('addPlayerBtn').onclick = async () => {
    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    if (name) {
        await db.addPlayer(name);
        nameInput.value = '';
    }
};

// Modales
document.getElementById('confirmExitBtn').onclick = async () => {
    if (playerToRemove) {
        await db.removePlayer(playerToRemove.id);
        document.getElementById('exitModal').classList.add('hidden');
    }
};
document.getElementById('cancelExitBtn').onclick = () => document.getElementById('exitModal').classList.add('hidden');

document.getElementById('clearListBtn').onclick = () => document.getElementById('clearListModal').classList.remove('hidden');
document.getElementById('confirmClearBtn').onclick = async () => {
    await db.clearTable(); // Esto también pone lista_activa en false
    location.reload(); 
};
document.getElementById('cancelClearBtn').onclick = () => document.getElementById('clearListModal').classList.add('hidden');

checkAccess();