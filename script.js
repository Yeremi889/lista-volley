// URL de tu NUEVO Google Apps Script Web App
const API_URL = 'https://script.google.com/macros/s/AKfycbzW8x5QTK8910w4j4ttewp-IsJy6VIbEWlf7jGZ3xU92XQoedWqSGHGHA3oeckRCKGd/exec';

// Detectar si es admin por parámetro URL
const urlParams = new URLSearchParams(window.location.search);
const esAdmin = urlParams.get('admin') === 'true';

// Referencias a elementos del DOM
const closedListScreen = document.getElementById('closedListScreen');
const openListScreen = document.getElementById('openListScreen');
const adminSection = document.getElementById('adminSection');
const openListBtn = document.getElementById('openListBtn');
const closeListBtn = document.getElementById('closeListBtn');
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
let listaActiva = false;

// Al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Mostrar sección admin si es admin
    if (esAdmin) {
        adminSection.classList.remove('hidden');
    }
    
    checkListStatus();
});

// Verificar estado de la lista (CORREGIDO - usa JSONP)
function checkListStatus() {
    const script = document.createElement('script');
    script.src = API_URL + '?action=getListStatus&callback=handleStatusData';
    document.body.appendChild(script);
    
    setTimeout(() => {
        if (document.body.contains(script)) {
            document.body.removeChild(script);
        }
    }, 5000);
}

// Manejar estado de la lista
window.handleStatusData = function(data) {
    if (data && !data.error) {
        listaActiva = data.listaActiva;
        
        if (listaActiva) {
            showOpenListScreen();
            setTimeout(loadPlayersWithIframe, 1000);
        } else {
            showClosedListScreen();
        }
    } else {
        showClosedListScreen();
    }
};

// Cargar jugadores (CORREGIDO - usa JSONP)
function loadPlayersWithIframe() {
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
        
        if (listaActiva) {
            startAutoRefresh();
        }
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

// Mostrar pantallas
function showClosedListScreen() {
    closedListScreen.classList.remove('hidden');
    openListScreen.classList.add('hidden');
    exitModal.classList.add('hidden');
}

function showOpenListScreen() {
    closedListScreen.classList.add('hidden');
    openListScreen.classList.remove('hidden');
    exitModal.classList.add('hidden');
}

// Botones de admin
openListBtn.addEventListener('click', async function() {
    if (confirm('¿Quieres abrir la lista para que todos se apunten?')) {
        const result = await simpleAPICall('createList');
        if (result.success) {
            listaActiva = true;
            players = [];
            showOpenListScreen();
            setTimeout(loadPlayersWithIframe, 2000);
        }
    }
});

closeListBtn.addEventListener('click', async function() {
    if (confirm('¿Quieres cerrar la lista?')) {
        const result = await simpleAPICall('closeList');
        if (result.success) {
            listaActiva = false;
            players = [];
            showClosedListScreen();
        }
    }
});

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
        if (listaActiva) {
            loadPlayersWithIframe();
        } else {
            clearInterval(window.autoRefreshInterval);
        }
    }, 2000);
}

function refreshImmediately() {
    if (listaActiva) {
        if (window.pendingRefresh) clearTimeout(window.pendingRefresh);
        window.pendingRefresh = setTimeout(() => {
            loadPlayersWithIframe();
        }, 500);
    }
}

exitModal.addEventListener('click', function(e) {
    if (e.target === exitModal) hideExitModal();
});