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
    guide: Object.freeze({
        tasks: [],
        shouldDo: '',
        hint: '',
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

    // Ensure guide object exists with all keys
    const g = extensionSettings[MODULE_NAME].guide;
    if (!g || typeof g !== 'object') {
        extensionSettings[MODULE_NAME].guide = structuredClone(defaultSettings.guide);
    } else {
        if (!Array.isArray(g.tasks)) g.tasks = [];
        if (typeof g.shouldDo !== 'string') g.shouldDo = '';
        if (typeof g.hint !== 'string') g.hint = '';
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
    { id: 'guide',  label: 'Guide',  icon: 'fa-solid fa-compass' },
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

function renderGuideTab(guide) {
    const tasks = Array.isArray(guide.tasks) ? guide.tasks : [];
    const taskHTML = tasks.length === 0
        ? '<div class="shud-guide-empty">None</div>'
        : tasks.map((t, i) => `
            <details class="shud-task-item">
                <summary class="shud-task-summary">
                    <span class="shud-task-name">${t.name || 'Untitled Task'}</span>
                    <button class="shud-task-delete" data-task-index="${i}" title="Remove quest">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </summary>
                <div class="shud-task-content">${t.content || ''}</div>
            </details>`).join('');

    const shouldDo = guide.shouldDo && guide.shouldDo.length > 0 ? guide.shouldDo : '—';
    const hint = guide.hint && guide.hint.length > 0 ? guide.hint : '—';

    return `
        <div class="shud-tab-content" id="shud-tab-guide">
            <div class="shud-guide-section">
                <div class="shud-guide-title">
                    <i class="fa-solid fa-list-check"></i> Task / Quest
                </div>
                <div class="shud-guide-body">${taskHTML}</div>
            </div>
            <div class="shud-guide-section">
                <div class="shud-guide-title">
                    <i class="fa-solid fa-arrow-right"></i> What you should do
                </div>
                <div class="shud-guide-body shud-guide-text">${shouldDo}</div>
            </div>
            <div class="shud-guide-section">
                <div class="shud-guide-title">
                    <i class="fa-solid fa-lightbulb"></i> Hint
                </div>
                <div class="shud-guide-body shud-guide-text">${hint}</div>
            </div>
        </div>`;
}

function renderTabBody(tabId, settings) {
    switch (tabId) {
        case 'world':
            return renderWorldTab(settings.world || defaultSettings.world);
        case 'guide':
            return renderGuideTab(settings.guide || defaultSettings.guide);
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
            attachGuideHandlers(body);
        });
    });

    attachGuideHandlers(body);
}

