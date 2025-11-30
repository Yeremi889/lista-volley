// URL de tu Google Apps Script Web App
const API_URL = 'https://script.google.com/macros/s/AKfycbzzM6_gWScIgfDKSP37d725JJzYRk71s6Pr50W1wIHTJVOL_BX-IFHkkrWyH6FAJ1QIDQ/exec';

// Referencias a elementos del DOM
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
let adminPassword = 'voley2024';
let players = [];
let listaActiva = false;

// Verificar estado de la lista al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    checkListStatus();
});

// Función para verificar el estado de la lista
function checkListStatus() {
    // Crear iframe temporal para verificar estado
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = API_URL + '?action=getListStatus&callback=handleStatusData';
    document.body.appendChild(iframe);
    
    // Remover el iframe después de un tiempo
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 5000);
}

// Esta función será llamada por el callback del estado
window.handleStatusData = function(data) {
    console.log('Estado de lista recibido:', data);
    
    if (data && !data.error) {
        listaActiva = data.listaActiva;
        adminPassword = data.passwordAdmin || 'voley2024';
        
        if (listaActiva) {
            console.log('✅ Lista activa - Mostrando pantalla de lista');
            showListScreen();
            // Cargar jugadores después de mostrar la pantalla
            setTimeout(loadPlayersWithIframe, 1000);
        } else {
            console.log('❌ No hay lista activa - Mostrando pantalla de admin');
            showNoListScreen();
        }
    } else {
        console.log('⚠️ Error al cargar estado - Mostrando pantalla de admin');
        showNoListScreen();
    }
};

// Función para cargar jugadores usando iframe
function loadPlayersWithIframe() {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = API_URL + '?action=getPlayers&callback=handlePlayersData';
    document.body.appendChild(iframe);
    
    // Remover el iframe después de un tiempo
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 5000);
}

// Esta función será llamada por el callback de jugadores
window.handlePlayersData = function(data) {
    console.log('Jugadores recibidos:', data);
    
    if (data && data.players) {
        players = data.players;
        renderPlayers(players);
        
        // Iniciar auto-refresh solo si hay lista activa
        if (listaActiva) {
            startAutoRefresh();
        }
    }
};

// Función simple para acciones que no necesitan respuesta
async function simpleAPICall(action, params = {}) {
    try {
        const urlParams = new URLSearchParams({
            action: action,
            ...params
        });
        
        // Usamos una imagen para evitar CORS (truco para requests simples)
        const img = new Image();
        img.src = API_URL + '?' + urlParams.toString();
        
        return { success: true };
    } catch (error) {
        console.error('Error in API call:', error);
        return { success: false };
    }
}

// Mostrar pantalla sin lista
function showNoListScreen() {
    noListScreen.classList.remove('hidden');
    listScreen.classList.add('hidden');
    exitModal.classList.add('hidden');
}

// Mostrar pantalla con lista activa
function showListScreen() {
    noListScreen.classList.add('hidden');
    listScreen.classList.remove('hidden');
    exitModal.classList.add('hidden');
}

// Acceso de administrador
accessBtn.addEventListener('click', async function() {
    const password = adminPasswordInput.value.trim();
    
    if (password === adminPassword) {
        // Crear lista
        const result = await simpleAPICall('createList');
        if (result.success) {
            listaActiva = true;
            showListScreen();
            // Limpiar jugadores locales
            players = [];
            renderPlayers(players);
            // Dar tiempo para que se cree la lista antes de cargar jugadores
            setTimeout(loadPlayersWithIframe, 2000);
        }
    } else {
        alert('❌ Contraseña incorrecta');
        adminPasswordInput.value = '';
    }
});

