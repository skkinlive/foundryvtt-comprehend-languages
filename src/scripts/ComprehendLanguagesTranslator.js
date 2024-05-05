import { ComprehendLanguages } from "./ComprehendLanguages";
import { ErrorDialog } from "./ErrorDialog";
import {
    _split_at_p,
    _split_html,
    translate_html,
    getTranslationSettings,
    dialogTokenMissing,
    determineFolder,
    translate_text,
    determineNewName,
} from "./lib";

export class Translator {
    /**
     *
     * @param {JournalEntry|Object} documentToTranslate
     * @returns {Promise<void>}
     */
    translateButton(documentToTranslate) {}
}

export class JournalEntryTranslator extends Translator {
    /**
     *
     * @param {JournalEntry} documentToTranslate
     * @returns {Promise<void>}
     */
    async translateButton(documentToTranslate) {
        const { token, target_lang, makeSeparateFolder, translateInPlace } = await getTranslationSettings();
        if (!token) {
            dialogTokenMissing();
        } else {
            if (!translateInPlace) {
                await this.translateAndCreateJournalEntry(documentToTranslate, target_lang, makeSeparateFolder, token);
            } else {
                await this.translateAndReplaceOriginal(documentToTranslate, target_lang, token);
            }
        }
    }

    /**
     *
     * @param {JournalEntry} documentToTranslate
     * @param {string} target_lang
     * @param {string} token
     * @returns {Promise<void>}
     */
    async translateAndReplaceOriginal(documentToTranslate, target_lang, token) {
        const pages = documentToTranslate.pages;
        pages.map(async (page) => {
            const journalText = await this.getJournalPageText(page);
            let translation = await translate_html(journalText, token, target_lang);
            await page.update({
                text: {
                    content: translation,
                    format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
                },
            });
        });
    }

    /**
     *
     * @param {JournalEntry} documentToTranslate
     * @param {string} target_lang
     * @param {boolean} makeSeparateFolder
     * @param {string} token
     * @returns {Promise<void>}
     */
    async translateAndCreateJournalEntry(documentToTranslate, target_lang, makeSeparateFolder, token) {
        const folder = await determineFolder(documentToTranslate, target_lang, makeSeparateFolder);
        const pages = documentToTranslate.pages;
        let newName = await determineNewName(documentToTranslate);
        const newPages = await Promise.all(
            pages.map(async (page) => this.translateSinglePage(page, token, target_lang)),
        ).catch((e) => {
            new ErrorDialog(e.message);
        });
        if (newPages) {
            const newJournalEntry = await JournalEntry.createDocuments([
                { ...documentToTranslate, name: newName, folder: folder },
            ]);
            await newJournalEntry[0].createEmbeddedDocuments("JournalEntryPage", newPages.flat());
        }
    }

    /**
     *
     * @param {JournalEntryPage} journalPage
     * @param {string} token
     * @param {string} target_lang
     * @returns {Promise<JournalEntryPage>}
     */
    async translateSinglePage(journalPage, token, target_lang) {
        const journalText = await this.getJournalPageText(journalPage);
        let translation = await translate_html(journalText, token, target_lang);
        const newJournalPage = await this.createNewJournalEntry(journalPage, translation);
        return newJournalPage;
    }

    /**
     *
     * @param {JournalEntryPage} journalPage
     * @returns {Promise<string>}
     */
    async getJournalPageText(journalPage) {
        if (journalPage.text.content) {
            let text = journalPage.text.content;
            text = text.replace("#", "");
            return text;
        } else {
            return "";
        }
    }

    /**
     *
     * @param {JournalEntryPage} journal
     * @param {string} translation
     * @returns {Promise<JournalEntryPage[]>}
     */
    async createNewJournalEntry(journal, translation) {
        const newName = await determineNewName(journal);
        const newJournalPage = [
            {
                ...journal,
                name: newName,
                text: {
                    content: translation,
                    format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
                },
            },
        ];
        return newJournalPage;
    }
}

export class ItemTranslator extends Translator {
    /**
     *
     * @param {Item} documentToTranslate
     * @returns {Promise<void>}
     */
    async translateButton(documentToTranslate) {
        const { token, target_lang, makeSeparateFolder, translateInPlace } = await getTranslationSettings();
        if (!token) {
            dialogTokenMissing();
        } else {
            // TODO Not every system has the "description" property on system item

            if (documentToTranslate.system.description) {
                if (!translateInPlace) {
                    await this.translateAndCreateItem(documentToTranslate, token, target_lang, makeSeparateFolder);
                } else {
                    await this.translateAndReplaceOriginal(documentToTranslate, token, target_lang);
                }
            } else {
                // DO NOTHING
                console.warn(`Nothing to translate on the item ${documentToTranslate.name}`);
            }
        }
    }

    /**
     *
     * @param {Item} documentToTranslate
     * @param {string} token
     * @param {string} target_lang
     * @returns {Promise<void>}
     */
    async translateAndReplaceOriginal(documentToTranslate, token, target_lang) {
        const newDescriptionText = await translate_html(
            documentToTranslate.system.description.value,
            token,
            target_lang,
        ).catch((e) => {
            new ErrorDialog(e.message);
        });
        documentToTranslate.update({
            system: { description: { value: newDescriptionText } },
        });
    }

    /**
     *
     * @param {Item} documentToTranslate
     * @param {string} token
     * @param {string} target_lang
     * @param {boolean} makeSeparateFolder
     * @returns {Promise<void>}
     */
    async translateAndCreateItem(documentToTranslate, token, target_lang, makeSeparateFolder) {
        let newName = await determineNewName(documentToTranslate);
        const newDescriptionText = await translate_html(
            documentToTranslate.system.description.value,
            token,
            target_lang,
        ).catch((e) => {
            new ErrorDialog(e.message);
        });
        if (!newDescriptionText) {
        }
        const newFolder = await determineFolder(documentToTranslate, target_lang, makeSeparateFolder);
        const newItems = await Item.createDocuments([
            {
                ...documentToTranslate,
                name: newName,
                folder: newFolder,
                type: documentToTranslate.type,
            },
        ]);
        if (!newItems || newItems.length <= 0) {
            //
        }

        // await newItems[0].update({
        //   system: {
        //     description: {
        //       value:
        //     }newDescriptionText
        //   }
        // });
        await newItems[0].update({
            system: { description: { value: newDescriptionText } },
        });
    }
}

export class ComprehendLanguagesTranslator {
    /**
     *
     * @param {JournalEntry} journal
     * @returns {Promise<void>}
     */
    static async buttonTranslateJournalEntry(journal) {
        const translator = new JournalEntryTranslator();
        translator.translateButton(journal);
    }

    /**
     *
     * @param {Item} item
     * @returns {Promise<void>}
     */
    static async buttonTranslateItem(item) {
        const translator = new ItemTranslator();
        translator.translateButton(item);
    }
}

export class SelectionTranslator {
    /**
     *
     * @returns {Promise<void>}
     */
    static async translateSelectedText() {
        const { token, target_lang, makeSeparateFolder } = await getTranslationSettings();
        const selectedText = window.getSelection().toString();
        const translatedText = await translate_html(selectedText, token, target_lang).catch((e) => {
            new ErrorDialog(e.message);
        });
        if (!translatedText) {
            return;
        }
        let d = new Dialog({
            title: "Translation",
            content: `<p>${translatedText}</p>`,
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Close Translation",
                },
            },
            default: "one",
        });
        d.render(true);
    }
}
