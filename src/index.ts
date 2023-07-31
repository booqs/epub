import { readContainer } from "./container"
import { AsyncResult, Container, Diagnostic, Epub, FileProvider } from "./core"
import { checkMimetype } from "./mimetype"
import { getValue } from "./utils"

export async function parseEpub(fileProvider: FileProvider): AsyncResult<Epub> {
    const diags: Diagnostic[] = []
    const mimetype = getValue(await fileProvider.read("mimetype"), diags)
    if (mimetype == undefined) {
        diags.push("mimetype file is missing")
    } else {
        getValue(await checkMimetype(mimetype), diags)
    }
    let containerFile = getValue(await fileProvider.read("META-INF/container.xml"), diags)
    let container: Container | undefined
    if (containerFile == undefined) {
        diags.push("container.xml is missing")
        container = {
            rootFiles: [
                {
                    path: "OEBPS/content.opf",
                    mediaType: "application/oebps-package+xml",
                }
            ]
        }
    } else {
        let container = getValue(await readContainer(containerFile), diags)
        if (container == undefined) {
            diags.push("Failed to parse container.xml")
            container = {
                rootFiles: [
                    {
                        path: "OEBPS/content.opf",
                        mediaType: "application/oebps-package+xml",
                    }
                ]
            }
        }
    }
    if (!container) {
        diags.push('Unexpected error: container is undefined')
        return { diags }
    }
    let contentPath = container.rootFiles[0].path
    if (!contentPath) {
        diags.push('Unexpected error: contentPath is undefined')
        return {
            diags,
        }
    }
    return {
        value: {
            container,
        },
        diags,
    }
}
