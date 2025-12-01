// URL de tu Google Apps Script Web App
const API_URL = 'https://script.google.com/macros/s/AKfycbzW8x5QTK8910w4j4ttewp-IsJy6VIbEWlf7jGZ3xU92XQoedWqSGHGHA3oeckRCKGd/exec';

// Contraseña hardcodeada
const PASSWORD = 'dictadura2025';

// Referencias a elementos del DOM
const passwordOverlay = document.getElementById('passwordOverlay');
const passwordInput = document.getElementById('passwordInput');
const accessBtn = document.getElementById('accessBtn');
const playerNameInput = document.getElementById('playerNameInput');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const attendingList = document.getElementById('attendingList');
const waitingList = document.getElementById('waitingList');
const listCount = document.getElementById('listCount');
const exitModal = document.getElementById('exitModal');
const playerToRemove = document.getElementById('playerToRemove');
const cancelExitBtn = document.getElementById('cancelExitBtn');
const confirmExitBtn = document.getElementById('confirmExitBtn');

// Variables globales
let currentPlayerToRemove = null;
let players = [];
let accesoPermitido = localStorage.getItem('accesoPermitido') === 'true';

// Al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    if (accesoPermitido) {
        passwordOverlay.classList.add('hidden');
    }
    
    loadPlayers();
    startAutoRefresh();
});

// Acceso con contraseña
accessBtn.addEventListener('click', function() {
    const password = passwordInput.value.trim();
    
    if (password === PASSWORD) {
        accesoPermitido = true;
        localStorage.setItem('accesoPermitido', 'true');
        passwordOverlay.classList.add('hidden');
    } else {
        alert('❌ Contraseña incorrecta');
        passwordInput.value = '';
        passwordInput.focus();
    }
});

passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        accessBtn.click();
    }
});

// Cargar jugadores
function loadPlayers() {
    const script = document.createElement('script');
    script.src = API_URL + '?action=getPlayers&callback=handlePlayersData';
    document.body.appendChild(script);
    
    setTimeout(() => {
        if (document.body.contains(script)) {
            document.body.removeChild(script);
        }
    }, 5000);
}

window.handlePlayersData = function(data) {
    if (data && data.players) {
        players = data.players;
        renderPlayers(players);
    }
};

// Funciones de API
async function simpleAPICall(action, params = {}) {
    try {
        const urlParams = new URLSearchParams({
            action: action,
            ...params
        });
        
        const img = new Image();
        img.src = API_URL + '?' + urlParams.toString();
        return { success: true };
    } catch (error) {
        return { success: false };
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
    
    players.push(playerName);
    renderPlayers(players);
    
    const result = await simpleAPICall('addPlayer', { playerName: playerName });
    
    if (result.success) {
        playerNameInput.value = '';
        playerNameInput.focus();
        refreshImmediately();
    } else {
        const index = players.indexOf(playerName);
        if (index > -1) players.splice(index, 1);
        renderPlayers(players);
        alert('Error al agregar jugador');
    }
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
    
    const index = players.indexOf(currentPlayerToRemove);
    if (index > -1) {
        players.splice(index, 1);
        renderPlayers(players);
    }
    
    const result = await simpleAPICall('removePlayer', { playerName: currentPlayerToRemove });
    
    if (!result.success) {
        players.splice(index, 0, currentPlayerToRemove);
        renderPlayers(players);
        alert('Error al remover jugador');
    }
    
    refreshImmediately();
    hideExitModal();
}

// Auto-refresh
function startAutoRefresh() {
    if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
    }
    
    window.autoRefreshInterval = setInterval(() => {
        loadPlayers();
    }, 2000);
}

function refreshImmediately() {
    if (window.pendingRefresh) clearTimeout(window.pendingRefresh);
    window.pendingRefresh = setTimeout(() => {
        loadPlayers();
    }, 500);
}

exitModal.addEventListener('click', function(e) {
    if (e.target === exitModal) hideExitModal();
});