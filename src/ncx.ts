import { expectAttributes, processNumberAttr } from "./attributes"
import { Diagnostics } from "./diagnostic"
import { processMeta2 } from "./meta"
import {
    Meta2, NCX, NCXHead, NavContent, NavList, NavMap, NavPoint, NavTarget, PageList, PageTarget,
    XmlNode,
} from "./model"
import { pushIfDefined } from "./utils"

export function processNcx(node: XmlNode, diags: Diagnostics): NCX | undefined {
    let {
        version, 'xml:lang': lang, xmlns,
        ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags)
    if (version !== '2005-1') {
        diags.push({
            severity: 'warning',
            message: `ncx version ${version} is not supported`,
        })
    }
    let head: NCXHead | undefined
    let title: string | undefined
    let author: string | undefined
    let navMap: NavMap | undefined
    let pageList: PageList | undefined
    let navList: NavList | undefined
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'head':
                if (head !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx head element already defined`,
                    })
                    continue
                }
                head = processHead(child, diags)
                break
            case 'docTitle':
                if (title !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx docTitle element already defined`,
                    })
                    continue
                }
                title = processLabelContent(child, diags)
                break
            case 'docAuthor':
                if (author !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx docAuthor element already defined`,
                    })
                    continue
                }
                author = processLabelContent(child, diags)
                break
            case 'navMap':
                if (navMap !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx navMap element already defined`,
                    })
                    continue
                }
                navMap = processNavMap(child, diags)
                break
            case 'pageList':
                if (pageList !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx pageList element already defined`,
                    })
                    continue
                }
                pageList = processPageList(child, diags)
                break
            case 'navList':
                if (navList !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx navList element already defined`,
                    })
                    continue
                }
                navList = processNavList(child, diags)
                break
            default:
                diags.push({
                    severity: 'warning',
                    message: `unexpected ncx element ${child.name}`,
                })
        }
    }
    if (navMap === undefined) {
        diags.push({
            severity: 'warning',
            message: `ncx navMap element is missing`,
        })
        return undefined
    }
    return {
        version, lang, head, title, author,
        navMap, pageList, navList,
    }
}

function processHead(node: XmlNode, diags: Diagnostics): NCXHead | undefined {
    expectAttributes(node.attrs ?? {}, [], diags)
    let meta: Meta2[] = []
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'meta':
                pushIfDefined(meta, processMeta2(child, diags))
                break
            default:
                diags.push({
                    severity: 'warning',
                    message: `unexpected ncx head element ${child.name}`,
                })
                break
        }
    }
    return {
        meta,
    }
}

function processLabelContent(node: XmlNode, diags: Diagnostics): string | undefined {
    expectAttributes(node.attrs ?? {}, [], diags)
    let nodes = node.children ?? []
    if (nodes.length === 0) {
        diags.push(`label element is missing text`)
        return undefined
    } else if (nodes.length > 1) {
        diags.push(`label element has multiple nodes`)
    }
    let result = ''
    for (let node of nodes) {
        if (node.name !== 'text') {
            diags.push(`label element is not text`)
            continue
        }
        let {
            '#text': text,
            ...rest
        } = node.attrs ?? {}
        expectAttributes(rest, [], diags.scope(node.name))
        if (!text) {
            diags.push(`label element is missing text`)
            continue
        }
        result += text
    }
    return result
}

function processNavMap(node: XmlNode, diags: Diagnostics): NavMap | undefined {
    expectAttributes(node.attrs ?? {}, [], diags)
    let navPoints: NavPoint[] = []
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'navPoint':
                pushIfDefined(navPoints, processNavPoint(child, diags))
                break
            default:
                diags.push({
                    severity: 'warning',
                    message: `unexpected ncx navMap element ${child.name}`,
                })
                break
        }
    }
    return {
        navPoints,
    }
}

