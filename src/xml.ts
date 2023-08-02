import { XMLParser } from "fast-xml-parser"
import { Xml } from "./model"
import { Diagnostics } from "./diagnostic"
export function parseXml(xml: string, diags: Diagnostics): Xml | undefined {
    let parser = new XMLParser({
        ignoreDeclaration: true,
        ignoreAttributes: false,
        attributeNamePrefix: '@',
        isArray: () => true,
    })
    try {
        let fast: Xml = parser.parse(xml)
        return fast
    } catch (e) {
        diags.push({
            message: 'Failed to parse XML',
            data: {
                error: e,
                xml,
            },
        })
        return undefined
    }
}