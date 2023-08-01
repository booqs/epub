import { expectAttributes } from "./attributes"
import { Diagnostics } from "./diagnostic"
import { Manifest, ManifestItem, XmlNode } from "./model"
import { optionalExtra } from "./utils"

export function processManifest(node: XmlNode, diags: Diagnostics): Manifest | undefined {
    let {
        id, ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags.scope(node.name))
    let items: ManifestItem[] = []
    for (let child of node.children ?? []) {
        if (child.name != 'item') {
            diags.push(`manifest element can only have item children`)
            continue
        }
        let item = processManifestItem(child, diags)
        if (item) {
            items.push(item)
        }
    }
    if (items.length == 0) {
        diags.push(`manifest element is missing items`)
        return undefined
    }
    // TODO: validate fallbacks are valid ids
    return {
        id,
        items,
        ...optionalExtra(rest),
    }
}

function processManifestItem(node: XmlNode, diags: Diagnostics): ManifestItem | undefined {
    let {
        id, href, 'media-type': mediaType,
        properties, fallback, 'media-overlay': mediaOverlay,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags.scope(node.name))
    if (node.children?.length ?? 0 > 0) {
        diags.push(`item element cannot have children`)
    }
    if (!id) {
        diags.push(`item element is missing id`)
        return undefined
    }
    if (!href) {
        diags.push(`item element is missing href`)
        return undefined
    }
    if (!mediaType) {
        diags.push(`item element is missing media_type`)
        return undefined
    }
    return {
        id, href, mediaType,
        properties,
        fallback,
        mediaOverlay,
        ...optionalExtra(rest),
    }
}