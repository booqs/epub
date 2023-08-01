import { expectAttributes } from "./attributes"
import { Diagnostics } from "./diagnostic"
import { Link, XmlNode } from "./model"
import { optionalExtra } from "./utils"

export function processLink(node: XmlNode, diags: Diagnostics): Link | undefined {
    let {
        href, hreflang, id, 'media-type': mediaType, rel, refines, properties,
        '#text': text,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(
        rest,
        [],
        diags.scope(node.name),
    )
    if (text) {
        diags.push({
            message: `link element cannot have text`,
            severity: 'warning',
            data: node.attrs,
        })
    }
    if (!href) {
        diags.push({
            message: `link element is missing href`,
            data: node.attrs,
        })
        return undefined
    }
    return {
        href, hreflang, id, mediaType, rel, refines, properties,
        ...optionalExtra(rest),
    }
}