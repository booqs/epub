import { AsyncResult } from "./core"

export async function checkMimetype(mimetype: string): AsyncResult<boolean> {
    if (mimetype != "application/epub+zip") {
        return {
            value: false,
            diags: [
                "mimetype file is not application/epub+zip",
            ],
        }
    }
    return {
        value: true,
        diags: [],
    }
}