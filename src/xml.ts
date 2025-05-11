import { XMLParser } from 'fast-xml-parser'
import { Diagnoser } from './common'

export type XmlNode = XmlText & XmlAttributes & XmlContainer
export type XmlAttributes = {
    [Attr in `@${string}`]?: string;
}
export type XmlText = {
    '#text'?: string | undefined,
}
export type FirstSymbol = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z' | '_'
export type XmlContainer = {
    [key in `${FirstSymbol}${string}`]: XmlNode[];
}

export type UnvalidatedXml<Shape extends XmlNode> = Unvalidated<Shape> & XmlNode
export type Unvalidated<T> =
    T extends Array<infer U> ? Unvalidated<U>[] :
    T extends object ? {
        [P in keyof T]?: Unvalidated<T[P]>;
    } :
    T extends string ? string :
    T extends number ? number :
    T extends boolean ? boolean :
    T
    ;

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
    '#text': string,
}

export function parseXml(xml: string | undefined, diags?: Diagnoser): XmlNode | undefined {
    if (xml === undefined) {
        diags?.push('XML is undefined')
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
        diags?.push({
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