const MODULE_NAME = 'simulate-hud';

const defaultSettings = Object.freeze({
    enabled: false,
    bubbleX: null,
    bubbleY: null,
});

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = defaultSettings[key];
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

// ── HUD Menu ──────────────────────────────────────────────────────────────────

function getMenu() {
    return document.getElementById('simulate-hud-menu');
}

function getOverlay() {
    return document.getElementById('simulate-hud-overlay');
}

function openMenu() {
    if (getMenu()) return;

    const overlay = document.createElement('div');
    overlay.id = 'simulate-hud-overlay';
    overlay.addEventListener('click', closeMenu);
    overlay.addEventListener('touchend', (e) => { e.preventDefault(); closeMenu(); }, { passive: false });

    const menu = document.createElement('div');
    menu.id = 'simulate-hud-menu';
    menu.innerHTML = `
        <div class="shud-menu-header">
            <span class="shud-menu-title"><i class="fa-solid fa-dragon"></i> Simulate HUD</span>
            <button class="shud-close-btn" id="simulate-hud-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="shud-menu-body">
            <!-- HUD content goes here -->
        </div>
    `;

    // Stop click/touch on menu from bubbling to overlay
    menu.addEventListener('click',    (e) => e.stopPropagation());
    menu.addEventListener('touchend', (e) => e.stopPropagation());

    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    document.getElementById('simulate-hud-close').addEventListener('click', closeMenu);

    // Animate in
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
        menu.classList.add('visible');
    });
}

function closeMenu() {
    const overlay = getOverlay();
    const menu    = getMenu();
    if (!menu) return;

    menu.classList.remove('visible');
    overlay.classList.remove('visible');

    menu.addEventListener('transitionend', () => {
        menu.remove();
        overlay.remove();
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
