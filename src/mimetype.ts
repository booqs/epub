import { Diagnostics } from "./diagnostic"

export function checkMimetype(mimetype: string, diags: Diagnostics): boolean {
    if (mimetype != "application/epub+zip") {
        diags.push("mimetype file is not application/epub+zip")
        return false
    } else {
        return true
    }
}