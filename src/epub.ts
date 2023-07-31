import { processContainerXml } from "./container"
import { AsyncResult, Diagnostic, Epub, FileProvider, Xml } from "./core"
import { checkMimetype } from "./mimetype"
import { getValue } from "./utils"
import { parseXml } from "./xml"

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
    let encryptionXml = getValue(await loadOptionalXml(fileProvider, "META-INF/encryption.xml"), diags)
    let manifestXml = getValue(await loadOptionalXml(fileProvider, "META-INF/manifest.xml"), diags)
    let metadataXml = getValue(await loadOptionalXml(fileProvider, "META-INF/metadata.xml"), diags)
    let rightsXml = getValue(await loadOptionalXml(fileProvider, "META-INF/rights.xml"), diags)
    let signaturesXml = getValue(await loadOptionalXml(fileProvider, "META-INF/signatures.xml"), diags)
    return {
        value: {
            container,
            encryption: encryptionXml,
            manifest: manifestXml,
            metadata: metadataXml,
            rights: rightsXml,
            signatures: signaturesXml,
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

async function loadOptionalXml(fileProvider: FileProvider, path: string): AsyncResult<Xml | undefined> {
    let diags: Diagnostic[] = []
    let xmlFile = getValue(await fileProvider.read(path), [])
    if (xmlFile == undefined) {
        return { value: undefined, diags }
    }
    let xml = getValue(parseXml(xmlFile), diags)
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${path}`)
        return { diags }
    }
    return { value: xml, diags }
}
