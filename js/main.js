import { db } from './database.js';
import { ui } from './ui.js';
import { CONFIG } from './config.js';

let playerToRemove = null;
let isCooldown = false;

// 1. COMPROBACIÓN AL CARGAR (Para que no pida contraseña si ya está en TRUE)
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
    // Mostrar el botón "Nueva Lista" solo si se tiene acceso
    document.getElementById('clearListBtn').classList.remove('hidden');
    loadPlayerData();
}

async function loadPlayerData() {
    const players = await db.fetchPlayers();
    ui.renderPlayers(players, (player) => {
        playerToRemove = player;
        document.getElementById('exitModalText').innerText = `¿Seguro que querés quitar a ${player.nombre}?`;
        document.getElementById('exitModal').classList.remove('hidden');
    });
}

// 2. BOTÓN ABRIR LISTA
document.getElementById('accessBtn').onclick = async () => {
    const pass = document.getElementById('passwordInput').value;
    if (pass === CONFIG.ADMIN_PASSWORD) {
        await db.setListStatus(true);
        showMainScreen();
    } else {
        alert("Contraseña incorrecta, maleta.");
    }
};

// 3. REGISTRO CON COOLDOWN (60 segundos)
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

// 4. SUSCRIPCIÓN TIEMPO REAL
db.subscribeToChanges(
    () => loadPlayerData(), // Si cambian jugadores, recargar lista
    (payload) => {           // Si cambia la configuración (Abrir/Cerrar)
        if (payload.new && payload.new.lista_activa) {
            showMainScreen();
        } else if (payload.new && !payload.new.lista_activa) {
            location.reload(); // Si se cierra, todos al login
        }
    }
);

// 5. MODALES Y BORRADO
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

// Iniciar la App
init();