import { expectAttributes, processDir, processLang } from "./attributes"
import { Diagnostics } from "./diagnostic"
import { Meta, Meta2, Meta3, MetaProperty, XmlNode } from "./model"
import { optionalExtra } from "./utils"

export function processMeta(node: XmlNode, diags: Diagnostics): Meta | undefined {
    if (node.attrs?.property) {
        return processMeta3(node, diags)
    } else {
        return processMeta2(node, diags)
    }
}

export function processMeta2(node: XmlNode, diags: Diagnostics): Meta2 | undefined {
    let {
        name, content,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(
        rest,
        [],
        diags.scope(node.name),
    )
    if (!name) {
        diags.push(`meta2 element is missing name`)
        return undefined
    }
    if (!content) {
        diags.push(`meta2 element is missing content`)
        return undefined
    }
    return {
        name, content,
        ...optionalExtra(rest),
    }
}

export function processMeta3(node: XmlNode, diags: Diagnostics): Meta3 | undefined {
    let {
        dir, id, property, refines, scheme,
        'xml:lang': lang,
        '#text': text,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(
        rest,
        [],
        diags.scope(node.name),
    )
    if (!property) {
        diags.push(`meta3 element is missing property`)
        return undefined
    }
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