import { processContainerXml } from "./container"
import { AsyncResult, Diagnostic, Epub, FileProvider } from "./core"
import { checkMimetype } from "./mimetype"
import { getValue } from "./utils"
import { XmlNode, parseXml } from "./xml"

export async function parseEpub(fileProvider: FileProvider): AsyncResult<Epub> {
    const diags: Diagnostic[] = []
    const mimetype = getValue(await fileProvider.read("mimetype"), diags)
    if (mimetype == undefined) {
        diags.push("mimetype file is missing")
    } else {
        getValue(await checkMimetype(mimetype), diags)
    }
    let containerXml = getValue(await loadXml(fileProvider, "META-INF/container.xml"), diags)
    if (containerXml == undefined) {
        diags.push("No valid container.xml")
        return { diags }
    }
    let container = getValue(processContainerXml(containerXml), diags)
    if (container == undefined) {
        diags.push("Failed to process container.xml")
        return { diags }
    }
    return {
        value: {
            container,
        },
        diags,
    }
}

async function loadXml(fileProvider: FileProvider, path: string): AsyncResult<XmlNode[]> {
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
