import { expectAttributes, processDir, processLang } from "./attributes"
import { Diagnostic, PackageMetadata, MetadataTitle, XmlNode, MetadataIdentifier } from "./core"
import { isEmptyObject } from "./utils"

export function processPackageMetadata(node: XmlNode, diags: Diagnostic[]): PackageMetadata | undefined {
    if (!isEmptyObject(node.attrs)) {
        diags.push({
            message: `metadata element has unexpected attributes`,
            data: node.attrs,
        })
    }
    let identifiers: MetadataIdentifier[] = []
    let titles: MetadataTitle[] = []
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'dc:identifier':
                pushIfDefined(identifiers, processIdentifier(child, diags))
                break
            case 'dc:title':
                pushIfDefined(titles, processTitle(child, diags))
                break
        }
    }
    return {
        titles,
        identifiers,
    }
}

function processIdentifier(node: XmlNode, diags: Diagnostic[]): MetadataIdentifier | undefined {
    let {
        id, '#text': text,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, ['opf:scheme'], diags)
    if (!text) {
        diags.push(`identifier element is missing text`)
        return undefined
    }
    return {
        id,
        value: text,
    }
}

function processTitle(node: XmlNode, diags: Diagnostic[]): MetadataTitle | undefined {
    let {
        dir, id, 'xml:lang': lang,
        '#text': text,
        ...rest
    } = node.attrs ?? {}
    if (!isEmptyObject(rest)) {
        diags.push({
            message: `title element has unexpected attributes`,
            data: rest,
        })
    }
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

function pushIfDefined<T>(array: T[], item: T | undefined) {
    if (item !== undefined) {
        array.push(item)
    }
}