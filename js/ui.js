import { CONFIG } from './config.js';

const RED_BALL_IMG = `<img src="balon-voley.png" alt="Balón" class="v-ball-img delete-ball">`;

const renderedItems = new Map();
let hasLoadedOnce = false;

function createPlayerElement(player, jerseyNum, onRemoveClick, staggerIndex) {
    const el = document.createElement('div');
    el.className = 'player-item';
    el.style.animationDelay = `${Math.min(staggerIndex * 0.08, 0.6)}s`;

    el.innerHTML = `
        <div class="player-info">
            <span class="jersey">${jerseyNum}</span>
            <span class="name-text"></span>
        </div>
        <div class="card-cover" style="animation-delay:${Math.min(staggerIndex * 0.08, 0.6) + 0.1}s"></div>
        <button class="btn-exit single-ball-btn" type="button" aria-label="Quitar jugador" style="animation-delay:${Math.min(staggerIndex * 0.08, 0.6) + 0.1}s">
            ${RED_BALL_IMG}
        </button>
    `;

    el.querySelector('.name-text').textContent = player.nombre;
    el.querySelector('.btn-exit').onclick = () => onRemoveClick(player);

    return el;
}

function updateJerseyNumber(el, jerseyNum) {
    const badge = el.querySelector('.jersey');
    if (badge && badge.textContent !== String(jerseyNum)) {
        badge.textContent = jerseyNum;
    }
}

function animateOut(el) {
    if (!el || !el.parentElement) return;

    const cover = el.querySelector('.card-cover');
    const btn = el.querySelector('.single-ball-btn');
    if (cover) cover.style.animationDelay = '0s';
    if (btn) btn.style.animationDelay = '0s';

    el.classList.add('is-leaving');

    let removed = false;
    const cleanup = () => {
        if (removed) return;
        removed = true;
        el.remove();
    };

    el.addEventListener('animationend', (e) => {
        if (e.animationName === 'fadeOutItem') {
            cleanup();
        }
    });

    setTimeout(cleanup, 1600);
}

export const ui = {
    showInitialLoader() {
        const attendingList = document.getElementById('attendingList');
        if (!attendingList || document.getElementById('initialLoader')) return;
        const loader = document.createElement('div');
        loader.id = 'initialLoader';
        loader.className = 'list-loader';
        loader.innerHTML = `<span class="v-ball-loader">${RED_BALL_IMG}</span><span>Cargando jugadores...</span>`;
        attendingList.appendChild(loader);
    },

    renderPlayers(players, onRemoveClick) {
        const attendingList = document.getElementById('attendingList');
        const waitingList = document.getElementById('waitingList');
        const listCount = document.getElementById('listCount');

        const loader = document.getElementById('initialLoader');
        if (loader) loader.remove();

        const currentIds = new Set(players.map(p => p.id));

        for (const [id, entry] of renderedItems) {
            if (!currentIds.has(id)) {
                animateOut(entry.el);
                renderedItems.delete(id);
            }
        }

        let newCount = 0;
        players.forEach((player, index) => {
            const jerseyNum = index + 1;
            const targetSection = index < CONFIG.MAX_PLAYERS ? attendingList : waitingList;
            let entry = renderedItems.get(player.id);

            if (!entry) {
                const el = createPlayerElement(player, jerseyNum, onRemoveClick, newCount);
                entry = { el, section: targetSection };
                renderedItems.set(player.id, entry);
                targetSection.appendChild(el);
                newCount++;
            } else {
                updateJerseyNumber(entry.el, jerseyNum);
                entry.section = targetSection;
            }
        });

        players.slice(0, CONFIG.MAX_PLAYERS).forEach(p => {
            const entry = renderedItems.get(p.id);
            if (entry) attendingList.appendChild(entry.el);
        });
        players.slice(CONFIG.MAX_PLAYERS).forEach(p => {
            const entry = renderedItems.get(p.id);
            if (entry) waitingList.appendChild(entry.el);
        });

        const total = Math.min(players.length, CONFIG.MAX_PLAYERS);
        listCount.innerText = `${total}/${CONFIG.MAX_PLAYERS}`;
        listCount.classList.toggle('full', total >= CONFIG.MAX_PLAYERS);

        hasLoadedOnce = true;
    },

    renderHistory(historyItems) {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        historyList.innerHTML = '';
        historyItems.forEach(item => {
            const li = document.createElement('li');
            li.className = `history-item ${item.tipo || 'info'}`;
            
            const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            li.innerHTML = `<span class="time">[${time}]</span> <span class="msg">${item.mensaje}</span>`;
            historyList.appendChild(li);
        });
    },

    toggleLoading(isLoading, secondsLeft = 0, totalSeconds = CONFIG.COOLDOWN_TIME / 1000) {
        const btn = document.getElementById('addPlayerBtn');
        const btnText = btn.querySelector('.btn-text');
        const timerText = document.getElementById('cooldownTimer');

        if (isLoading) {
            btn.disabled = true;
            btnText.classList.add('hidden');
            timerText.classList.remove('hidden');
            timerText.innerText = `${secondsLeft}s`;
            const progress = Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100);
            btn.style.setProperty('--progress', `${progress}%`);
        } else {
            btn.disabled = false;
            btnText.classList.remove('hidden');
            timerText.classList.add('hidden');
            btn.style.setProperty('--progress', '0%');
        }
    },

    showToast(message, type = 'default') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast${type === 'error' ? ' error' : ''}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('leaving');
            toast.addEventListener('animationend', () => toast.remove(), { once: true });
        }, 3200);
    },

    openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        void modal.offsetHeight;
        modal.classList.add('show');
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 320);
    }
};