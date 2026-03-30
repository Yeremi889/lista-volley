import { CONFIG } from './config.js';

export const ui = {
    /**
     * Renderiza listas (Convocados y Espera)
     * @param {Array} players - Lista de objetos de jugadores de la DB
     * @param {Function} onRemoveClick - Función que se dispara al querer quitarse
     */
    renderPlayers(players, onRemoveClick) {
        const attendingList = document.getElementById('attendingList');
        const waitingList = document.getElementById('waitingList');
        const listCount = document.getElementById('listCount');

        attendingList.innerHTML = '';
        waitingList.innerHTML = '';

        players.forEach((player, index) => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            
            playerElement.innerHTML = `
                <div class="player-info">
                    <span style="font-weight: bold; color: var(--secondary); margin-right: 8px;">${index + 1}.</span>
                    <span style="text-transform: capitalize;">${player.nombre}</span>
                </div>
                <button class="btn-exit" title="Quitarme de la lista">❌</button>
            `;

            // botón de la X
            const exitBtn = playerElement.querySelector('.btn-exit');
            exitBtn.onclick = () => onRemoveClick(player);

            // Decidimos en qué lista va (12 o el resto)
            if (index < CONFIG.MAX_PLAYERS) {
                attendingList.appendChild(playerElement);
            } else {
                // Estilo visual extra para los que están en espera
                playerElement.style.borderLeft = "5px solid #f59e0b"; 
                waitingList.appendChild(playerElement);
            }
        });

        // contador visual (Ej: 5/12)
        const currentCount = Math.min(players.length, CONFIG.MAX_PLAYERS);
        listCount.innerText = `${currentCount}/${CONFIG.MAX_PLAYERS}`;
    },

    /**
     * Maneja el estado visual del botón de Enlistar durante el Cooldown
     */
    toggleLoading(button, isLoading, seconds = 0) {
        const btnText = button.querySelector('.btn-text');
        const timerText = document.getElementById('cooldownTimer');

        if (isLoading) {
            button.disabled = true;
            if (btnText) btnText.classList.add('hidden');
            if (timerText) {
                timerText.classList.remove('hidden');
                timerText.innerText = `${seconds}s`;
            }
        } else {
            button.disabled = false;
            if (btnText) btnText.classList.remove('hidden');
            if (timerText) timerText.classList.add('hidden');
        }
    }
};