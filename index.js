const MODULE_NAME = 'simulate-hud';

const defaultSettings = Object.freeze({
    enabled: false,
    bubbleX: null,
    bubbleY: null,
    stats: Object.freeze({
        energy:     { current: 100, max: 100 },
        sustenance: { current: 100, max: 100 },
        hygiene:    { current: 100, max: 100 },
        boosts: [],
    }),
});

let settingsCache = null;

function getSettings() {
    if (settingsCache) return settingsCache;

    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    const s = extensionSettings[MODULE_NAME].stats || {};
    for (const sk of ['energy', 'sustenance', 'hygiene']) {
        if (!s[sk]) s[sk] = structuredClone(defaultSettings.stats[sk]);
    }
    if (!Array.isArray(s.boosts)) s.boosts = [];

    settingsCache = extensionSettings[MODULE_NAME];
    return extensionSettings[MODULE_NAME];
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function getBubble() {
    return document.getElementById('simulate-hud-bubble');
}

function applyBubblePosition(el) {
    const settings = getSettings();
    if (settings.bubbleX !== null && settings.bubbleY !== null) {
        el.style.left = settings.bubbleX + 'px';
        el.style.top  = settings.bubbleY + 'px';
    }
}

function clampBubble(el) {
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth  - rect.width;
    const maxY = window.innerHeight - rect.height;
    const x = Math.min(Math.max(0, parseFloat(el.style.left) || 0), maxX);
    const y = Math.min(Math.max(0, parseFloat(el.style.top)  || 0), maxY);
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    return { x, y };
}

function makeDraggable(el, onTap) {
    let dragging = false;
    let hasMoved = false;
    let startClientX, startClientY;
    let startElemX, startElemY;

    function getClient(e) {
        return e.touches ? e.touches[0] : e;
    }

    function onStart(e) {
        if (e.touches && e.touches.length > 1) return;
        dragging = true;
        hasMoved = false;
        const pt = getClient(e);
        startClientX = pt.clientX;
        startClientY = pt.clientY;
        startElemX   = parseFloat(el.style.left) || 0;
        startElemY   = parseFloat(el.style.top)  || 0;
        el.classList.add('dragging');
        e.preventDefault();
    }

    function onMove(e) {
        if (!dragging) return;
        const pt = getClient(e);
        const dx = pt.clientX - startClientX;
        const dy = pt.clientY - startClientY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        el.style.left = (startElemX + dx) + 'px';
        el.style.top  = (startElemY + dy) + 'px';
        e.preventDefault();
    }

    function onEnd() {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('dragging');
        if (!hasMoved) {
            onTap && onTap();
            return;
        }
        const { x, y } = clampBubble(el);
        const { saveSettingsDebounced } = SillyTavern.getContext();
        const settings = getSettings();
        settings.bubbleX = x;
        settingsCache.bubbleX = x; // Update cache
        settings.bubbleY = y;
        settingsCache.bubbleY = y;
        saveSettingsDebounced();
    }

    // Touch
    el.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);

    // Mouse (desktop / devtools)
    el.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'vitals', label: 'Vitals', icon: 'fa-solid fa-heart-pulse' },
];

