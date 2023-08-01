import { expectAttributes, processDir, processLinear } from "./attributes"
import { Diagnostics } from "./diagnostic"
import { Spine, SpineItemRef, XmlNode } from "./model"

export function processSpine(node: XmlNode, diags: Diagnostics): Spine | undefined {
    let {
        id, toc, 'page-progression-direction': pageProgressionDirection,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags.scope(node.name))
    let itemRefs: SpineItemRef[] = []
    for (let child of node.children ?? []) {
        if (child.name != 'itemref') {
            diags.push(`spine element can only have itemref children`)
            continue
        }
        let itemRef = processSpineItemRef(child, diags)
        if (itemRef) {
            itemRefs.push(itemRef)
        }
    }
    if (itemRefs.length == 0) {
        diags.push(`spine element is missing itemrefs`)
        return undefined
    }
    return {
        id,
        toc,
        pageProgressionDirection: processDir(pageProgressionDirection, diags),
        itemRefs,
    }
}

function processSpineItemRef(node: XmlNode, diags: Diagnostics): SpineItemRef | undefined {
    let {
        idref, linear,
        id, properties,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags.scope(node.name))
    if (node.children?.length ?? 0 > 0) {
        diags.push(`itemref element cannot have children`)
    }
    if (!idref) {
        diags.push(`itemref element is missing idref`)
        return undefined
    }
    return {
        idref,
        linear: processLinear(linear, diags),
        id, properties,
    }
}