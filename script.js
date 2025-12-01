// script.js - VERSIÓN FINAL OPTIMIZADA
const API_URL = '/.netlify/functions/sheets';

// Variables globales
let players = [];
let lastUpdateTimestamp = null;
let myNameInList = null; // Para saber si YA estoy apuntado
let isSubscribed = false; // Para saber si debo seguir haciendo polling

// Polling DINÁMICO basado en estado
function startDynamicPolling() {
    let interval = 5000; // 5 segundos base
    
    setInterval(async () => {
        // Si YA estoy apuntado, poll más lento
        if (myNameInList) {
            interval = 15000; // 15 segundos
        } else {
            interval = 5000; // 5 segundos (buscando apuntarse)
        }
        
        await checkListStatus();
    }, interval);
}

// Verificar estado
async function checkListStatus() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'getListStatusWithPlayers', // NUEVA ACCIÓN
                lastTimestamp: lastUpdateTimestamp 
            })
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Actualizar si hay cambios
        if (data.needsUpdate) {
            players = data.players;
            renderPlayers(players);
            lastUpdateTimestamp = data.lastTimestamp;
            
            // Verificar si YO ya estoy en la lista
            const myName = localStorage.getItem('myPlayerName');
            if (myName && players.includes(myName)) {
                myNameInList = myName;
                showAlreadySubscribedMessage();
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

// Añadir jugador CON VERIFICACIÓN EN SERVER
async function addPlayer() {
    const playerName = playerNameInput.value.trim();
    
    if (!playerName) {
        alert('Por favor escribe un nombre');
        return;
    }
    
    // Guardar mi nombre
    localStorage.setItem('myPlayerName', playerName);
    
    try {
        // INTENTAR apuntarse (el server verifica si aún hay campo)
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'tryAddPlayer', 
                playerName,
                currentPlayers: players.length // Enviamos cuántos vemos
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // ¡Éxito! Actualizar inmediatamente
            playerNameInput.value = '';
            myNameInList = playerName;
            lastUpdateTimestamp = null;
            await checkListStatus();
            
            // Mostrar mensaje de confirmación
            showSuccessMessage(playerName);
            
        } else if (data.error === 'Lista llena') {
            alert('❌ La lista ya está llena. Estás en lista de espera.');
            // Aún así agregar a lista de espera
            myNameInList = playerName;
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

// Mostrar mensaje de "ya estás apuntado"
function showAlreadySubscribedMessage() {
    // Podemos mostrar un banner o cambiar el UI
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
    }
}

// Salir de la lista
async function exitList() {
    if (!myNameInList) return;
    
    if (confirm(`¿Quieres salir de la lista, ${myNameInList}?`)) {
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'removePlayer', playerName: myNameInList })
            });
            
            localStorage.removeItem('myPlayerName');
            myNameInList = null;
            lastUpdateTimestamp = null;
            await checkListStatus();
            
            // Remover mensaje
            const msg = document.getElementById('alreadySubscribedMsg');
            if (msg) msg.remove();
            
        } catch (error) {
            console.error('Error saliendo:', error);
        }
    }
}

// Mostrar mensaje de éxito
function showSuccessMessage(playerName) {
    alert(`✅ ${playerName} apuntado correctamente. Puedes cerrar la página.`);
}