function attachGuideHandlers(body) {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    body.querySelectorAll('.shud-task-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-task-index'), 10);
            if (Number.isNaN(idx)) return;
            const settings = getSettings();
            if (Array.isArray(settings.guide.tasks) && idx >= 0 && idx < settings.guide.tasks.length) {
                settings.guide.tasks.splice(idx, 1);
                saveSettingsDebounced();
                refreshMenuIfOpen();
            }
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
At the very end of EVERY reply, you MUST append a fenced code block tagged "hud-stats" containing a single JSON object with the character's current vitals, world state, and guide info. Format:
\`\`\`hud-stats
{"energy": <0-100>, "sustenance": <0-100>, "hygiene": <0-100>, "time": "HH:MM AM/PM", "date": "Weekday, dd/mm/yy", "weather": "<text>", "location": "<text>", "money": {"amount": <number>, "currency": "<code>"}, "shouldDo": "<text>", "hint": "<text>", "tasks": [{"name": "<text>", "content": "<text>"}]}
\`\`\`
Rules:
- energy/sustenance/hygiene: integers 0..100 reflecting the character's realistic state after the events of this reply.
- time: current in-world time, format "HH:MM AM/PM".
- date: current in-world date, format "Weekday, dd/mm/yy".
- weather: short description of current weather.
- location: where the character currently is.
- money: object with "amount" (integer >= 0) and "currency" (short code, e.g. "G").
- shouldDo: string — suggestions on where to go, who to talk to, what to prioritize based on current session context (story state, NPC interactions, world events).
- hint: string — soft hints toward solving current tasks (directions, leads, next logical steps). Do NOT fully solve — give enough to unstick the player, preserve discovery.
- tasks: array of {"name": string, "content": string}. ONLY include the "tasks" key when a quest's state changes or a new quest appears. OMIT "tasks" entirely if no quest changes in this reply.
- This block is machine-read by the UI and must be the LAST thing in your message.
- Never mention or describe these values outside the block.
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

function applyHudData(json) {
    if (!json || typeof json !== 'object') return false;
    const settings = getSettings();
    let changed = false;

    // ── Vitals ──
    const stats = settings.stats;
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

    // ── World ──
    const world = settings.world;
    for (const key of ['time', 'date', 'weather', 'location']) {
        if (typeof json[key] === 'string' && json[key].length > 0 && world[key] !== json[key]) {
            world[key] = json[key];
            changed = true;
        }
    }
    if (json.money && typeof json.money === 'object') {
        const m = world.money;
        if (typeof json.money.amount === 'number' && Number.isFinite(json.money.amount)) {
            const amt = Math.max(0, Math.round(json.money.amount));
            if (m.amount !== amt) { m.amount = amt; changed = true; }
        }
        if (typeof json.money.currency === 'string' && json.money.currency.length > 0) {
            if (m.currency !== json.money.currency) { m.currency = json.money.currency; changed = true; }
        }
    }

    // ── Guide (shouldDo & hint update every reply; tasks only when present) ──
    const guide = settings.guide;
    if (typeof json.shouldDo === 'string' && guide.shouldDo !== json.shouldDo) {
        guide.shouldDo = json.shouldDo;
        changed = true;
    }
    if (typeof json.hint === 'string' && guide.hint !== json.hint) {
        guide.hint = json.hint;
        changed = true;
    }
    // Only replace tasks when the bot explicitly includes the "tasks" key.
    if (Array.isArray(json.tasks)) {
        const cleanTasks = json.tasks
            .filter(t => t && typeof t === 'object' && typeof t.name === 'string' && t.name.length > 0)
            .map(t => ({ name: t.name, content: typeof t.content === 'string' ? t.content : '' }));
        // Shallow compare by JSON string to detect real change.
        if (JSON.stringify(guide.tasks) !== JSON.stringify(cleanTasks)) {
            guide.tasks = cleanTasks;
            changed = true;
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

        // Parse & update state, but DO NOT strip — keep JSON in mes so bot sees
        // previous state and we can restore on delete/chat-switch.
        const { json } = parseHudBlock(message.mes);
        if (json) {
            const changed = applyHudData(json);
            if (changed) saveSettingsDebounced();
            console.debug(`[${MODULE_NAME}] HUD stats updated:`, json);
        } else if (HUD_BLOCK_REGEX.test(message.mes)) {
            console.warn(`[${MODULE_NAME}] Failed to parse hud-stats block`);
        }

        refreshMenuIfOpen();
    } catch (err) {
        console.error(`[${MODULE_NAME}] onMessageReceived error:`, err);
    }
}

// ── Restore state from chat history ───────────────────────────────────────────

function restoreStateFromChat() {
    try {
        const { chat, saveSettingsDebounced } = SillyTavern.getContext();
        if (!Array.isArray(chat) || chat.length === 0) {
            // No chat — reset to defaults.
            resetToDefaults();
            refreshMenuIfOpen();
            return;
        }

        // Scan from the last message backwards to find the most recent hud-stats block.
        for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            if (!msg || typeof msg.mes !== 'string') continue;
            const { json } = parseHudBlock(msg.mes);
            if (json) {
                applyHudData(json);
                saveSettingsDebounced();
                console.debug(`[${MODULE_NAME}] State restored from message ${i}`);
                refreshMenuIfOpen();
                return;
            }
        }

        // No hud-stats block found in any message — reset to defaults.
        resetToDefaults();
        refreshMenuIfOpen();
    } catch (err) {
        console.error(`[${MODULE_NAME}] restoreStateFromChat error:`, err);
    }
}

function resetToDefaults() {
    const settings = getSettings();
    settings.stats = structuredClone(defaultSettings.stats);
    settings.world = structuredClone(defaultSettings.world);
    settings.guide = structuredClone(defaultSettings.guide);
    const { saveSettingsDebounced } = SillyTavern.getContext();
    saveSettingsDebounced();
    console.debug(`[${MODULE_NAME}] State reset to defaults`);
}

// ── Hide hud-stats block from rendered DOM ────────────────────────────────────

function hideHudBlocksInDOM() {
    // ST renders ```hud-stats as <pre><code class="language-hud-stats">
    document.querySelectorAll('code.language-hud-stats').forEach(code => {
        const pre = code.closest('pre');
        if (pre) pre.style.display = 'none';
    });
    // Also catch any .hljs that might wrap it
    document.querySelectorAll('.hljs.language-hud-stats').forEach(el => {
        const pre = el.closest('pre');
        if (pre) pre.style.display = 'none';
    });
}

function onCharacterMessageRendered() {
    // Defer slightly to ensure DOM is fully painted.
    requestAnimationFrame(hideHudBlocksInDOM);
}

function onChatChanged() {
    // When chat switches, restore state from the new chat's message history.
    restoreStateFromChat();
}

function onMessageDeleted() {
    // When a message is deleted, re-scan to find the now-last hud-stats block.
    restoreStateFromChat();
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
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
        eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
        eventSource.on(event_types.MESSAGE_DELETED, onMessageDeleted);

        // Restore state for the current chat on load.
        restoreStateFromChat();
        hideHudBlocksInDOM();

        syncUI();
        syncBubble();
        console.log(`[${MODULE_NAME}] Loaded successfully`);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to load:`, err);
    }
}

const { eventSource, event_types } = SillyTavern.getContext();
eventSource.on(event_types.APP_READY, init);
