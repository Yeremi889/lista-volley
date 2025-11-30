const API_URL = 'https://script.google.com/macros/s/AKfycbzzM6_gWScIgfDKSP37d725JJzYRk71s6Pr50W1wIHTJVOL_BX-IFHkkrWyH6FAJ1QIDQ/exec';

// Referencias a elementos DOM
const noListScreen = document.getElementById('noListScreen');
const listScreen = document.getElementById('listScreen');
const adminPasswordInput = document.getElementById('adminPassword');
const accessBtn = document.getElementById('accessBtn');
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
let adminPassword = '';

// Verifica lista
document.addEventListener('DOMContentLoaded', function() {
    checkListStatus();
});

// Llamar a  API
async function callAPI(action, params = {}) {
    try {
        const urlParams = new URLSearchParams({
            action: action,
            ...params
        });
        
        const response = await fetch(`${API_URL}?${urlParams}`, {
            method: 'GET',
            mode: 'no-cors'
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error calling API:', error);
        return { success: false, error: error.message };
    }
}

async function getData(action) {
    try {
        const response = await fetch(`${API_URL}?action=${action}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting data:', error);
        return null;
    }
}

// Verifica si hay lista
async function checkListStatus() {
    const data = await getData('getListStatus');
    
    if (data && !data.error) {
        adminPassword = data.passwordAdmin;
        
        if (data.listaActiva) {
            showListScreen();
            loadPlayers();
            startAutoRefresh();
        } else {
            showNoListScreen();
        }
    } else {
        showNoListScreen();
    }
}

// Pantalla sin lista
function showNoListScreen() {
    noListScreen.classList.remove('hidden');
    listScreen.classList.add('hidden');
}

// Pantalla con lista activa
function showListScreen() {
    noListScreen.classList.add('hidden');
    listScreen.classList.remove('hidden');
}

// administrador
accessBtn.addEventListener('click', async function() {
    const password = adminPasswordInput.value.trim();
    
    if (password === adminPassword) {
        const result = await callAPI('createList');
        if (result.success) {
            showListScreen();
            loadPlayers();
            startAutoRefresh();
        }
    } else {
        alert('Contraseña incorrecta');
        adminPasswordInput.value = '';
    }
});

// Cerrar lista
closeListBtn.addEventListener('click', async function() {
    if (confirm('¿Estás segura de que quieres cerrar la lista?')) {
        const result = await callAPI('closeList');
        if (result.success) {
            showNoListScreen();
        }
    }
});

// Añadir jugador
addPlayerBtn.addEventListener('click', addPlayer);
playerNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addPlayer();
    }
});

async function addPlayer() {
    const playerName = playerNameInput.value.trim();
    
    if (playerName === '') {
        alert('Por favor escribe un nombre');
        return;
    }
    
    if (playerName.length > 30) {
        alert('El nombre es demasiado largo (máximo 30 caracteres)');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}?action=addPlayer&playerName=${encodeURIComponent(playerName)}`);
        const result = await response.json();
        
        if (result.success) {
            playerNameInput.value = '';
            playerNameInput.focus();
            loadPlayers();
        } else if (result.error) {
            alert(result.error);
        }
    } catch (error) {
        console.error('Error adding player:', error);
        loadPlayers();
    }
}

// Cargar lista de jugadores
async function loadPlayers() {
    const data = await getData('getPlayers');
    
    if (data && !data.error) {
        renderPlayers(data.players || []);
    }
}

// Renderiza jugadores en las listas
function renderPlayers(players) {
    attendingList.innerHTML = '';
    waitingList.innerHTML = '';
    
    const MAX_PLAYERS = 12;
    
    // Actualiza contador
    const attendingCount = Math.min(players.length, MAX_PLAYERS);
    listCount.textContent = `${attendingCount}/${MAX_PLAYERS}`;
    
    players.forEach((player, index) => {
        const playerElement = document.createElement('div');
        playerElement.className = `player-item ${index >= MAX_PLAYERS ? 'waiting' : ''}`;
        playerElement.innerHTML = `
            <span class="player-number">${index + 1}.</span>
            ${player}
        `;
        
        playerElement.addEventListener('click', () => {
            showExitModal(player);
        });
        
        if (index < MAX_PLAYERS) {
            attendingList.appendChild(playerElement);
        } else {
            waitingList.appendChild(playerElement);
        }
    });
    
    // Espacios vacíos en lista principal
    for (let i = players.length; i < MAX_PLAYERS; i++) {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'player-item';
        emptySlot.innerHTML = `
            <span class="player-number">${i + 1}.</span>
            [VACIO]
        `;
        emptySlot.style.opacity = '0.6';
        emptySlot.style.cursor = 'default';
        attendingList.appendChild(emptySlot);
    }
}

// Salir de lista
function showExitModal(playerName) {
    currentPlayerToRemove = playerName;
    playerToRemove.textContent = playerName;
    exitModal.classList.remove('hidden');
}

// Ocultar modal
function hideExitModal() {
    exitModal.classList.add('hidden');
    currentPlayerToRemove = null;
}

// Eventos del modal
cancelExitBtn.addEventListener('click', hideExitModal);
confirmExitBtn.addEventListener('click', removePlayer);

// Remover jugador de lista
async function removePlayer() {
    if (!currentPlayerToRemove) return;
    
    try {
        const response = await fetch(`${API_URL}?action=removePlayer&playerName=${encodeURIComponent(currentPlayerToRemove)}`);
        const result = await response.json();
        
        if (result.success) {
            hideExitModal();
            loadPlayers();
        } else if (result.error) {
            alert(result.error);
            hideExitModal();
        }
    } catch (error) {
        console.error('Error removing player:', error);
        alert('Error al remover jugador');
        hideExitModal();
    }
}

// Auto-refrescar cada 1 segundos
function startAutoRefresh() {
    setInterval(() => {
        loadPlayers();
    }, 1000);
}

exitModal.addEventListener('click', function(e) {
    if (e.target === exitModal) {
        hideExitModal();
    }
});