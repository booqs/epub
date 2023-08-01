import { expectAttributes } from "./attributes"
import { Diagnostics } from "./diagnostic"
import { Guide, Reference, ReferenceType, XmlNode } from "./model"

export function processGuide(node: XmlNode, diags: Diagnostics): Guide | undefined {
    expectAttributes(node.attrs ?? {}, [], diags.scope(node.name))
    let references: Reference[] = []
    for (let child of node.children ?? []) {
        if (child.name != 'reference') {
            diags.push(`guide element can only have reference children`)
            continue
        }
        let reference = processReference(child, diags)
        if (reference) {
            references.push(reference)
        }
    }
    return {
        references,
    }
}

function processReference(node: XmlNode, diags: Diagnostics): Reference | undefined {
    let {
        type, title, href,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags.scope(node.name))
    if (node.children?.length ?? 0 > 0) {
        diags.push(`reference element cannot have children`)
    }
    if (!type) {
        diags.push(`reference element is missing type`)
        return undefined
    }
    if (!href) {
        diags.push(`reference element is missing href`)
        return undefined
    }
    return {
        type: processType(type, diags),
        title,
        href,
    }
}

function processType(type: string, diags: Diagnostics): ReferenceType {
    switch (type) {
        case 'cover': case 'title-page': case 'toc': case 'index':
        case 'glossary': case 'acknowledgements': case 'bibliography':
        case 'colophon': case 'copyright-page': case 'dedication':
        case 'epigraph': case 'foreword': case 'loi': case 'lot':
        case 'notes': case 'preface': case 'text':
            return type
        default:
            diags.push({
                message: `unknown reference type: ${type}`,
                severity: 'warning',
            })
            return `-unknown-${type}`
    }
}