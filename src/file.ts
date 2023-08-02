import { Xml } from "./model"
import { Diagnostic, Diagnostics, diagnostics } from "./diagnostic"
import { parseXml } from "./xml"

export type FileProvider = {
    read: (path: string) => Promise<{
        value?: string,
        diags: Diagnostic[],
    }>,
}

export function getSiblingPath(path: string, sibling: string): string {
    let components = path.split('/')
    components[components.length - 1] = sibling
    return components.join('/')
}

export async function loadXml(fileProvider: FileProvider, path: string, diags: Diagnostics): Promise<Xml | undefined> {
    let xmlFile = await loadFile(fileProvider, path, diags)
    if (xmlFile == undefined) {
        diags.push(`${path} is missing`)
        return undefined
    }
    let xml = parseXml(xmlFile, diags.scope(`xml at ${path}`))
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${path}`)
        return undefined
    } else {
        return xml
    }
}

export async function loadOptionalXml(fileProvider: FileProvider, path: string, diags: Diagnostics): Promise<Xml | undefined> {
    let xmlFile = await loadFile(fileProvider, path, diagnostics('ignore'))
    if (xmlFile == undefined) {
        return undefined
    }
    let xml = parseXml(xmlFile, diags)
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${path}`)
        return undefined
    } else {
        return xml
    }
}

export async function loadFile(fileProvider: FileProvider, path: string, diags: Diagnostics): Promise<string | undefined> {
    let { value, diags: fileOpenDiags } = await fileProvider.read(path)
    diags.push(...fileOpenDiags)
    if (value == undefined) {
        diags.push(`${path} is missing`)
    }
    return value
}
