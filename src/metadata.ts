import { expectAttributes, processDir, processLang } from "./attributes"
import {
    PackageMetadata, MetadataTitle, XmlNode, MetadataIdentifier, MetadataLanguage, DublinCoreElement, DublinCore, Meta, MetaProperty,
} from "./model"
import { Diagnostics } from "./diagnostic"
import { optionalExtra } from "./utils"

export function processPackageMetadata(node: XmlNode, diags: Diagnostics): PackageMetadata | undefined {
    expectAttributes(node.attrs ?? {}, [], diags.scope(node.name))
    let identifier: MetadataIdentifier[] = []
    let title: MetadataTitle[] = []
    let language: MetadataLanguage[] = []
    let dublinCore: DublinCore = {}
    let meta: Meta[] = []
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
            case 'dc:contributor':
            case 'dc:coverage':
            case 'dc:creator':
            case 'dc:date':
            case 'dc:description':
            case 'dc:format':
            case 'dc:publisher':
            case 'dc:relation':
            case 'dc:rights':
            case 'dc:source':
            case 'dc:subject':
            case 'dc:type':
                addDublinCore(child)
                break
            case 'meta':
                pushIfDefined(meta, processMeta(child, diags))
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

function processMeta(node: XmlNode, diags: Diagnostics): Meta | undefined {
    let {
        dir, id, property, refines, scheme,
        'xml:lang': lang,
        '#text': text,
        name, content,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(
        rest,
        [],
        diags.scope(node.name),
    )
    if (!property) {
        if (!name || !content) {
            diags.push({
                message: `meta2 element is missing name or content`,
                data: node.attrs,
            })
            return undefined
        }
        if (!content) {
            diags.push(`meta2 element is missing content`)
            return undefined
        }
        if (refines || scheme || text || lang || dir || id) {
            diags.push({
                message: `meta2 element cannot have meta3 attributes`,
                data: node.attrs,
            })
        }
        return {
            name, content,
            ...optionalExtra(rest),
        }
    } else {
        return {
            id,
            lang: processLang(lang, diags),
            dir: processDir(dir, diags),
            property: processMetaProperty(property, diags),
            refines,
            scheme,
            value: text,
            ...optionalExtra(rest),
        }
    }
}

function processMetaProperty(property: string, diags: Diagnostics): MetaProperty {
    switch (property) {
        case 'alternate-script': case 'authority':
        case 'belongs-to-collection': case 'collection-type': case 'display-seq': case 'file-as': case 'group-position':
        case 'identifier-type': case 'role': case 'source-of': case 'term': case 'title-type':
            return property
        default:
            if (property.includes(':')) {
                return property as `${string}:${string}`
            } else {
                diags.push({
                    message: `unknown meta property ${property}`,
                    severity: 'warning',
                })
                return `-unknown-${property}`
            }
    }
}

function pushIfDefined<T>(array: T[], item: T | undefined) {
    if (item !== undefined) {
        array.push(item)
    }
}