// Cerrar lista (solo admin)
closeListBtn.addEventListener('click', async function() {
    if (confirm('¿Estás segura de que quieres cerrar la lista?')) {
        const result = await simpleAPICall('closeList');
        if (result.success) {
            listaActiva = false;
            players = [];
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
    
    // Verificar si ya existe localmente
    if (players.includes(playerName)) {
        alert('⚠️ Este nombre ya está en la lista');
        return;
    }
    
    // Agregar localmente primero para feedback inmediato
    players.push(playerName);
    renderPlayers(players);
    
    // Luego enviar al servidor
    const result = await simpleAPICall('addPlayer', { playerName: playerName });
    
    if (result.success) {
        playerNameInput.value = '';
        playerNameInput.focus();
    } else {
        // Revertir si falla
        const index = players.indexOf(playerName);
        if (index > -1) {
            players.splice(index, 1);
            renderPlayers(players);
        }
        alert('Error al agregar jugador');
    }
}

// Renderizar jugadores en las listas
function renderPlayers(playersList) {
    attendingList.innerHTML = '';
    waitingList.innerHTML = '';
    
    const MAX_PLAYERS = 12;
    
    // Actualizar contador
    const attendingCount = Math.min(playersList.length, MAX_PLAYERS);
    listCount.textContent = `${attendingCount}/${MAX_PLAYERS}`;
    
    playersList.forEach((player, index) => {
        const playerElement = document.createElement('div');
        playerElement.className = `player-item ${index >= MAX_PLAYERS ? 'waiting' : ''}`;
        playerElement.innerHTML = `
            <span class="player-number">${index + 1}.</span>
            ${player}
        `;
        
        // Agregar evento para mostrar modal de salida
        playerElement.addEventListener('click', () => {
            showExitModal(player);
        });
        
        // Agregar a lista correspondiente
        if (index < MAX_PLAYERS) {
            attendingList.appendChild(playerElement);
        } else {
            waitingList.appendChild(playerElement);
        }
    });
    
    // Mostrar espacios vacíos en lista principal
    for (let i = playersList.length; i < MAX_PLAYERS; i++) {
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

// Mostrar modal para salir de lista
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

// Remover jugador de la lista
async function removePlayer() {
    if (!currentPlayerToRemove) return;
    
    // Remover localmente primero
    const index = players.indexOf(currentPlayerToRemove);
    if (index > -1) {
        players.splice(index, 1);
        renderPlayers(players);
    }
    
    // Luego enviar al servidor
    const result = await simpleAPICall('removePlayer', { playerName: currentPlayerToRemove });
    
    if (!result.success) {
        // Revertir si falla
        players.splice(index, 0, currentPlayerToRemove);
        renderPlayers(players);
        alert('Error al remover jugador');
    }
    
    hideExitModal();
}

// Auto-refrescar la lista cada 2 segundos (solo cuando hay lista activa)
function startAutoRefresh() {
    // Limpiar cualquier intervalo anterior
    if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
    }
    
    window.autoRefreshInterval = setInterval(() => {
        if (listaActiva) {
            loadPlayersWithIframe();
        } else {
            clearInterval(window.autoRefreshInterval);
        }
    }, 2000); // 2000 milisegundos = 2 segundos
}

// Función para actualización inmediata después de acciones
function refreshImmediately() {
    if (listaActiva) {
        // Cancelar el próximo refresh automático para evitar duplicados
        if (window.pendingRefresh) {
            clearTimeout(window.pendingRefresh);
        }
        // Programar refresh en 500ms (medio segundo)
        window.pendingRefresh = setTimeout(() => {
            loadPlayersWithIframe();
        }, 500);
    }
}

// En la función addPlayer(), DESPUÉS de agregar:
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
    
    // Verificar si ya existe localmente
    if (players.includes(playerName)) {
        alert('⚠️ Este nombre ya está en la lista');
        return;
    }
    
    // Agregar localmente primero para feedback inmediato
    players.push(playerName);
    renderPlayers(players);
    
    // Luego enviar al servidor
    const result = await simpleAPICall('addPlayer', { playerName: playerName });
    
    if (result.success) {
        playerNameInput.value = '';
        playerNameInput.focus();
        // ACTUALIZACIÓN INMEDIATA después de agregar
        refreshImmediately();
    } else {
        // Revertir si falla
        const index = players.indexOf(playerName);
        if (index > -1) {
            players.splice(index, 1);
            renderPlayers(players);
        }
        alert('Error al agregar jugador');
    }
}

// En la función removePlayer(), DESPUÉS de remover:
async function removePlayer() {
    if (!currentPlayerToRemove) return;
    
    // Remover localmente primero
    const index = players.indexOf(currentPlayerToRemove);
    if (index > -1) {
        players.splice(index, 1);
        renderPlayers(players);
    }
    
    // Luego enviar al servidor
    const result = await simpleAPICall('removePlayer', { playerName: currentPlayerToRemove });
    
    if (!result.success) {
        // Revertir si falla
        players.splice(index, 0, currentPlayerToRemove);
        renderPlayers(players);
        alert('Error al remover jugador');
    }
    
    // ACTUALIZACIÓN INMEDIATA después de remover
    refreshImmediately();
    hideExitModal();
}

// Cerrar modal haciendo clic fuera
exitModal.addEventListener('click', function(e) {
    if (e.target === exitModal) {
        hideExitModal();
    }
});