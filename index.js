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
    world: Object.freeze({
        time: '12:00 PM',
        date: 'Mon, 01/01/25',
        weather: 'Clear',
        location: 'Unknown',
        money: Object.freeze({ amount: 0, currency: 'G' }),
    }),
});

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = structuredClone(defaultSettings[key]);
        }
    }
    const s = extensionSettings[MODULE_NAME].stats;
    for (const sk of ['energy', 'sustenance', 'hygiene']) {
        if (!s[sk]) s[sk] = structuredClone(defaultSettings.stats[sk]);
    }
    if (!Array.isArray(s.boosts)) s.boosts = [];

    // Ensure world object exists with all keys
    const w = extensionSettings[MODULE_NAME].world;
    if (!w || typeof w !== 'object') {
        extensionSettings[MODULE_NAME].world = structuredClone(defaultSettings.world);
    } else {
        for (const wk of Object.keys(defaultSettings.world)) {
            if (!Object.hasOwn(w, wk)) w[wk] = structuredClone(defaultSettings.world[wk]);
        }
        if (!w.money || typeof w.money !== 'object') {
            w.money = structuredClone(defaultSettings.world.money);
        }
    }

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
        settings.bubbleY = y;
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
    { id: 'world',  label: 'World',  icon: 'fa-solid fa-globe' },
];

let activeTabId = TABS[0].id;

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

function renderInfoRow(icon, label, value, valueColor) {
    const colorStyle = valueColor ? ` style="color:${valueColor}"` : '';
    return `
        <div class="shud-info-row">
            <span class="shud-info-icon"><i class="${icon}"></i></span>
            <span class="shud-info-label">${label}</span>
            <span class="shud-info-value"${colorStyle}>${value}</span>
        </div>`;
}

function renderWorldTab(world) {
    const money = world.money || { amount: 0, currency: 'G' };
    const moneyStr = `${Number(money.amount).toLocaleString()} ${money.currency}`;
    return `
        <div class="shud-tab-content" id="shud-tab-world">
            <div class="shud-info-card">
                ${renderInfoRow('fa-solid fa-clock',       'Time',     `${world.time} | ${world.date}`)}
                ${renderInfoRow('fa-solid fa-cloud-sun',   'Weather',  world.weather)}
                ${renderInfoRow('fa-solid fa-location-dot','Location', world.location)}
                ${renderInfoRow('fa-solid fa-coins',       'Money',    moneyStr, '#e8c46b')}
            </div>
        </div>`;
}

function renderTabBody(tabId, settings) {
    switch (tabId) {
        case 'world':
            return renderWorldTab(settings.world || defaultSettings.world);
        case 'vitals':
        default:
            return renderVitalsTab(settings.stats || defaultSettings.stats);
    }
}

