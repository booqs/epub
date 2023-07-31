import { XMLParser } from "fast-xml-parser"
import { Diagnostic, Result, XmlAttributes, XmlNode } from "./core"

const Attributes = ':@'
type FastXmlNode<Name extends string = string> = {
    [key in Name]: FastXmlNode[];
} & {
    [Attributes]?: XmlAttributes,
}
export function parseXml(xml: string): Result<XmlNode[]> {
    let parser = new XMLParser({
        ignoreDeclaration: true,
        ignoreAttributes: false,
        attributeNamePrefix: '',
        preserveOrder: true,
    })
    let diags: Diagnostic[] = []
    try {
        let fast: FastXmlNode[] = parser.parse(xml)
        return {
            value: fast.map(f => preprocessXml(f, diags)),
            diags,
        }
    } catch (e) {
        diags.push({
            message: 'Failed to parse XML',
            data: e as object,
        })
        return {
            diags
        }
    }
}

function preprocessXml(fast: FastXmlNode, diags: Diagnostic[]): XmlNode {
    let result: XmlNode = {
        name: '',
        attrs: {},
        children: [],
    }
    for (let [key, value] of Object.entries(fast)) {
        if (key == Attributes) {
            result.attrs = value as XmlAttributes
        } else if (result.name == '') {
            result.name = key
            result.children = (value as FastXmlNode[]).map(v => preprocessXml(v, diags))
        } else {
            diags.push({
                message: `Unexpected xml object, too many keys`,
                data: fast,
            })
        }
    }
    if (result.name == '') {
        diags.push({
            message: 'Unexpected xml object, no keys',
            data: fast,
        })
    }
    return result
}