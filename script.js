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
let lastUpdateTimestamp = null;
let autoRefreshInterval;
let isInEmergencyMode = false;

// cargar la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('Página cargada - Iniciando sistema...');
    checkListStatus();
    startSmartPolling();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
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

    addPlayerBtn.addEventListener('click', addPlayer);
    playerNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addPlayer();
    });

    clearListBtn.addEventListener('click', async function() {
        if (confirm('¿Quieres cerrar la lista y crear una nueva vacía?')) {
            await closeList();
        }
    });

    cancelExitBtn.addEventListener('click', hideExitModal);
    confirmExitBtn.addEventListener('click', removePlayer);

    exitModal.addEventListener('click', function(e) {
        if (e.target === exitModal) hideExitModal();
    });
}

// Polling-manejo de requests
function startSmartPolling() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    const interval = isInEmergencyMode ? 30000 : 15000; // 30s con límites, 15s normal
    
    autoRefreshInterval = setInterval(() => {
        checkListStatus();
    }, interval);
    
    console.log(`Polling cada ${interval/1000} segundos (${isInEmergencyMode ? 'emergencia' : 'normal'})`);
}

// Polling emergencia 
function startEmergencyPolling() {
    isInEmergencyMode = true;
    startSmartPolling();
    console.log('Modo emergencia activado - Polling cada 30 segundos');
    
    // Volver a normal
    setTimeout(() => {
        isInEmergencyMode = false;
        startSmartPolling();
        console.log('Volviendo a modo normal');
    }, 60000);
}

// Verificar estado de lista
async function checkListStatus() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'getListStatusWithPlayers',
                lastTimestamp: lastUpdateTimestamp 
            })
        });
        
        // error 429
        if (response.status === 429) {
            console.warn('⚠️ Límite de API excedido, activando modo emergencia');
            if (!isInEmergencyMode) {
                startEmergencyPolling();
            }
            return;
        }
        
        if (!response.ok) {
            console.warn('Error en checkListStatus:', response.status);
            return;
        }
        
        const data = await response.json();
        
        // actualizar camb
        if (data.needsUpdate && data.players) {
            players = data.players;
            renderPlayers(players);
            lastUpdateTimestamp = data.lastTimestamp;
        }
        
        if (data.listaAbierta) {
            showListScreen();
        } else {
            showAccessScreen();
        }
    } catch (error) {
        console.warn('Error en checkListStatus:', error);
    }
}

// Abrir lista
async function openListForEveryone() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'openList' })
        });
        
        if (!response.ok) {
            alert('Error al abrir lista');
            return;
        }
        
        lastUpdateTimestamp = null;
        await checkListStatus();
        
        alert('Lista abierta - Los jugadores ya pueden apuntarse');
        
    } catch (error) {
        console.error('Error abriendo lista:', error);
        alert('Error al abrir lista');
    }
}

// Añadir jugador
async function addPlayer() {
    const playerName = playerNameInput.value.trim();
    
    if (playerName === '') {
        alert('Escriba el nombre');
        return;
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'tryAddPlayer', 
                playerName: playerName
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            playerNameInput.value = '';
            lastUpdateTimestamp = null;
            await checkListStatus();
            playerNameInput.focus();
            
            if (data.position === 'espera') {
                alert(`✅ ${playerName} apuntado en LISTA DE ESPERA`);
            } else {
                alert(`✅ ${playerName} apuntado CORRECTAMENTE`);
            }
            
        } else if (data.error === 'Ya existe') {
            alert('Nombre ya anotado');
            playerNameInput.focus();
            playerNameInput.select();
            
        } else if (data.error === 'Lista cerrada') {
            alert('❌ LISTA CERRADA ❌');
            
        } else {
            alert('Error: ' + (data.error || 'Desconocido'));
        }
    } catch (error) {
        console.error('Error agregando jugador:', error);
        alert('Error al agregar jugador');
    }
}

// Cerrar lista
async function closeList() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'closeList' })
        });
        
        const data = await response.json();
        if (data.success) {
            players = [];
            lastUpdateTimestamp = null;
            isInEmergencyMode = false;
            renderPlayers(players);
            showAccessScreen();
            alert('lista para usar');
            startSmartPolling();
        }
    } catch (error) {
        console.error('Error cerrando lista:', error);
        alert('Error al limpiar la lista');
    }
}

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
        
        // opcion para salir de lista
        playerElement.style.cursor = 'pointer';
        playerElement.title = 'Haz click para salir de la lista';
        playerElement.addEventListener('click', () => showExitModal(player));
        
        if (index < MAX_PLAYERS) {
            attendingList.appendChild(playerElement);
        } else {
            waitingList.appendChild(playerElement);
        }
    });
    
    // slots vacíos
    for (let i = playersList.length; i < MAX_PLAYERS; i++) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'player-item';
        emptySlot.innerHTML = `<span class="player-number">${i + 1}.</span>[VACIO]`;
        emptySlot.style.opacity = '0.6';
        emptySlot.style.cursor = 'default';
        emptySlot.title = 'Espacio disponible';
        attendingList.appendChild(emptySlot);
    }
}

// Modal para salir
function showExitModal(playerName) {
    currentPlayerToRemove = playerName;
    
    const modalText = document.getElementById('exitModalText');
    if (modalText) {
        modalText.innerHTML = `¿Quieres quitar a <strong>${playerName}</strong> de los asistentes?<br>
                              <small>(Si vuelves a apuntarte, irás al final de la lista)</small>`;
    }
    
    exitModal.classList.remove('hidden');
}

function hideExitModal() {
    exitModal.classList.add('hidden');
    currentPlayerToRemove = null;
}

// Función para remover jugador
async function removePlayer() {
    if (!currentPlayerToRemove) {
        hideExitModal();
        return;
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'removePlayer', 
                playerName: currentPlayerToRemove 
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            lastUpdateTimestamp = null;
            await checkListStatus();
            alert(` ${currentPlayerToRemove} salió de la lista`);
            
        } else if (data.error === 'Jugador no encontrado') {
            alert('⚠️ Este jugador ya no está en la lista');
            lastUpdateTimestamp = null;
            await checkListStatus();
            
        } else {
            alert('Error: ' + (data.error || 'No se pudo eliminar'));
        }
    } catch (error) {
        console.error('Error eliminando jugador:', error);
        alert('Error al eliminar jugador');
    }
    
    hideExitModal();
}

window.addEventListener('focus', function() {
    console.log('Página en foco - Actualizando...');
    lastUpdateTimestamp = null;
    checkListStatus();
});