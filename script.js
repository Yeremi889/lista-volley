// Configuración
const API_URL = '/.netlify/functions/sheets';

// Referencias a elementos del DOM
const passwordOverlay = document.getElementById('passwordOverlay');
const passwordInput = document.getElementById('passwordInput');
const accessBtn = document.getElementById('accessBtn');
const listScreen = document.getElementById('listScreen');
const playerNameInput = document.getElementById('playerNameInput');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const attendingList = document.getElementById('attendingList');
const waitingList = document.getElementById('waitingList');
const listCount = document.getElementById('listCount');
const clearListBtn = document.getElementById('clearListBtn');
const exitModal = document.getElementById('exitModal');
const playerToRemove = document.getElementById('playerToRemove');
const cancelExitBtn = document.getElementById('cancelExitBtn');
const confirmExitBtn = document.getElementById('confirmExitBtn');

// Variables globales
let currentPlayerToRemove = null;
let players = [];
let autoRefreshInterval;

// Al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    checkListStatus();
    startAutoRefresh();
});

// Verificar estado de la lista
async function checkListStatus() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getListStatus' })
        });
        
        const data = await response.json();
        
        if (data.listaAbierta) {
            showListScreen();
            loadPlayers();
        } else {
            showAccessScreen();
        }
    } catch (error) {
        console.error('Error:', error);
        showAccessScreen();
    }
}

// Acceso admin
accessBtn.addEventListener('click', async function() {
    const password = passwordInput.value.trim();
    
    if (password === 'dictadura2025') {
        await openListForEveryone();
    } else {
        alert('❌ Contraseña incorrecta');
        passwordInput.value = '';
        passwordInput.focus();
    }
});

passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') accessBtn.click();
});

// Abrir lista para todos
async function openListForEveryone() {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'openList' })
        });
        showListScreen();
        loadPlayers();
    } catch (error) {
        console.error('Error abriendo lista:', error);
    }
}

// Cargar jugadores
async function loadPlayers() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getPlayers' })
        });
        
        const data = await response.json();
        if (data.players) {
            players = data.players;
            renderPlayers(players);
        }
    } catch (error) {
        console.error('Error cargando jugadores:', error);
    }
}

// Añadir jugador
addPlayerBtn.addEventListener('click', addPlayer);
playerNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addPlayer();
});

async function addPlayer() {
    const playerName = playerNameInput.value.trim();
    
    if (playerName === '') {
        alert('Por favor escribe un nombre');
        return;
    }
    
    if (players.includes(playerName)) {
        alert('⚠️ Este nombre ya está en la lista');
        return;
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'addPlayer', playerName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            playerNameInput.value = '';
            playerNameInput.focus();
            await loadPlayers();
        } else if (data.error) {
            alert(data.error);
        }
    } catch (error) {
        console.error('Error agregando jugador:', error);
        alert('Error al agregar jugador');
    }
}

// Limpiar lista y cerrarla
clearListBtn.addEventListener('click', async function() {
    if (confirm('¿Quieres cerrar la lista y crear una nueva vacía?')) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'closeList' })
            });
            
            const data = await response.json();
            if (data.success) {
                players = [];
                renderPlayers(players);
                showAccessScreen();
            }
        } catch (error) {
            console.error('Error cerrando lista:', error);
            alert('Error al limpiar la lista');
        }
    }
});

// Mostrar pantallas
function showAccessScreen() {
    passwordOverlay.classList.remove('hidden');
    listScreen.classList.add('hidden');
    exitModal.classList.add('hidden');
}

function showListScreen() {
    passwordOverlay.classList.add('hidden');
    listScreen.classList.remove('hidden');
    exitModal.classList.add('hidden');
}

// Renderizar jugadores
function renderPlayers(playersList) {
    attendingList.innerHTML = '';
    waitingList.innerHTML = '';
    
    const MAX_PLAYERS = 12;
    const attendingCount = Math.min(playersList.length, MAX_PLAYERS);
    listCount.textContent = `${attendingCount}/${MAX_PLAYERS}`;
    
    playersList.forEach((player, index) => {
        const playerElement = document.createElement('div');
        playerElement.className = `player-item ${index >= MAX_PLAYERS ? 'waiting' : ''}`;
        playerElement.innerHTML = `<span class="player-number">${index + 1}.</span>${player}`;
        playerElement.addEventListener('click', () => showExitModal(player));
        
        if (index < MAX_PLAYERS) {
            attendingList.appendChild(playerElement);
        } else {
            waitingList.appendChild(playerElement);
        }
    });
    
    for (let i = playersList.length; i < MAX_PLAYERS; i++) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'player-item';
        emptySlot.innerHTML = `<span class="player-number">${i + 1}.</span>[VACIO]`;
        emptySlot.style.opacity = '0.6';
        emptySlot.style.cursor = 'default';
        attendingList.appendChild(emptySlot);
    }
}

// Modal para salir
function showExitModal(playerName) {
    currentPlayerToRemove = playerName;
    playerToRemove.textContent = playerName;
    exitModal.classList.remove('hidden');
}

function hideExitModal() {
    exitModal.classList.add('hidden');
    currentPlayerToRemove = null;
}

cancelExitBtn.addEventListener('click', hideExitModal);
confirmExitBtn.addEventListener('click', removePlayer);

async function removePlayer() {
    if (!currentPlayerToRemove) return;
    hideExitModal();
}

// Auto-refresh
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        checkListStatus();
    }, 3000);
}

exitModal.addEventListener('click', function(e) {
    if (e.target === exitModal) hideExitModal();
});