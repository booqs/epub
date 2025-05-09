import { XMLParser } from "fast-xml-parser"
import { Html, Xml } from "./model"
import { Diagnoser } from "./diagnostic"

export function parseXml(xml: string | undefined, diags: Diagnoser): Xml | undefined {
    if (xml === undefined) {
        diags.push('XML is undefined')
        return undefined
    }
    let parser = new XMLParser({
        // removeNSPrefix: true,
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

export function parseHtml(xml: string | undefined, diags: Diagnoser): Html | undefined {
    if (xml === undefined) {
        diags.push('HTML is undefined')
        return undefined
    }
    let parser = new XMLParser({
        ignoreDeclaration: true,
        ignoreAttributes: false,
        preserveOrder: true,
        attributeNamePrefix: '',
        attributesGroupName: 'attrs',
        unpairedTags: ["hr", "br", "link", "meta"],
        stopNodes: ["*.pre", "*.script"],
        processEntities: true,
        htmlEntities: true,
        alwaysCreateTextNode: true,
        isArray(name, jpath, isLeafNode, isAttribute) {
            return !isAttribute
        },
    })
    try {
        let { html } = parser.parse(xml)
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