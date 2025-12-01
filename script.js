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
let myNameInList = null;
let autoRefreshInterval;

// Al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si ya tengo nombre guardado
    myNameInList = localStorage.getItem('myPlayerName');
    
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

// Polling inteligente
function startSmartPolling() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Si ya estoy apuntado, poll más lento
    const interval = myNameInList ? 15000 : 7000;
    
    autoRefreshInterval = setInterval(() => {
        checkListStatus();
    }, interval);
    
    console.log(`Polling cada ${interval/1000} segundos`);
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
            
            // Verificar si mi nombre está en la lista
            if (myNameInList && players.includes(myNameInList)) {
                showAlreadySubscribedMessage();
            } else if (myNameInList) {
                // Mi nombre ya no está (quizás me quitaron)
                myNameInList = null;
                localStorage.removeItem('myPlayerName');
                hideAlreadySubscribedMessage();
            }
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
    
    // Guardar mi nombre
    localStorage.setItem('myPlayerName', playerName);
    myNameInList = playerName;
    
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
            
            // Cambiar a polling lento
            startSmartPolling();
            
            alert(`✅ ${playerName} apuntado correctamente`);
            
        } else if (data.error === 'Lista llena') {
            alert('⚠️ La lista principal está llena. Estás en lista de espera.');
            lastUpdateTimestamp = null;
            await checkListStatus();
            startSmartPolling();
            
        } else if (data.error === 'Ya existe') {
            alert('⚠️ Este nombre ya está en la lista');
            myNameInList = playerName;
            startSmartPolling();
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
            myNameInList = null;
            localStorage.removeItem('myPlayerName');
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
        
        // Solo permitir salir si es mi nombre
        if (player === myNameInList) {
            playerElement.style.cursor = 'pointer';
            playerElement.addEventListener('click', () => showExitModal(player));
        } else {
            playerElement.style.cursor = 'default';
        }
        
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

// Mostrar mensaje "ya estás apuntado"
function showAlreadySubscribedMessage() {
    const addPlayerDiv = document.querySelector('.add-player');
    if (addPlayerDiv && !document.getElementById('alreadySubscribedMsg')) {
        const msg = document.createElement('div');
        msg.id = 'alreadySubscribedMsg';
        msg.innerHTML = `
            <div style="background: #d4edda; color: #155724; padding: 10px; 
                       border-radius: 5px; margin-top: 10px; text-align: center;">
                ✅ <strong>${myNameInList}</strong> ya estás en la lista.
                <button onclick="exitList()" style="margin-left: 10px; padding: 5px 10px; 
                       background: #dc3545; color: white; border: none; border-radius: 3px;">
                    Salir
                </button>
            </div>
        `;
        addPlayerDiv.appendChild(msg);
        
        // Ocultar input de nombre
        playerNameInput.style.display = 'none';
        addPlayerBtn.style.display = 'none';
    }
}

// Ocultar mensaje
function hideAlreadySubscribedMessage() {
    const msg = document.getElementById('alreadySubscribedMsg');
    if (msg) msg.remove();
    
    // Mostrar input de nuevo
    playerNameInput.style.display = '';
    addPlayerBtn.style.display = '';
}

// Salir de la lista
async function exitList() {
    if (!myNameInList) return;
    
    if (confirm(`¿Quieres salir de la lista, ${myNameInList}?`)) {
        try {
            // Primero implementa removePlayer en sheets.js
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'removePlayer', playerName: myNameInList })
            });
            
            localStorage.removeItem('myPlayerName');
            myNameInList = null;
            lastUpdateTimestamp = null;
            await checkListStatus();
            startSmartPolling();
            
        } catch (error) {
            console.error('Error saliendo:', error);
            alert('Error al salir de la lista');
        }
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

// Para el botón global de exitList
window.exitList = exitList;

// Función removePlayer pendiente (necesita implementarse en sheets.js)
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
            // Si salgo yo, actualizar estado
            if (currentPlayerToRemove === myNameInList) {
                myNameInList = null;
                localStorage.removeItem('myPlayerName');
                startSmartPolling();
            }
            
            lastUpdateTimestamp = null;
            await checkListStatus();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar jugador');
    }
    
    hideExitModal();
}