import { Xml } from "./model"
import { Diagnostic, Diagnostics, diagnostics } from "./diagnostic"
import { parseXml } from "./xml"

export type FileOutput = {
    text: string,
    nodebuffer: Buffer,
}
export type FileKind = keyof FileOutput
export type FileProvider = {
    read<K extends FileKind>(path: string, kind: K): Promise<{
        value?: FileOutput[K],
        diags: Diagnostic[],
    }>,
}

export function getSiblingPath(path: string, sibling: string): string {
    let components = path.split('/')
    components[components.length - 1] = sibling
    return components.join('/')
}

export async function loadXml(fileProvider: FileProvider, path: string, diags: Diagnostics): Promise<Xml | undefined> {
    let xmlFile = await loadFile(fileProvider, path, 'text', diags)
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
    let xmlFile = await loadFile(fileProvider, path, 'text', diagnostics('ignore'))
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

export async function loadFile<K extends FileKind>(fileProvider: FileProvider, path: string, kind: K, diags: Diagnostics): Promise<FileOutput[K] | undefined> {
    let { value, diags: fileOpenDiags } = await fileProvider.read(path, kind)
    diags.push(...fileOpenDiags)
    if (value == undefined) {
        diags.push(`${path} is missing`)
    }
    return value
}
