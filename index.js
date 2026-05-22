const MODULE_NAME = 'simulate-hud';
const EXTENSION_FOLDER = `third-party/${MODULE_NAME}`;
const DRAG_THRESHOLD = 8; // px — below this = tap, above = drag

const defaultSettings = Object.freeze({
    enabled: false,
    bubbleX: null,
    bubbleY: null,
});

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    const { lodash } = SillyTavern.libs;
    extensionSettings[MODULE_NAME] = lodash.merge(
        structuredClone(defaultSettings),
        extensionSettings[MODULE_NAME],
    );
    return extensionSettings[MODULE_NAME];
}

function saveSettings() {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    saveSettingsDebounced();
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function createBubble() {
    const existing = document.getElementById('shud-bubble');
    if (existing) return existing;

    const bubble = document.createElement('div');
    bubble.id = 'shud-bubble';
    bubble.innerHTML = '<i class="fa-solid fa-circle-dot"></i>';
    document.body.appendChild(bubble);

    makeDraggable(bubble);
    return bubble;
}

function placeBubble(bubble) {
    const settings = getSettings();
    const size = 52;

    const x = settings.bubbleX ?? (window.innerWidth - size - 16);
    const y = settings.bubbleY ?? (window.innerHeight - size - 80);

    bubble.style.left = clamp(x, 0, window.innerWidth - size) + 'px';
    bubble.style.top  = clamp(y, 0, window.innerHeight - size) + 'px';
}

function makeDraggable(el) {
    let startX, startY, startLeft, startTop, moved;

    function pointerDown(clientX, clientY) {
        startX    = clientX;
        startY    = clientY;
        startLeft = el.offsetLeft;
        startTop  = el.offsetTop;
        moved     = false;
    }

    function pointerMove(clientX, clientY) {
        const dx = clientX - startX;
        const dy = clientY - startY;

        if (!moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            moved = true;
        }
        if (!moved) return;

        const size = el.offsetWidth;
        el.style.left = clamp(startLeft + dx, 0, window.innerWidth  - size) + 'px';
        el.style.top  = clamp(startTop  + dy, 0, window.innerHeight - size) + 'px';
    }

    function pointerUp() {
        if (moved) {
            const settings = getSettings();
            settings.bubbleX = el.offsetLeft;
            settings.bubbleY = el.offsetTop;
            saveSettings();
        } else {
            toggleHudMenu();
        }
    }

    // Mouse
    el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pointerDown(e.clientX, e.clientY);

        function onMove(e) { pointerMove(e.clientX, e.clientY); }
        function onUp()   { pointerUp(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // Touch (Android)
    el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        pointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
        e.preventDefault();
        pointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
        e.preventDefault();
        pointerUp();
    }, { passive: false });
}

// ─── HUD Menu ─────────────────────────────────────────────────────────────────

function createHudMenu() {
    const existing = document.getElementById('shud-menu');
    if (existing) return existing;

    const menu = document.createElement('div');
    menu.id = 'shud-menu';
    menu.innerHTML = `
        <div class="shud-menu-header">
            <span class="shud-menu-title">HUD</span>
            <button class="shud-close-btn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="shud-menu-body">
            <!-- content goes here -->
        </div>
    `;
    document.body.appendChild(menu);

    menu.querySelector('.shud-close-btn').addEventListener('click', closeHudMenu);
    menu.querySelector('.shud-close-btn').addEventListener('touchend', (e) => {
        e.preventDefault();
        closeHudMenu();
    });

    return menu;
}

function toggleHudMenu() {
    const menu = document.getElementById('shud-menu');
    if (!menu) return;
    const isOpen = menu.classList.contains('shud-menu--open');
    isOpen ? closeHudMenu() : openHudMenu();
}

function openHudMenu() {
    const menu = document.getElementById('shud-menu');
    if (menu) menu.classList.add('shud-menu--open');
}

function closeHudMenu() {
    const menu = document.getElementById('shud-menu');
    if (menu) menu.classList.remove('shud-menu--open');
}

// ─── Enable / Disable ─────────────────────────────────────────────────────────

function applyEnabled(enabled) {
    const bubble = document.getElementById('shud-bubble');
    const menu   = document.getElementById('shud-menu');

    if (enabled) {
        if (bubble) bubble.style.display = '';
    } else {
        if (bubble) bubble.style.display = 'none';
        closeHudMenu();
    }
}

function onEnabledChange(event) {
    const settings = getSettings();
    settings.enabled = Boolean(event.target.checked);
    saveSettings();
    applyEnabled(settings.enabled);
}

function syncUI() {
    const settings = getSettings();
    const checkbox = document.getElementById('simulate_hud_enabled');
    if (checkbox) checkbox.checked = settings.enabled;
    applyEnabled(settings.enabled);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

async function init() {
    console.log(`[${MODULE_NAME}] Loading...`);

    const { renderExtensionTemplateAsync } = SillyTavern.getContext();
    const html = await renderExtensionTemplateAsync(EXTENSION_FOLDER, 'settings');
    document.getElementById('extensions_settings2').insertAdjacentHTML('beforeend', html);

    document.getElementById('simulate_hud_enabled').addEventListener('change', onEnabledChange);

    const bubble = createBubble();
    placeBubble(bubble);
    createHudMenu();

    syncUI();

    console.log(`[${MODULE_NAME}] Loaded.`);
}

init();
