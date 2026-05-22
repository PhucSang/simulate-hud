const MODULE_NAME = 'simulate-hud';

const defaultSettings = Object.freeze({
    enabled: false,
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

function onEnabledChange() {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    const settings = getSettings();
    settings.enabled = Boolean($('#simulate_hud_enabled').prop('checked'));
    saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] enabled =`, settings.enabled);
}

function syncUI() {
    const settings = getSettings();
    $('#simulate_hud_enabled').prop('checked', settings.enabled);
}

async function init() {
    console.log(`[${MODULE_NAME}] Loading...`);
    try {
        const { renderExtensionTemplateAsync } = SillyTavern.getContext();
        const html = await renderExtensionTemplateAsync(`third-party/${MODULE_NAME}`, 'settings');
        $('#extensions_settings2').append(html);

        $('#simulate_hud_enabled').on('change', onEnabledChange);

        syncUI();
        console.log(`[${MODULE_NAME}] Loaded successfully`);
    } catch (err) {
        console.error(`[${MODULE_NAME}] Failed to load:`, err);
    }
}

const { eventSource, event_types } = SillyTavern.getContext();
eventSource.on(event_types.APP_READY, init);
