import { expectAttributes, processDir, processLang } from "./attributes"
import {
    PackageMetadata, MetadataTitle, XmlNode, MetadataIdentifier, Diagnostics,
} from "./core"

export function processPackageMetadata(node: XmlNode, diags: Diagnostics): PackageMetadata | undefined {
    expectAttributes(node.attrs ?? {}, [], diags.scope(node.name))
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

function pushIfDefined<T>(array: T[], item: T | undefined) {
    if (item !== undefined) {
        array.push(item)
    }
}