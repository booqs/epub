import { Diagnoser, diagnoser } from './diagnostic'
import { XmlNode, parseXml } from './xml'

// TODO: move to model
export type FileProvider = {
    readText(path: string, diags: Diagnoser): Promise<string | undefined>,
    readBinary(path: string, diags: Diagnoser): Promise<unknown | undefined>,
}

export async function loadXml(fileProvider: FileProvider, path: string, diags: Diagnoser): Promise<XmlNode | undefined> {
    const xmlFile = await fileProvider.readText(path, diags)
    if (xmlFile == undefined) {
        diags.push(`${path} is missing`)
        return undefined
    }
    const xml = parseXml(xmlFile, diags.scope(`xml at ${path}`))
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${path}`)
        return undefined
    } else {
        return xml
    }
}

export async function loadOptionalXml(fileProvider: FileProvider, path: string, diags: Diagnoser): Promise<XmlNode | undefined> {
    const xmlFile = await fileProvider.readText(path, diagnoser('ignore'))
    if (xmlFile == undefined) {
        return undefined
    }
    const xml = parseXml(xmlFile, diags)
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${path}`)
        return undefined
    } else {
        return xml
    }
}
