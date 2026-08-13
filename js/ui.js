import { CONFIG } from './config.js';

const BALL_SVG = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="17.5" fill="currentColor" stroke="#0d1730" stroke-width="1.4"/>
    <path d="M20 2.5 C 11 9, 11 31, 20 37.5" fill="none" stroke="#0d1730" stroke-width="1.4"/>
    <path d="M20 2.5 C 29 9, 29 31, 20 37.5" fill="none" stroke="#0d1730" stroke-width="1.4"/>
    <path d="M3 17 C 11 12, 29 12, 37 17" fill="none" stroke="#0d1730" stroke-width="1.4"/>
    <path d="M3 23 C 11 28, 29 28, 37 23" fill="none" stroke="#0d1730" stroke-width="1.4"/>
</svg>`;

const X_SVG = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

// Estado persistente entre renders: id -> { el, section }
const renderedItems = new Map();
let hasLoadedOnce = false;

function createPlayerElement(player, jerseyNum, onRemoveClick, staggerIndex) {
    const el = document.createElement('div');
    el.className = 'player-item';
    el.style.animationDelay = `${Math.min(staggerIndex * 0.06, 0.5)}s`;

    el.innerHTML = `
        <div class="player-info">
            <span class="jersey">${jerseyNum}</span>
            <span class="name-wrap">
                <span class="name-text"></span>
                <span class="name-cover" style="animation-delay:${Math.min(staggerIndex * 0.06, 0.5) + 0.15}s">
                    <span class="v-ball">${BALL_SVG}</span>
                </span>
            </span>
        </div>
        <button class="btn-exit" type="button" aria-label="Quitar jugador">${X_SVG}</button>
    `;

    // El nombre se inserta como texto (evita inyectar HTML del jugador)
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
    el.style.height = el.offsetHeight + 'px';
    el.style.overflow = 'hidden';
    // Forzar reflow antes de animar
    void el.offsetHeight;
    requestAnimationFrame(() => {
        el.classList.add('is-leaving');
        el.style.height = '0px';
        el.style.marginBottom = '0px';
        el.style.paddingTop = '0px';
        el.style.paddingBottom = '0px';
    });
    let removed = false;
    const cleanup = () => {
        if (removed) return;
        removed = true;
        el.remove();
    };
    el.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 500); // por si el transitionend no dispara
}

export const ui = {
    showInitialLoader() {
        const attendingList = document.getElementById('attendingList');
        if (!attendingList || document.getElementById('initialLoader')) return;
        const loader = document.createElement('div');
        loader.id = 'initialLoader';
        loader.className = 'list-loader';
        loader.innerHTML = `<span class="v-ball">${BALL_SVG}</span><span>Cargando jugadores...</span>`;
        attendingList.appendChild(loader);
    },

    renderPlayers(players, onRemoveClick) {
        const attendingList = document.getElementById('attendingList');
        const waitingList = document.getElementById('waitingList');
        const listCount = document.getElementById('listCount');

        const loader = document.getElementById('initialLoader');
        if (loader) loader.remove();

        const currentIds = new Set(players.map(p => p.id));

        // Quitar (con animacion) a quienes ya no estan
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

        // Reordenar cada seccion segun el orden real de jugadores
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
        void modal.offsetHeight; // reflow para que la transicion se dispare
        modal.classList.add('show');
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 320);
    }
};