function renderMenuContent(menu) {
    const settings = getSettings();

    const navItems = TABS.map(t => `
        <button class="shud-tab-btn${t.id === activeTabId ? ' active' : ''}" data-tab="${t.id}">
            <i class="${t.icon}"></i> ${t.label}
        </button>`).join('');

    const body = menu.querySelector('.shud-menu-body');
    body.innerHTML = `
        <div class="shud-navbar">${navItems}</div>
        <div class="shud-tab-area">
            ${renderTabBody(activeTabId, settings)}
        </div>`;

    body.querySelectorAll('.shud-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId === activeTabId) return;
            activeTabId = tabId;
            body.querySelectorAll('.shud-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const area = body.querySelector('.shud-tab-area');
            if (area) area.innerHTML = renderTabBody(activeTabId, settings);
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

// ── Prompt Interceptor (inject HUD instruction) ───────────────────────────────

const HUD_INSTRUCTION = `[SYSTEM — Simulate HUD]
At the very end of EVERY reply, you MUST append a fenced code block tagged "hud-stats" containing a single JSON object with the character's current vitals. Format:
\`\`\`hud-stats
{"energy": <0-100>, "sustenance": <0-100>, "hygiene": <0-100>}
\`\`\`
Rules:
- Values are integers 0..100 reflecting the character's realistic state after the events of this reply.
- This block is machine-read by the UI and must be the LAST thing in your message.
- Never mention or describe these stats outside the block.
- Keep roleplaying normally above the block.`;

globalThis.simulateHudInterceptor = async function (chat, contextSize, abort, type) {
    // Only inject for normal replies, not background/quiet/impersonate generations.
    if (type === 'quiet' || type === 'impersonate') return;

    const systemNote = {
        is_user: false,
        is_system: true,
        name: 'system',
        send_date: Date.now(),
        mes: HUD_INSTRUCTION,
    };

    // Insert before the last message (the pending user turn) so the model sees it.
    chat.splice(chat.length - 1, 0, systemNote);
};

// ── HUD block parsing & stat update ───────────────────────────────────────────

const HUD_BLOCK_REGEX = /```hud-stats\s*([\s\S]*?)```/i;

function parseHudBlock(mes) {
    if (typeof mes !== 'string') return { json: null, cleaned: mes };
    const match = mes.match(HUD_BLOCK_REGEX);
    if (!match) return { json: null, cleaned: mes };

    let json = null;
    try {
        json = JSON.parse(match[1].trim());
    } catch {
        json = null;
    }
    const cleaned = mes.replace(HUD_BLOCK_REGEX, '').replace(/\s+$/, '\n').trimEnd();
    return { json, cleaned };
}

function applyHudStats(json) {
    if (!json || typeof json !== 'object') return false;
    const settings = getSettings();
    const stats = settings.stats;
    let changed = false;
    for (const key of ['energy', 'sustenance', 'hygiene']) {
        if (typeof json[key] === 'number' && Number.isFinite(json[key])) {
            const max = stats[key]?.max ?? 100;
            const clamped = Math.max(0, Math.min(max, Math.round(json[key])));
            if (stats[key].current !== clamped) {
                stats[key].current = clamped;
                changed = true;
            }
        }
    }
    return changed;
}

function refreshMenuIfOpen() {
    const menu = getMenu();
    if (menu) renderMenuContent(menu);
}

function onMessageReceived(data) {
    try {
        const { chat, saveSettingsDebounced } = SillyTavern.getContext();
        // Resolve the message object defensively (event data shape varies).
        let message = null;
        if (data && typeof data === 'object') {
            message = data.message ?? data.mes ?? null;
        }
        if (!message && Array.isArray(chat) && chat.length > 0) {
            // Fallback: last non-user message.
            for (let i = chat.length - 1; i >= 0; i--) {
                if (!chat[i].is_user) { message = chat[i]; break; }
            }
        }
        if (!message || typeof message.mes !== 'string') return;

        const { json, cleaned } = parseHudBlock(message.mes);
        if (json) {
            const changed = applyHudStats(json);
            if (changed) saveSettingsDebounced();
            console.debug(`[${MODULE_NAME}] HUD stats updated:`, json);
        } else if (HUD_BLOCK_REGEX.test(message.mes)) {
            console.warn(`[${MODULE_NAME}] Failed to parse hud-stats block`);
        }

        // Strip the block from the message so it never renders or pollutes context.
        if (cleaned !== message.mes) {
            message.mes = cleaned;
        }

        refreshMenuIfOpen();
    } catch (err) {
        console.error(`[${MODULE_NAME}] onMessageReceived error:`, err);
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
        const { renderExtensionTemplateAsync, eventSource, event_types } = SillyTavern.getContext();
        const html = await renderExtensionTemplateAsync(`third-party/${MODULE_NAME}`, 'settings');
        $('#extensions_settings2').append(html);

        $('#simulate_hud_enabled').on('change', onEnabledChange);

        eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);

        syncUI();
        syncBubble();
        console.log(`[${MODULE_NAME}] Loaded successfully`);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to load:`, err);
    }
}

const { eventSource, event_types } = SillyTavern.getContext();
eventSource.on(event_types.APP_READY, init);
