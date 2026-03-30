import { CONFIG } from './config.js';

export const ui = {
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
                <div><b>${index + 1}.</b> &nbsp; ${player.nombre}</div>
                <button class="btn-exit">❌</button>
            `;
            playerElement.querySelector('.btn-exit').onclick = () => onRemoveClick(player);

            if (index < CONFIG.MAX_PLAYERS) attendingList.appendChild(playerElement);
            else waitingList.appendChild(playerElement);
        });

        listCount.innerText = `${Math.min(players.length, CONFIG.MAX_PLAYERS)}/${CONFIG.MAX_PLAYERS}`;
    },

    toggleLoading(isLoading, seconds = 0) {
        const btn = document.getElementById('addPlayerBtn');
        const btnText = btn.querySelector('.btn-text');
        const timerText = document.getElementById('cooldownTimer');

        if (isLoading) {
            btn.disabled = true;
            btnText.classList.add('hidden');
            timerText.classList.remove('hidden');
            timerText.innerText = `${seconds}s`;
        } else {
            btn.disabled = false;
            btnText.classList.remove('hidden');
            timerText.classList.add('hidden');
        }
    }
};