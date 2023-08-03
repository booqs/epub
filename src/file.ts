import { Xml } from "./model"
import { Diagnostics } from "./diagnostic"
import { parseXml } from "./xml"

export type FileProvider = {
    readText(path: string): Promise<string | undefined>,
    readBinary(path: string): Promise<unknown | undefined>,
}

export function getBasePath(path: string): string {
    let index = path.lastIndexOf('/')
    if (index == -1) {
        return ''
    } else {
        return path.slice(0, index + 1)
    }
}

export function pathRelativeTo(base: string, path: string): string {
    if (path.startsWith('/')) {
        return path
    } else if (base.endsWith('/')) {
        return base + path
    } else {
        return base + '/' + path
    }
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