function processNavPoint(node: XmlNode, diags: Diagnostics): NavPoint | undefined {
    let {
        id, playOrder, class: className, ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags)
    let label: string | undefined
    let content: string | undefined
    let navPoints: NavPoint[] = []
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'navLabel':
                if (label !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx navLabel element already defined`,
                    })
                    continue
                }
                label = processLabelContent(child, diags)
                break
            case 'content':
                if (content !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx content element already defined`,
                    })
                    continue
                }
                content = processNavContent(child, diags)
                break
            case 'navPoint':
                pushIfDefined(navPoints, processNavPoint(child, diags))
                break
            default:
                diags.push({
                    severity: 'warning',
                    message: `unexpected ncx navPoint element ${child.name}`,
                })
                break
        }
    }
    return {
        id,
        playOrder: processNumberAttr(playOrder, diags.scope('playOrder')),
        className,
        label,
        content,
        navPoints,
    }
}

function processNavContent(node: XmlNode, diags: Diagnostics): NavContent | undefined {
    let {
        src, ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags)
    if (!src) {
        diags.push(`ncx content element is missing src`)
        return undefined
    }
    return src
}

function processPageList(node: XmlNode, diags: Diagnostics): PageList | undefined {
    expectAttributes(node.attrs ?? {}, [], diags)
    let pageTargets: PageTarget[] = []
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'pageTarget':
                pushIfDefined(pageTargets, processPageTarget(child, diags))
                break
            default:
                diags.push({
                    severity: 'warning',
                    message: `unexpected ncx pageList element ${child.name}`,
                })
                break
        }
    }
    return {
        pageTargets,
    }
}

function processPageTarget(node: XmlNode, diags: Diagnostics): PageTarget | undefined {
    let {
        id, value, type, ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags)
    let label: string | undefined
    let content: NavContent | undefined
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'navLabel':
                if (label !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx navLabel element already defined`,
                    })
                    continue
                }
                label = processLabelContent(child, diags)
                break
            case 'content':
                if (content !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx content element already defined`,
                    })
                    continue
                }
                content = processNavContent(child, diags)
                break
            default:
                diags.push({
                    severity: 'warning',
                    message: `unexpected ncx pageTarget element ${child.name}`,
                })
                break
        }
    }
    if (!label) {
        diags.push(`ncx pageTarget element is missing label`)
        return undefined
    }
    if (!content) {
        diags.push(`ncx pageTarget element is missing content`)
        return undefined
    }
    return {
        id,
        value: processNumberAttr(value, diags.scope('value')),
        type,
        label,
        content,
    }
}

function processNavList(node: XmlNode, diags: Diagnostics): NavList | undefined {
    expectAttributes(node.attrs ?? {}, [], diags)
    let label: string | undefined
    let navTargets: NavTarget[] = []
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'navTarget':
                pushIfDefined(navTargets, processNavTarget(child, diags))
                break
            default:
                diags.push({
                    severity: 'warning',
                    message: `unexpected ncx navList element ${child.name}`,
                })
                break
        }
    }
    return {
        navTargets,
    }
}

function processNavTarget(node: XmlNode, diags: Diagnostics): NavTarget | undefined {
    let {
        id, ...rest
    } = node.attrs ?? {}
    expectAttributes(rest, [], diags)
    let label: string | undefined
    let content: NavContent | undefined
    for (let child of node.children ?? []) {
        switch (child.name) {
            case 'navLabel':
                if (label !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx navLabel element already defined`,
                    })
                    continue
                }
                label = processLabelContent(child, diags)
                break
            case 'content':
                if (content !== undefined) {
                    diags.push({
                        severity: 'warning',
                        message: `ncx content element already defined`,
                    })
                    continue
                }
                content = processNavContent(child, diags)
                break
            default:
                diags.push({
                    severity: 'warning',
                    message: `unexpected ncx navTarget element ${child.name}`,
                })
                break
        }
    }
    if (!label) {
        diags.push(`ncx navTarget element is missing label`)
        return undefined
    }
    if (!content) {
        diags.push(`ncx navTarget element is missing content`)
        return undefined
    }
    return {
        id,
        label,
        content,
    }
}