function getStatInfo(statId, current, max) {
    const pct = max > 0 ? current / max : 0;
    const info = {
        energy: {
            icon: 'fa-solid fa-bolt',
            color: pct > 0.5 ? '#6be86b' : pct > 0.3 ? '#e8d46b' : pct > 0.15 ? '#e8946b' : '#e86b6b',
            label: pct > 0.5 ? 'Normal' : pct > 0.3 ? 'Tired' : pct > 0.15 ? 'Exhausted' : current === 0 ? 'Passed Out' : 'Critical',
        },
        sustenance: {
            icon: 'fa-solid fa-utensils',
            color: pct >= 0.5 ? '#6be86b' : pct >= 0.25 ? '#e8d46b' : pct >= 0.1 ? '#e8a46b' : pct >= 0.01 ? '#e87a4a' : '#e86b6b',
            label: pct >= 0.5 ? 'Normal' : pct >= 0.25 ? 'Hungry' : pct >= 0.1 ? 'Very Hungry' : pct >= 0.01 ? 'Starving' : 'Critical',
        },
        hygiene: {
            icon: 'fa-solid fa-shower',
            color: pct >= 0.6 ? '#6be8d4' : pct >= 0.3 ? '#6ba8e8' : pct >= 0.1 ? '#e8c46b' : '#e86b6b',
            label: pct >= 0.6 ? 'Fresh' : pct >= 0.3 ? 'Noticeable' : pct >= 0.1 ? 'Dirty' : 'Very Dirty',
        },
    };
    return info[statId] || { icon: 'fa-solid fa-circle', color: '#aaa', label: '' };
}

function renderStatCard(statId, statName, data) {
    const { current, max } = data;
    const pct = max > 0 ? Math.min(1, current / max) : 0;
    const info = getStatInfo(statId, current, max);
    const barW = Math.round(pct * 100);
    return `
        <div class="shud-stat-card">
            <div class="shud-stat-header">
                <span class="shud-stat-name">
                    <i class="${info.icon}" style="color:${info.color}"></i> ${statName}
                </span>
                <span class="shud-stat-values">${current} / ${max}</span>
            </div>
            <div class="shud-bar-track">
                <div class="shud-bar-fill" style="width:${barW}%;background:${info.color}"></div>
            </div>
            <div class="shud-stat-status" style="color:${info.color}">${info.label}</div>
        </div>`;
}

function renderVitalsTab(stats) {
    const boosts = stats.boosts || [];
    const boostHTML = boosts.length === 0
        ? '<div class="shud-no-boosts">No active boosts</div>'
        : boosts.map(b => `
            <div class="shud-boost-item">
                <i class="fa-solid fa-arrow-up shud-boost-arrow"></i>
                <span class="shud-boost-label">${b.name}</span>
                <span class="shud-boost-effect">${b.stat} +${b.value}${b.temporary ? ' <span class="shud-boost-temp">(temp)</span>' : ''}</span>
            </div>`).join('');

    return `
        <div class="shud-tab-content" id="shud-tab-vitals">
            ${renderStatCard('energy',     'Energy',     stats.energy)}
            ${renderStatCard('sustenance', 'Sustenance', stats.sustenance)}
            ${renderStatCard('hygiene',    'Hygiene',    stats.hygiene)}
            <div class="shud-boosts-section">
                <div class="shud-boosts-title">
                    <i class="fa-solid fa-fire-flame-curved"></i> Active Boosts
                </div>
                <div class="shud-boosts-list">${boostHTML}</div>
            </div>
        </div>`;
}

