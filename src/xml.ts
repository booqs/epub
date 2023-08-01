import { XMLParser } from "fast-xml-parser"
import { XmlAttributes, XmlNode } from "./model"
import { Diagnostics } from "./diagnostic"

const Attributes = ':@'
type FastXmlNode<Name extends string = string> = {
    [key in Name]: FastXmlNode[];
} & {
    [Attributes]?: XmlAttributes,
}
export function parseXml(xml: string, diags: Diagnostics): XmlNode[] | undefined {
    let parser = new XMLParser({
        ignoreDeclaration: true,
        ignoreAttributes: false,
        attributeNamePrefix: '',
        preserveOrder: true,
    })
    try {
        let fast: FastXmlNode[] = parser.parse(xml)
        try {
            let result = fast.map(f => preprocessXml(f, diags))
            return result
        } catch (e) {
            diags.push({
                message: 'Failed to preprocess XML',
                data: {
                    error: e,
                    fast,
                },
            })
            return undefined
        }
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

function preprocessXml(fast: FastXmlNode, diags: Diagnostics): XmlNode {
    let result: XmlNode = {
        name: '',
        attrs: {},
        children: [],
    }
    for (let [key, value] of Object.entries(fast)) {
        if (key == Attributes) {
            result.attrs = {
                ...result.attrs,
                ...value as XmlAttributes,
            }
        } else if (result.name == '') {
            result.name = key
            let fastChildren = value as FastXmlNode[]
            let children: XmlNode[] | undefined = fastChildren.length > 0 ? [] : undefined
            for (let child of fastChildren) {
                if (child['#text'] !== undefined) {
                    result.attrs = {
                        ...result.attrs,
                        '#text': child['#text'] as any as string,
                    }
                } else {
                    children?.push(preprocessXml(child, diags))
                }
            }
            result.children = children
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