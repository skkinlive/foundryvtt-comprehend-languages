import { ComprehendLanguagesTranslator } from "./ComprehendLanguagesTranslator.js";
import CONSTANTS from "./constants.js";
import Logger from "./lib/Logger.js";

// ADDED: 프롬프트 입력 및 확인을 위한 다이얼로그 함수
async function showPromptDialog(defaultPrompt) {
    return new Promise((resolve) => {
        new Dialog({
            title: "Gemini 번역 프롬프트 수정",
            content: `
                <p>아래 프롬프트를 사용하여 번역을 실행합니다. 필요에 맞게 수정하세요.</p>
                <textarea id="gemini-prompt-input" style="width: 100%; height: 250px;">${defaultPrompt}</textarea>
            `,
            buttons: {
                translate: {
                    icon: '<i class="fas fa-language"></i>',
                    label: "번역 실행",
                    callback: (html) => {
                        const finalPrompt = html.find("#gemini-prompt-input")[0].value;
                        resolve(finalPrompt); // 사용자가 수정한 최종 프롬프트를 반환
                    },
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소",
                    callback: () => {
                        resolve(null); // 취소 시 null 반환
                    },
                },
            },
            default: "translate",
            render: html => $(html).css("width", "500px"), // 다이얼로그 폭 조절
            close: () => resolve(null), // 창을 닫아도 취소로 간주
        }).render(true);
    });
}


// MODIFIED: Central Gemini Translation Function - 이제 프롬프트 전체를 인자로 받습니다.
async function translateWithGemini(fullPrompt, apiKey) {
    // @UUID 링크 보호 로직은 프롬프트 생성 단계로 이동했으므로 여기서는 제거합니다.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{ parts: [{ text: fullPrompt }] }], // 전체 프롬프트를 그대로 사용
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

        const translatedText = data.candidates[0].content.parts[0].text;
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

export function _split_html(input_HTML) {
    return [input_HTML];
}
export function _split_at_p(inputHTML) {
    return [inputHTML];
}
export async function translate_html(long_html, token, target_lang) {
    return await translate_text(long_html, token, target_lang);
}

// MODIFIED: Rerouted to use translateWithGemini after getting user input from a dialog
export async function translate_text(text, token, target_lang) {
    // 1. 보호할 텍스트(@UUID)를 미리 치환합니다.
    const replacements = new Map();
    let currentIndex = 0;
    const protectedText = text.replace(/@UUID\[.*?\]/g, (match) => {
        const placeholder = `__PLACEHOLDER_${currentIndex++}__`;
        replacements.set(placeholder, match);
        return placeholder;
    });

    // 2. 사용자에게 보여줄 기본 프롬프트를 생성합니다.
    const defaultPrompt = `Translate the following HTML content into ${target_lang}. IMPORTANT: Preserve all original HTML formatting (like <p>, <h1>, <strong>, etc.) and placeholders like __PLACEHOLDER_0__. Do not add any extra explanations or text outside of the translation itself. Just provide the translated text directly.\n\nHere is the text to translate:\n\n${protectedText}`;
    
    // 3. 프롬프트 수정 다이얼로그를 띄웁니다.
    const finalPrompt = await showPromptDialog(defaultPrompt);

    // 4. 사용자가 취소했다면 번역을 중단합니다.
    if (!finalPrompt) {
        ui.notifications.warn("Translation cancelled by user.");
        return null;
    }
    
    // 5. 최종 프롬프트로 번역을 실행합니다.
    let translatedText = await translateWithGemini(finalPrompt, token);
    
    // 6. 번역 결과가 있고, 치환했던 내용이 있다면 다시 복원합니다.
    if (translatedText && replacements.size > 0) {
        for (const [placeholder, original] of replacements.entries()) {
            translatedText = translatedText.replaceAll(placeholder, original);
        }
    }

    return translatedText;
}

export function replaceAll(string, search, replace) {
    return string.split(search).join(replace);
}

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
