import { XMLParser } from "fast-xml-parser"
import { Result } from "./core"

export type XmlValue = string | Xml | Xml[]
export type Xml = {
    [key: string]: XmlValue,
} & {
    '@'?: {
        [key: string]: string,
    }
}
export function parseXml(xml: string): Result<Xml> {
    let parser = new XMLParser({
        ignoreDeclaration: true,
        ignoreAttributes: false,
        attributesGroupName: '@',
        attributeNamePrefix: '',
    })
    try {
        let value = parser.parse(xml)
        return {
            value,
            diags: [],
        }
    } catch (e) {
        return {
            diags: [{
                message: 'Failed to parse XML',
                data: e as object,
            }]
        }
    }
}

export function toArray(xmlValue: XmlValue): Xml[] {
    if (typeof xmlValue == 'string') {
        return [{
            '#text': xmlValue,
        }]
    } else if (Array.isArray(xmlValue)) {
        return xmlValue
    } else {
        return [xmlValue]
    }
}