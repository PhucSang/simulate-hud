const MODULE_NAME = 'simulate-hud';
const EXTENSION_FOLDER = `third-party/${MODULE_NAME}`;

const defaultSettings = Object.freeze({
    enabled: false,
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

function onEnabledChange(event) {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    const settings = getSettings();
    settings.enabled = Boolean(event.target.checked);
    saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] enabled =`, settings.enabled);
}

function syncUI() {
    const settings = getSettings();
    const checkbox = document.getElementById('simulate_hud_enabled');
    if (checkbox) checkbox.checked = settings.enabled;
}

async function init() {
    console.log(`[${MODULE_NAME}] Loading...`);

    const { renderExtensionTemplateAsync } = SillyTavern.getContext();

    const html = await renderExtensionTemplateAsync(EXTENSION_FOLDER, 'settings');
    document.getElementById('extensions_settings2').insertAdjacentHTML('beforeend', html);

    document.getElementById('simulate_hud_enabled').addEventListener('change', onEnabledChange);

    syncUI();

    console.log(`[${MODULE_NAME}] Loaded.`);
}

init();
