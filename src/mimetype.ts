import { Result } from "./core"

export function checkMimetype(mimetype: string): Result<boolean> {
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