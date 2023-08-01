import { expectAttributes, processDir } from "./attributes"
import { Diagnostics } from "./diagnostic"
import { processLink } from "./link"
import { Collection, Link, XmlNode } from "./model"

export function processCollection(node: XmlNode, diags: Diagnostics): Collection | undefined {
    let {
        id, dir, lang, role,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags.scope(node.name))
    if (!role) {
        diags.push(`collection element is missing role`)
        return undefined
    }
    let links: Link[] = []
    for (let child of node.children ?? []) {
        if (child.name != 'link') {
            diags.push(`collection element can only have item children`)
            continue
        }
        let link = processLink(child, diags)
        if (link) {
            links.push(link)
        }
    }
    if (links.length == 0) {
        diags.push(`collection element is missing links`)
    }
    return {
        role,
        id,
        dir: processDir(dir, diags),
        lang,
        links,
    }
}