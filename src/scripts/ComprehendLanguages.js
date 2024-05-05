import * as foundry from "../../types/foundry/index";
import { SelectionTranslator } from "./ComprehendLanguagesTranslator";
import { addTranslateButton } from "./lib";
import { ComprehendLanguagesStatic } from "./statics";

export class ComprehendLanguages {
    static log(force, ...args) {
        const shouldLog =
            force ||
            //      @ts-ignore
            game.modules.get("_dev-mode")?.api?.getPackageDebugValue(this.ID);

        if (shouldLog) {
            console.log(ComprehendLanguagesStatic.ID, "|", ...args);
        }
    }
}
