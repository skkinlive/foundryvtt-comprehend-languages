import { ComprehendLanguagesTranslator } from "./ComprehendLanguagesTranslator.js";
import CONSTANTS from "./constants.js";
import Logger from "./lib/Logger.js";

// ADDED: Central Gemini Translation Function
async function translateWithGemini(textToTranslate, targetLanguage, apiKey) {
    const replacements = new Map();
    let currentIndex = 0;
    const protectedText = textToTranslate.replace(/@UUID\[.*?\]/g, (match) => {
        const placeholder = `__PLACEHOLDER_${currentIndex++}__`;
        replacements.set(placeholder, match);
        return placeholder;
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const prompt = `Translate the following HTML content into ${targetLanguage}. IMPORTANT: Preserve all original HTML formatting (like <p>, <h1>, <strong>, etc.) and placeholders like __PLACEHOLDER_0__. Do not add any extra explanations or text outside of the translation itself. Just provide the translated text directly.\n\nHere is the text to translate:\n\n${protectedText}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Comprehend Languages (Gemini) | API Error:", errorBody);
            ui.notifications.error(`Gemini API Error: ${errorBody.error.message}`);
            return null;
        }

        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) {
            console.error("Comprehend Languages (Gemini) | Translation blocked or empty response:", data);
            ui.notifications.error("Translation was blocked by Gemini's safety settings or returned an empty response.");
            return null;
        }

        let translatedText = data.candidates[0].content.parts[0].text;

        for (const [placeholder, original] of replacements.entries()) {
            translatedText = translatedText.replaceAll(placeholder, original);
        }

        return translatedText.trim();
    } catch (error) {
        console.error("Comprehend Languages (Gemini) | Fetch Error:", error);
        ui.notifications.error("Failed to connect to the Gemini API.");
        return null;
    }
}

export const addTranslateButton = async function (app) {
    if (!game.user.isGM) {
        return;
    }
    const documentToTranslate = app.document;

    const TIMEOUT_INTERVAL = 50;
    const MAX_TIMEOUT = 1000;
    const ID = randomID(24);
    let waitRender = Math.floor(MAX_TIMEOUT / TIMEOUT_INTERVAL);
    while (app._state !== Application.RENDER_STATES.RENDERED && waitRender-- > 0) {
        await new Promise((r) => setTimeout(r, TIMEOUT_INTERVAL));
    }
    if (app._state !== Application.RENDER_STATES.RENDERED) {
        console.log("Timeout out waiting for app to render");
        return;
    }

    let domID = appToID(app, ID);
    if (!document.getElementById(domID)) {
        // MODIFIED: Use i18n keys for button text and tooltip
        let buttonText = game.i18n.localize(`${CONSTANTS.MODULE_ID}.BUTTONS.Translate`);
        if (game && game.settings.get(CONSTANTS.MODULE_ID, "iconOnly")) {
            buttonText = "";
        }
        const link = $(
            `<a id="${domID}" class="popout"><i class="fas fa-language" data-tooltip="${game.i18n.localize(
                `${CONSTANTS.MODULE_ID}.BUTTONS.Translate`
            )}"></i>${buttonText}</a>`
        );
        link.on("click", () => {
            if (documentToTranslate instanceof JournalEntry) {
                ComprehendLanguagesTranslator.buttonTranslateJournalEntry(documentToTranslate);
            } else if (documentToTranslate instanceof Item) {
                ComprehendLanguagesTranslator.buttonTranslateItem(documentToTranslate);
            } else {
                console.error(`comprehend-languages | The document type ${documentToTranslate} is not supported!`);
            }
        });
        app.element.find(".window-title").after(link);
    }
};

export const appToID = function (app, ID) {
    return `comprehend-languages_${ID}_${app.appId}`;
};

// MODIFIED: This function is no longer needed for Gemini but kept for compatibility.
export function _split_html(input_HTML) {
    return [input_HTML];
}
// MODIFIED: This function is no longer needed for Gemini but kept for compatibility.
export function _split_at_p(inputHTML) {
    return [inputHTML];
}
// MODIFIED: This function is no longer needed for Gemini but kept for compatibility.
export async function translate_html(long_html, token, target_lang) {
    return await translate_text(long_html, token, target_lang);
}

// MODIFIED: Rerouted to use translateWithGemini
export async function translate_text(text, token, target_lang) {
    return await translateWithGemini(text, token, target_lang);
}

export function replaceAll(string, search, replace) {
    return string.split(search).join(replace);
}

// MODIFIED: Changed to get Gemini API key
export async function getTranslationSettings() {
    const apiProviderToken = game.settings.get(CONSTANTS.MODULE_ID, "geminiApiKey");
    const target_lang = game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.TARGET_LANG);
    const makeSeparateFolder = game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.SEPARATE_FOLDER);
    const translateInPlace = game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.IN_PLACE);

    return {
        apiProviderToken: apiProviderToken,
        target_lang: target_lang,
        makeSeparateFolder: makeSeparateFolder,
        translateInPlace: translateInPlace,
    };
}

// MODIFIED: Changed dialog message for Gemini
export async function dialogApiProviderTokenMissing() {
    let d = new Dialog({
        title: "Gemini API Key Missing",
        content: "<p>Error: No Gemini API Key found. <br> Please add your Gemini API Key to the module settings.</p>",
        buttons: {
            one: {
                icon: '<i class="fas fa-check"></i>',
                label: "OK",
            },
        },
        default: "one",
    });
    d.render(true);
}

// MODIFIED: Changed to get Gemini API key for folder name translation
export async function determineFolder(translatable, target_lang, makeSeparateFolder) {
    var newFolder = null;
    if (makeSeparateFolder) {
        if (!translatable.folder) {
            return null;
        }
        let oldFolderName = translatable.folder.name;
        var newFolderName = "";
        if (game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.TRANSLATE_FOLDER_NAME)) {
            newFolderName = await translate_text(
                oldFolderName,
                game.settings.get(CONSTANTS.MODULE_ID, "geminiApiKey"),
                game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.TARGET_LANG)
            );
        } else {
            newFolderName = target_lang + "_" + oldFolderName;
        }
        let folderType = translatable.folder.type;
        let existingFolder = game.folders.filter((folder) => {
            return folder.name == newFolderName && folder.type == folderType;
        });
        if (existingFolder.length == 0) {
            var newFolders = await Folder.createDocuments([
                {
                    name: newFolderName,
                    type: folderType,
                },
            ]);
            newFolder = newFolders[0];
        } else {
            newFolder = existingFolder[0];
        }
    } else {
        newFolder = translatable.folder;
    }
    return newFolder;
}

export async function determineNewName(documentToTranslate) {
    const { apiProviderToken, target_lang } = await getTranslationSettings();
    let newName = "";
    if (game.settings.get(CONSTANTS.MODULE_ID, CONSTANTS.SETTINGS.TRANSLATE_JOURNAL_NAME)) {
        newName = await translate_text(documentToTranslate.name, apiProviderToken, target_lang);
    } else {
        if (documentToTranslate instanceof JournalEntryPage) {
            return documentToTranslate.name;
        }
        newName = `[${target_lang}] ${documentToTranslate.name}`;
    }
    return newName;
}

export function parseAsArray(obj) {
    if (!obj) {
        return [];
    }
    let arr = [];
    if (typeof obj === "string" || obj instanceof String) {
        arr = obj.split(",");
    } else if (obj.constructor === Array) {
        arr = obj;
    } else {
        arr = [obj];
    }
    return arr;
}
