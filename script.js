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
let lastUpdateTimestamp = null;
let isListOpen = false;

// Al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    checkListStatus();
    startSmartRefresh();
});

// Verificar estado de la lista CON TIMESTAMP
async function checkListStatus() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'getListStatusWithTimestamp',
                lastTimestamp: lastUpdateTimestamp 
            })
        });
        
        if (!response.ok) {
            console.warn('Error en checkListStatus:', response.status);
            return;
        }
        
        const data = await response.json();
        
        // Solo actualizar jugadores si hubo cambios
        if (data.needsUpdate) {
            await loadPlayers();
            lastUpdateTimestamp = data.lastTimestamp;
        }
        
        // Mostrar pantalla correcta
        if (data.listaAbierta) {
            isListOpen = true;
            showListScreen();
        } else {
            isListOpen = false;
            showAccessScreen();
        }
    } catch (error) {
        console.warn('Error checkListStatus:', error);
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
        
        // Forzar actualización inmediata
        lastUpdateTimestamp = null;
        await checkListStatus();
        
        alert('✅ Lista abierta - Los jugadores ya pueden apuntarse');
        
    } catch (error) {
        console.error('Error abriendo lista:', error);
        alert('Error al abrir lista');
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
            
            // Forzar actualización para todos los dispositivos
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pingUpdate' })
            });
            
            // Actualizar localmente
            lastUpdateTimestamp = null;
            await loadPlayers();
            playerNameInput.focus();
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

// Configurar botón de confirmar salida (debes implementar removePlayer en sheets.js)
confirmExitBtn.addEventListener('click', async function() {
    if (!currentPlayerToRemove) return;
    
    // Aquí necesitarías implementar la acción removePlayer en sheets.js
    alert('Función de eliminar jugador pendiente de implementar');
    hideExitModal();
});

// Smart refresh - Check cada 30 segundos
function startSmartRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        checkListStatus();
    }, 30000); // 30 segundos
    
    console.log('Smart refresh iniciado - 30 segundos');
}

// También check después de interacciones del usuario
document.addEventListener('click', function() {
    // Si hay clic, checkear después de 5 segundos
    setTimeout(checkListStatus, 5000);
});

exitModal.addEventListener('click', function(e) {
    if (e.target === exitModal) hideExitModal();
});