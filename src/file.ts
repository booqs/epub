import { Xml } from "./model"
import { Diagnostics } from "./diagnostic"
import { parseXml } from "./xml"

export type FileProvider = {
    readText(path: string): Promise<string | undefined>,
    readBinary(path: string): Promise<unknown | undefined>,
}

export function getSiblingPath(path: string, sibling: string): string {
    let components = path.split('/')
    components[components.length - 1] = sibling
    return components.join('/')
}

export async function loadXml(fileProvider: FileProvider, path: string, diags: Diagnostics): Promise<Xml | undefined> {
    let xmlFile = await fileProvider.readText(path)
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
    let xmlFile = await fileProvider.readText(path)
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
