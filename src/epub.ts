import { readContainer } from "./container"
import { AsyncResult, Container, Diagnostic, Epub, FileProvider } from "./core"
import { checkMimetype } from "./mimetype"
import { getValue } from "./utils"
import { Xml, parseXml } from "./xml"

// TODO: remove
const defaultContainer: Container = {
    rootFiles: [
        {
            path: "OEBPS/content.opf",
            mediaType: "application/oebps-package+xml",
        }
    ]
}
export async function parseEpub(fileProvider: FileProvider): AsyncResult<Epub> {
    const diags: Diagnostic[] = []
    const mimetype = getValue(await fileProvider.read("mimetype"), diags)
    if (mimetype == undefined) {
        diags.push("mimetype file is missing")
    } else {
        getValue(await checkMimetype(mimetype), diags)
    }
    let containerXml = getValue(await loadXml(fileProvider, "META-INF/container.xml"), diags)
    let container: Container | undefined
    if (containerXml == undefined) {
        container = defaultContainer
    } else {
        container = getValue(readContainer(containerXml), diags)
        if (container == undefined) {
            diags.push("Failed to process container.xml")
            container = defaultContainer
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

async function loadXml(fileProvider: FileProvider, path: string): AsyncResult<Xml> {
    let diags: Diagnostic[] = []
    let xmlFile = getValue(await fileProvider.read(path), diags)
    if (xmlFile == undefined) {
        diags.push(`${path} is missing`)
        return { diags }
    }
    let xml = getValue(parseXml(xmlFile), diags)
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${path}`)
        return { diags }
    }
    return { value: xml, diags }
}
