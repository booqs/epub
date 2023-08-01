import { expectAttributes, processDir, processLang } from "./attributes"
import {
    PackageMetadata, MetadataTitle, XmlNode, MetadataIdentifier, MetadataLanguage, DublinCoreElement, DublinCore, Meta, MetaProperty, Link,
} from "./model"
import { Diagnostics } from "./diagnostic"
import { optionalExtra, pushIfDefined } from "./utils"
import { processLink } from "./link"
import { processMeta } from "./meta"

export function processPackageMetadata(node: XmlNode, diags: Diagnostics): PackageMetadata | undefined {
    expectAttributes(node.attrs ?? {}, [], diags.scope(node.name))
    let identifier: MetadataIdentifier[] = []
    let title: MetadataTitle[] = []
    let language: MetadataLanguage[] = []
    let dublinCore: DublinCore = {}
    let meta: Meta[] = []
    let link: Link[] = []
    function addDublinCore(node: XmlNode) {
        let element = processDublinCoreElement(node, diags)
        if (element) {
            let key = (node.name.substring(3)) as keyof DublinCore
            let array = dublinCore[key]
            if (!array) {
                array = []
                dublinCore[key] = array
            }
            array.push(element)
        }
    }
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'dc:identifier':
                pushIfDefined(identifier, processIdentifier(child, diags))
                break
            case 'dc:title':
                pushIfDefined(title, processTitle(child, diags))
                break
            case 'dc:language':
                pushIfDefined(language, processLanguage(child, diags))
                break
            case 'dc:contributor': case 'dc:coverage': case 'dc:creator':
            case 'dc:date': case 'dc:description': case 'dc:format':
            case 'dc:publisher': case 'dc:relation': case 'dc:rights':
            case 'dc:source': case 'dc:subject': case 'dc:type':
                addDublinCore(child)
                break
            case 'meta':
                pushIfDefined(meta, processMeta(child, diags))
                break
            case 'link':
                pushIfDefined(link, processLink(child, diags))
                break
            default:
                diags.push(`unexpected element ${child.name}`)
                break
        }
    }
    return {
        title,
        identifier,
        language,
        ...dublinCore,
        ...(meta.length > 0 ? { meta } : {}),
        ...(link.length > 0 ? { link } : {}),
    }
}

function processIdentifier(node: XmlNode, diags: Diagnostics): MetadataIdentifier | undefined {
    let {
        id, '#text': text,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, ['opf:scheme'], diags.scope(node.name))
    if (!text) {
        diags.push(`identifier element is missing text`)
        return undefined
    }
    return {
        id,
        value: text,
        ...optionalExtra(rest),
    }
}

function processTitle(node: XmlNode, diags: Diagnostics): MetadataTitle | undefined {
    let {
        dir, id, 'xml:lang': lang,
        '#text': text,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags.scope(node.name))
    if (!text) {
        diags.push(`title element is missing text`)
        return undefined
    }
    return {
        dir: processDir(dir, diags),
        id,
        lang: processLang(lang, diags),
        value: text,
    }
}

function processLanguage(node: XmlNode, diags: Diagnostics): MetadataLanguage | undefined {
    let {
        id, '#text': text,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(
        rest,
        ['xsi:type'],
        diags.scope(node.name),
    )
    if (!text) {
        diags.push(`language element is missing text`)
        return undefined
    }
    return {
        id,
        value: text,
        ...optionalExtra(rest),
    }
}

function processDublinCoreElement(node: XmlNode, diags: Diagnostics): DublinCoreElement | undefined {
    let {
        dir, id, 'xml:lang': lang,
        '#text': text,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(
        rest,
        ['opf:event', 'opf:file-as', 'opf:role', 'opf:scheme'],
        diags.scope(node.name),
    )
    if (!text) {
        diags.push(`${node.name} element is missing text`)
        return undefined
    }
    return {
        id,
        lang: processLang(lang, diags),
        dir: processDir(dir, diags),
        value: text,
        ...optionalExtra(rest),
    }
}