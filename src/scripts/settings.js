import { SelectionTranslator } from "./SelectionTranslator.js";
import CONSTANTS from "./constants.js";
import SETTINGS from "./constants/settings.js";
import { addTranslateButton } from "./lib.js";
import Logger from "./lib/Logger.js";
export const registerSettings = function () {
    game.settings.registerMenu(CONSTANTS.MODULE_ID, "resetAllSettings", {
        name: `${CONSTANTS.MODULE_ID}.setting.reset.name`,
        hint: `${CONSTANTS.MODULE_ID}.setting.reset.hint`,
        icon: "fas fa-coins",
        type: ResetSettingsDialog,
        restricted: true,
    });

    for (let [name, data] of Object.entries(SETTINGS.GET_DEFAULT())) {
        game.settings.register(CONSTANTS.MODULE_ID, name, data);
    }

    // MODIFIED: Replaced DeepL Token with Gemini API Key
    game.settings.register(CONSTANTS.MODULE_ID, "geminiApiKey", {
        name: `${CONSTANTS.MODULE_ID}.SETTINGS.ApiKeyName`,
        hint: `${CONSTANTS.MODULE_ID}.SETTINGS.ApiKeyHint`,
        config: true,
        type: String,
        default: "",
        scope: "world",
    });

    // MODIFIED: Added Korean (KO) to choices
    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.TARGET_LANG, {
        name: `${CONSTANTS.MODULE_ID}.SETTINGS.TargetLangName`,
        hint: `${CONSTANTS.MODULE_ID}.SETTINGS.TargetLangHint`,
        config: true,
        type: String,
        default: "DE",
        choices: {
            BG: "Bulgarian",
            CS: "Czech",
            DA: "Danish",
            DE: "German",
            EL: "Greek",
            EN: "English",
            ES: "Spanish",
            ET: "Estonian",
            FI: "Finnish",
            FR: "French",
            HU: "Hungarian",
            IT: "Italian",
            JA: "Japanese",
            KO: "Korean (한국어)", // ADDED
            LT: "Lithuanian",
            LV: "Latvian",
            NL: "Dutch",
            PL: "Polish",
            PT: "Portuguese (all Portuguese varieties mixed)",
            RO: "Romanian",
            RU: "Russian",
            SK: "Slovak",
            SL: "Slovenian",
            SV: "Swedish",
            ZH: "Chinese",
        },
        scope: "world",
    });

    // MODIFIED: Commented out DeepL-specific 'formality' setting
    /*
    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.FORMALITY, {
        name: "Formality",
        config: true,
        hint: "How formal should the translations be (if the language supports it)",
        type: String,
        default: "prefer_more",
        choices: {
            prefer_more: "Prefer more formal",
            prefer_less: "Prefer less formal",
        },
        scope: "world",
    });
    */

    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.ICON_ONLY, {
        name: "Icon Only",
        config: true,
        hint: "If enabled the header button will show with only the icon and no text",
        type: Boolean,
        default: false,
        scope: "world",
    });
    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.IN_PLACE, {
        name: "Translate In Place (Overwriting the original)",
        config: true,
        hint: "If enabled the original document will be overwritten with the translated text. The following three settings will be ignored if this is enabled.",
        type: Boolean,
        default: false,
        scope: "world",
    });
    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.SEPARATE_FOLDER, {
        name: "Separate Folder",
        config: true,
        hint: "If enabled the translated documents & items will be put into a separate folder.",
        type: Boolean,
        default: false,
        scope: "world",
    });

    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.TRANSLATE_FOLDER_NAME, {
        name: "Translate Folder Name",
        config: true,
        hint: "If enabled together with the *Separate Folder* setting, the name of the folder will be translated as well.",
        type: Boolean,
        default: false,
        scope: "world",
    });

    game.settings.register(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.TRANSLATE_JOURNAL_NAME, {
        name: "Translate Document Names",
        config: true,
        hint: "If enabled the names of Journals, Journal Pages and Items will be translated as well and the language prefix omitted.",
        type: Boolean,
        default: false,
        scope: "world",
    });

    game.settings.register(CONSTANTS.MODULE_ID, "debug", {
        name: `${CONSTANTS.MODULE_ID}.setting.debug.name`,
        hint: `${CONSTANTS.MODULE_ID}.setting.debug.hint`,
        scope: "client",
        config: true,
        default: false,
        type: Boolean,
    });

    game.keybindings.register(CONSTANTS.MODULE_ID, "translate-highlighted-text", {
        name: "Translate highlighted text",
        hint: "Translate the currently selected piece of text and pop it out into a Dialog",
        editable: [{ key: "KeyT", modifiers: ["Alt"] }],
        onDown: () => {
            SelectionTranslator.translateSelectedText();
            return true;
        },
    });
    
    const handler = {
        ownKeys: (target) => {
            return Reflect.ownKeys(target).filter((app) => {
                const appId = parseInt(app);
                if (!isNaN(appId)) {
                    return false;
                }
                return true;
            });
        },
        set: (obj, prop, value) => {
            const result = Reflect.set(obj, prop, value);
            if (value && value.object) {
                if (value.object instanceof JournalEntry || value.object instanceof Item) {
                    addTranslateButton(value).catch((err) => console.error(err));
                }
            }
            return result;
        },
    };

    ui.windows = new Proxy(ui.windows, handler);
    console.log("Comprehend Languages | Installed window interceptor");
};

class ResetSettingsDialog extends FormApplication {
    constructor(...args) {
        super(...args);
        return new Dialog({
            title: game.i18n.localize(`${CONSTANTS.MODULE_ID}.dialogs.resetsettings.title`),
            content:
                '<p style="margin-bottom:1rem;">' +
                game.i18n.localize(`${CONSTANTS.MODULE_ID}.dialogs.resetsettings.content`) +
                "</p>",
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize(`${CONSTANTS.MODULE_ID}.dialogs.resetsettings.confirm`),
                    callback: async () => {
                        const worldSettings = game.settings.storage
                            ?.get("world")
                            ?.filter((setting) => setting.key.startsWith(`${CONSTANTS.MODULE_ID}.`));
                        for (let setting of worldSettings) {
                            Logger.log(`Reset setting '${setting.key}'`);
                            await setting.delete();
                        }
                    },
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize(`${CONSTANTS.MODULE_ID}.dialogs.resetsettings.cancel`),
                },
            },
            default: "cancel",
        });
    }
    async _updateObject(event, formData) {}
}
