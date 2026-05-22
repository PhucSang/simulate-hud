const MODULE_NAME = 'simulate-hud';
const EXTENSION_FOLDER = `third-party/${MODULE_NAME}`;
const DRAG_THRESHOLD = 8;

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
    SillyTavern.getContext().saveSettingsDebounced();
}

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
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
    const x = settings.bubbleX ?? (window.innerWidth  - size - 16);
    const y = settings.bubbleY ?? (window.innerHeight - size - 80);
    bubble.style.left = clamp(x, 0, window.innerWidth  - size) + 'px';
    bubble.style.top  = clamp(y, 0, window.innerHeight - size) + 'px';
}

function makeDraggable(el) {
    let startX, startY, startLeft, startTop;
    let isDown = false;
    let moved  = false;

    // pointerdown trên bubble — bắt đầu tracking
    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        isDown    = true;
        moved     = false;
        startX    = e.clientX;
        startY    = e.clientY;
        startLeft = el.offsetLeft;
        startTop  = el.offsetTop;
    });

    // pointermove trên document — track drag (kể cả khi ngón tay ra ngoài bubble)
    document.addEventListener('pointermove', (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            moved = true;
        }
        if (!moved) return;
        const size = el.offsetWidth;
        el.style.left = clamp(startLeft + dx, 0, window.innerWidth  - size) + 'px';
        el.style.top  = clamp(startTop  + dy, 0, window.innerHeight - size) + 'px';
    });

    // pointerup trên document — kết thúc drag hoặc tap
    document.addEventListener('pointerup', () => {
        if (!isDown) return;
        isDown = false;

        if (moved) {
            moved = false;
            const settings = getSettings();
            settings.bubbleX = el.offsetLeft;
            settings.bubbleY = el.offsetTop;
            saveSettings();
        } else {
            toggleHudMenu();
        }
    });

    // pointercancel — reset trạng thái nếu bị interrupt
    document.addEventListener('pointercancel', () => {
        isDown = false;
        moved  = false;
    });
}

// ─── HUD Menu ─────────────────────────────────────────────────────────────────

function createHudMenu() {
    if (document.getElementById('shud-menu')) return;

    const menu = document.createElement('div');
    menu.id = 'shud-menu';
    menu.innerHTML = `
        <div class="shud-menu-header">
            <span class="shud-menu-title">HUD</span>
            <button class="shud-close-btn" type="button">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="shud-menu-body">
        </div>
    `;
    document.body.appendChild(menu);

    menu.querySelector('.shud-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        closeHudMenu();
    });
}

// Click bên ngoài menu và bubble → đóng menu
function setupClickOutside() {
    document.addEventListener('click', (e) => {
        const menu   = document.getElementById('shud-menu');
        const bubble = document.getElementById('shud-bubble');
        if (!menu?.classList.contains('shud-menu--open')) return;
        if (menu.contains(e.target))    return;
        if (bubble?.contains(e.target)) return;
        closeHudMenu();
    }, true);
}

function openHudMenu() {
    document.getElementById('shud-menu')?.classList.add('shud-menu--open');
}

function closeHudMenu() {
    document.getElementById('shud-menu')?.classList.remove('shud-menu--open');
}

function toggleHudMenu() {
    const menu = document.getElementById('shud-menu');
    if (!menu) return;
    menu.classList.contains('shud-menu--open') ? closeHudMenu() : openHudMenu();
}

// ─── Enable / Disable ─────────────────────────────────────────────────────────

function applyEnabled(enabled) {
    const bubble = document.getElementById('shud-bubble');
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

async function init() {
    console.log(`[${MODULE_NAME}] Loading...`);

    const { renderExtensionTemplateAsync } = SillyTavern.getContext();
    const html = await renderExtensionTemplateAsync(EXTENSION_FOLDER, 'settings');
    document.getElementById('extensions_settings2').insertAdjacentHTML('beforeend', html);
    document.getElementById('simulate_hud_enabled').addEventListener('change', onEnabledChange);

    const bubble = createBubble();
    placeBubble(bubble);
    createHudMenu();
    setupClickOutside();
    syncUI();

    console.log(`[${MODULE_NAME}] Loaded.`);
}

init();
