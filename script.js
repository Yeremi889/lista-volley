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

// Al cargar la página
document.addEventListener('DOMContentLoaded', function() {
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

// Polling inteligente - 7 segundos para todos
function startSmartPolling() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        checkListStatus();
    }, 7000); // 7 segundos
    
    console.log('Polling cada 7 segundos');
}

// Verificar estado de la lista
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
        
        if (!response.ok) {
            console.warn('Error:', response.status);
            return;
        }
        
        const data = await response.json();
        
        // Actualizar si hay cambios
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
        console.warn('Error:', error);
    }
}

// Abrir lista
async function openListForEveryone() {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'openList' })
        });
        
        lastUpdateTimestamp = null;
        await checkListStatus();
        
        alert('✅ Lista abierta - Los jugadores ya pueden apuntarse');
        
    } catch (error) {
        console.error('Error abriendo lista:', error);
        alert('Error al abrir lista');
    }
}

// Añadir jugador
async function addPlayer() {
    const playerName = playerNameInput.value.trim();
    
    if (playerName === '') {
        alert('Por favor escribe un nombre');
        return;
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'tryAddPlayer', 
                playerName,
                currentPlayers: players.length
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            playerNameInput.value = '';
            lastUpdateTimestamp = null;
            await checkListStatus();
            playerNameInput.focus();
            
            alert(`✅ ${playerName} apuntado correctamente`);
            
        } else if (data.error === 'Lista llena') {
            alert('⚠️ La lista principal está llena. Estás en lista de espera.');
            lastUpdateTimestamp = null;
            await checkListStatus();
            
        } else if (data.error === 'Ya existe') {
            alert('⚠️ Este nombre ya está en la lista');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
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
            renderPlayers(players);
            showAccessScreen();
            alert('✅ Lista cerrada - Nueva lista lista para usar');
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
        
        // TODOS los jugadores son clickeables para salir
        playerElement.style.cursor = 'pointer';
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

// Modal para salir - MODIFICADO CON NUEVO MENSAJE
function showExitModal(playerName) {
    currentPlayerToRemove = playerName;
    playerToRemove.textContent = playerName;
    exitModal.classList.remove('hidden');
    
    // Actualizar el mensaje del modal
    const modalText = exitModal.querySelector('p');
    if (modalText) {
        modalText.innerHTML = `¿Quieres quitar a <strong>${playerName}</strong> de los asistentes?<br>
                              <small>(Si vuelves a apuntarte, irás al final de la lista)</small>`;
    }
}

function hideExitModal() {
    exitModal.classList.add('hidden');
    currentPlayerToRemove = null;
}

// Función para remover jugador - YA IMPLEMENTADA
async function removePlayer() {
    if (!currentPlayerToRemove) return;
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'removePlayer', playerName: currentPlayerToRemove })
        });
        
        const data = await response.json();
        if (data.success) {
            lastUpdateTimestamp = null;
            await checkListStatus();
            alert(`✅ ${currentPlayerToRemove} salió de la lista`);
        } else {
            alert('Error al eliminar jugador');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar jugador');
    }
    
    hideExitModal();
}