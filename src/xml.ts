import { XMLParser } from 'fast-xml-parser'
import { Diagnoser } from './diagnostic'

export type XmlNode = XmlText & XmlAttributes & XmlContainer
export type XmlAttributes = {
    [Attr in `@${string}`]?: string;
}
export type XmlText = {
    '#text'?: string | undefined,
}
export type XmlContainer = {
    [key: string]: XmlNode[];
}

// TODO: change to better type
export type Html = {
    html: HtmlNode,
}
export type HtmlNode = {
    [key in string]?: HtmlNode[];
} & {
    attrs: {
        [key in string]?: string;
    };
} | {
    '#text'?: string,
}

export function parseXml(xml: string | undefined, diags: Diagnoser): XmlNode | undefined {
    if (xml === undefined) {
        diags.push('XML is undefined')
        return undefined
    }
    const parser = new XMLParser({
        removeNSPrefix: true,
        ignoreDeclaration: true,
        ignoreAttributes: false,
        attributeNamePrefix: '@',
        alwaysCreateTextNode: true,
        parseAttributeValue: false,
        parseTagValue: false,
        isArray(name, jpath, isLeafNode, isAttribute) {
            return !isAttribute
        },
    })
    try {
        const fast: XmlNode = parser.parse(xml)
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

export function parseHtml(xml: string | undefined, diags: Diagnoser): Html | undefined {
    if (xml === undefined) {
        diags.push('HTML is undefined')
        return undefined
    }
    const parser = new XMLParser({
        ignoreDeclaration: true,
        ignoreAttributes: false,
        preserveOrder: true,
        attributeNamePrefix: '',
        attributesGroupName: 'attrs',
        unpairedTags: ['hr', 'br', 'link', 'meta'],
        stopNodes: ['*.pre', '*.script'],
        processEntities: true,
        htmlEntities: true,
        alwaysCreateTextNode: true,
        isArray(name, jpath, isLeafNode, isAttribute) {
            return !isAttribute
        },
    })
    try {
        const { html } = parser.parse(xml)
        if (html == undefined) {
            return undefined
        }
        return { html }
    } catch (e) {
        diags.push({
            message: 'Failed to parse HTML',
            data: {
                error: e,
                xml,
            },
        })
        return undefined
    }
}