function renderMenuContent(menu) {
    const settings = getSettings();
    const stats = settings.stats || defaultSettings.stats;

    const navItems = TABS.map((t, i) => `
        <button class="shud-tab-btn${i === 0 ? ' active' : ''}" data-tab="${t.id}">
            <i class="${t.icon}"></i> ${t.label}
        </button>`).join('');

    const body = menu.querySelector('.shud-menu-body');
    body.innerHTML = `
        <div class="shud-navbar">${navItems}</div>
        <div class="shud-tab-area">
            ${renderVitalsTab(stats)}
        </div>`;

    body.querySelectorAll('.shud-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            body.querySelectorAll('.shud-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// ── HUD Menu ──────────────────────────────────────────────────────────────────

function getMenu() {
    return document.getElementById('simulate-hud-menu');
}

function getOverlay() {
    return document.getElementById('simulate-hud-overlay');
}

function openMenu() {
    if (getOverlay()) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = Math.min(Math.round(vw * 0.85), 420);
    const menuH = Math.min(Math.round(vh * 0.68), 600);
    const menuLeft = Math.round((vw - menuW) / 2);
    const menuTop  = Math.round((vh - menuH) / 2);

    const overlay = document.createElement('div');
    overlay.id = 'simulate-hud-overlay';

    const menu = document.createElement('div');
    menu.id = 'simulate-hud-menu';
    menu.style.cssText = `width:${menuW}px;height:${menuH}px;left:${menuLeft}px;top:${menuTop}px;`;
    menu.innerHTML = `
        <div class="shud-menu-header">
            <span class="shud-menu-title">
                <i class="fa-solid fa-dragon"></i> Simulate HUD
            </span>
            <button class="shud-close-btn" id="simulate-hud-close">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="shud-menu-body"></div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    // Use document-level CAPTURE phase — fires before any stopPropagation in ST's own handlers.
    // Close if tap lands outside the menu element.
    const onDocTap = (e) => {
        if (!menu.contains(e.target)) closeMenu();
    };
    document.addEventListener('touchend', onDocTap, true);
    document.addEventListener('click',    onDocTap, true);
    // Store cleanup on the overlay so closeMenu can remove them
    overlay._cleanupTap = () => {
        document.removeEventListener('touchend', onDocTap, true);
        document.removeEventListener('click',    onDocTap, true);
    };

    menu.querySelector('#simulate-hud-close').addEventListener('click', closeMenu);
    renderMenuContent(menu);

    requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.classList.add('visible');
        menu.classList.add('visible');
    }));
}

function closeMenu() {
    const overlay = getOverlay();
    const menu    = getMenu();
    if (!overlay) return;

    // Remove document-level capture listeners first
    if (overlay._cleanupTap) overlay._cleanupTap();

    overlay.classList.remove('visible');
    menu.classList.remove('visible');

    overlay.addEventListener('transitionend', () => {
        overlay.remove();
        menu.remove();
    }, { once: true });
}

function toggleMenu() {
    getMenu() ? closeMenu() : openMenu();
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function createBubble() {
    if (getBubble()) return;

    const el = document.createElement('div');
    el.id = 'simulate-hud-bubble';
    el.innerHTML = '<i class="fa-solid fa-dragon"></i>';

    const settings = getSettings();
    if (settings.bubbleX !== null && settings.bubbleY !== null) {
        el.style.left = settings.bubbleX + 'px';
        el.style.top  = settings.bubbleY + 'px';
    } else {
        el.style.right  = '20px';
        el.style.bottom = '80px';
    }

    document.body.appendChild(el);
    makeDraggable(el, toggleMenu);
    console.log(`[${MODULE_NAME}] Bubble created`);
}

function destroyBubble() {
    const el = getBubble();
    if (el) {
        el.remove();
        console.log(`[${MODULE_NAME}] Bubble removed`);
    }
}

function syncBubble() {
    const settings = getSettings();
    if (settings.enabled) {
        createBubble();
    } else {
        destroyBubble();
    }
}

// ── Settings UI ───────────────────────────────────────────────────────────────

function onEnabledChange() {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    const settings = getSettings();
    settings.enabled = Boolean($('#simulate_hud_enabled').prop('checked'));
    saveSettingsDebounced();
    syncBubble();
}

function syncUI() {
    const settings = getSettings();
    $('#simulate_hud_enabled').prop('checked', settings.enabled);
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    console.log(`[${MODULE_NAME}] Loading...`);
    try {
        const { renderExtensionTemplateAsync } = SillyTavern.getContext();
        const html = await renderExtensionTemplateAsync(`third-party/${MODULE_NAME}`, 'settings');
        $('#extensions_settings2').append(html);

        $('#simulate_hud_enabled').on('change', onEnabledChange);

        syncUI();
        syncBubble();
        console.log(`[${MODULE_NAME}] Loaded successfully`);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to load:`, err);
    }
}

const { eventSource, event_types } = SillyTavern.getContext();
eventSource.on(event_types.APP_READY, init);
