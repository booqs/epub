import { Diagnoser, diagnoser } from './diagnostic'
import { FileProvider, getBasePath } from './file'
import {
    EpubMetadata, EpubMetadataItem, ManifestItem, NavDocument, NavOl, NavPoint, NcxDocument, Opf2Meta, PackageDocument, PackageItem, PageTarget, TocItem, Unvalidated,
} from './model'
import { loadManifestItem } from './package'
import { lazy } from './utils'
import { epubDocumentLoader } from './documents'

export function openEpub(fileProvider: FileProvider, optDiags?: Diagnoser) {
    const diags = optDiags?.scope('open epub') ?? diagnoser('open epub')
    const documents = epubDocumentLoader(fileProvider, diags)
    const packageBasePath = lazy(async () => {
        const { fullPath } = await documents('package') ?? {}
        if (fullPath == undefined) {
            return undefined
        }
        return getBasePath(fullPath)
    })
    async function loadItem(item: Unvalidated<ManifestItem>) {
        const basePath = await packageBasePath()
        if (basePath == undefined) {
            return undefined
        }
        return loadManifestItem(item, basePath, fileProvider, diags)
    }

    return {
        documents,
        async metadata(): Promise<EpubMetadata> {
            const {content} = await documents('package') ?? {}
            return content
                ? buildEpubMetadata(content, diags)
                : {}
        },
        async items() {
            const {content} = await documents('package') ?? {}
            return content
                ? manifestIterator(content, loadItem, diags)
                : []
        },
        async spine() {
            const { content } = await documents('package') ?? {}
            return content
                ? spineIterator(content, loadItem, diags)
                : []
        },
        loadItem,
        async itemForHref(href: string) {
            const { content } = await documents('package') ?? {}
            if (content == undefined) {
                return undefined
            }
            const manifestItem = content.package?.[0]?.manifest?.[0]?.item?.find(i => i['@href'] == href)
            if (manifestItem == undefined) {
                diags.push(`failed to find manifest item for href: ${href}`)
                return undefined
            }
            return manifestItem
        },
        async itemForId(id: string) {
            const {content} = await documents('package') ?? {}
            if (content == undefined) {
                return undefined
            }
            const manifestItem = content.package?.[0]?.manifest?.[0]?.item?.find(i => i['@id'] == id)
            if (manifestItem == undefined) {
                diags.push(`failed to find manifest item for id: ${id}`)
                return undefined
            }
            return loadItem(manifestItem)
        },
        toc: lazy(async () => {
            const {content} = await documents('package') ?? {}
            if (content == undefined) {
                return {
                    title: undefined,
                    items: [],
                }
            }
            const optNavDocument = await documents('nav')
            if (optNavDocument != undefined) {
                return navToc(optNavDocument.content, diags)
            }
            const optNcxDocument = await documents('ncx')
            if (optNcxDocument != undefined) {
                return ncxToc(optNcxDocument.content, diags)
            }
            diags.push('failed to find nav or ncx toc')
            return undefined
        }),
        diagnostics() {
            return diags.all()
        },
    }
}

type ItemLoader = (item: Unvalidated<ManifestItem>) => Promise<PackageItem | undefined>
function* manifestIterator(document: Unvalidated<PackageDocument>, loadItem: ItemLoader, diags: Diagnoser) {
    const itemTag = document.package?.[0]?.manifest?.[0]?.item
    if (itemTag == undefined) {
        diags.push({
            message: 'package is missing manifest items',
            data: document,
        })
        return
    }
    const items = itemTag
    for (const item of items) {
        yield {
            item,
            properties() {
                const properties = item['@properties']
                if (properties == undefined) {
                    return []
                }
                return properties.split(' ')
            },
            async load() {
                const loaded = await loadItem(item)
                if (loaded === undefined) {
                    diags.push({
                        message: 'failed to load manifest item',
                        data: item,
                    })
                    return undefined
                }
                return loaded
            }
        }
    }
}

function* spineIterator(document: Unvalidated<PackageDocument>, loadItem: ItemLoader, diags: Diagnoser) {
    const itemTag = document.package?.[0]?.spine?.[0]?.itemref
    if (itemTag == undefined) {
        diags.push({
            message: 'package is missing spine items',
            data: document,
        })
        return
    }
    const items = itemTag
    for (const item of items) {
        const idref = item['@idref']
        if (idref == undefined) {
            diags.push({
                message: 'spine item is missing idref',
                data: item,
            })
            continue
        }
        const manifestItemOpt = document.package?.[0]?.manifest?.[0]?.item?.find(i => i['@id'] == idref)
        if (manifestItemOpt == undefined) {
            diags.push({
                message: 'spine item is not in manifest',
                data: item,
            })
            continue
        }
        const manifestItem = manifestItemOpt
        yield {
            item,
            manifestItem,
            async load() {
                const loaded = await loadItem(manifestItem)
                if (loaded === undefined) {
                    diags.push({
                        message: 'failed to load manifest item',
                        data: manifestItem,
                    })
                    return undefined
                }
                return loaded
            }
        }
    }
}

function buildEpubMetadata(document: Unvalidated<PackageDocument>, diags: Diagnoser) {
    const result: EpubMetadata = {}
    const [metadata] = document.package?.[0]?.metadata ?? []
    if (metadata == undefined) {
        diags.push({
            message: 'package is missing metadata',
            data: document,
        })
        return result
    }
    const { meta, ...rest } = metadata
    for (const [key, value] of Object.entries(rest)) {
        if (!Array.isArray(value)) {
            diags.push({
                message: 'package metadata is not an array',
                data: value,
            })
            continue
        }
        result[key] = value
    }
    for (const m of (meta ?? [])) {
        const { '@name': name, '@content': content } = (m as Opf2Meta)
        if (name === undefined || content === undefined) {
            continue
        }
        const item: EpubMetadataItem = {
            '#text': content,
        }
        if (result[name] !== undefined) {
            result[name].push(item)
        } else {
            result[name] = [item]
        }
    }
    return result
}

type Toc = {
    title?: string,
    items: Generator<TocItem>,
}
function ncxToc(ncx: Unvalidated<NcxDocument>, diags: Diagnoser): Toc | undefined {
    const navMap = ncx.ncx?.[0]?.navMap
    if (navMap == undefined || navMap.length == 0) {
        const pageLists = ncx.ncx?.[0]?.pageList
        if (pageLists == undefined || pageLists.length == 0) {
            diags.push({
                message: 'ncx is missing navMap and pageList',
                data: ncx,
            })
            return undefined
        }
        if (pageLists.length > 1) {
            diags.push({
                message: 'ncx has multiple pageLists',
                data: ncx,
            })
        }
        const pageList = pageLists[0]
        if (!pageList.pageTarget?.length) {
            diags.push({
                message: 'ncx pageList is missing pageTargets',
                data: ncx,
            })
            return undefined
        }
        const title = pageList.navLabel?.[0]?.text?.[0]?.['#text']
        return {
            title,
            items: pageListIterator(pageList.pageTarget, diags),
        }
    } else {
        if (navMap.length > 1) {
            diags.push({
                message: 'ncx has multiple navMaps',
                data: ncx,
            })
        }
        const navPoints = navMap[0].navPoint
        if (navPoints == undefined || navPoints.length == 0) {
            diags.push({
                message: 'ncx navMap is missing navPoints',
                data: ncx,
            })
            return undefined
        }
        const title = ncx.ncx?.[0]?.docTitle?.[0]?.text?.[0]?.['#text']
        return {
            title,
            items: navPointsIterator(navPoints, 0, diags),
        }
    }
}

function* navPointsIterator(navPoints: Unvalidated<NavPoint>[], level: number, diags: Diagnoser): Generator<TocItem> {
    for (const navPoint of navPoints) {
        const label = navPoint.navLabel?.[0]?.text?.[0]?.['#text']
        if (label == undefined) {
            diags.push({
                message: 'navPoints navPoint is missing label',
                data: navPoint,
            })
            continue
        }
        const src = navPoint.content?.[0]?.['@src']
        if (src == undefined) {
            diags.push({
                message: 'navPoints navPoint is missing content src',
                data: navPoint,
            })
            continue
        }
        yield {
            label,
            href: src,
            level,
        }
        const children = navPoint.navPoint
        if (children) {
            yield* navPointsIterator(children, level + 1, diags)
        }
    }
}

function* pageListIterator(pageTargets: Unvalidated<PageTarget>[], diags: Diagnoser): Generator<TocItem> {
    for (const pageTarget of pageTargets) {
        const label = pageTarget.navLabel?.[0]?.text?.[0]?.['#text']
        if (label == undefined) {
            diags.push({
                message: 'pageList pageTarget is missing label',
                data: pageTarget,
            })
            continue
        }
        const src = pageTarget.content?.[0]?.['@src']
        if (src == undefined) {
            diags.push({
                message: 'pageList pageTarget is missing content src',
                data: pageTarget,
            })
            continue
        }
        yield {
            label,
            href: src,
            level: 0,
        }
    }
}

function navToc(document: Unvalidated<NavDocument>, diags: Diagnoser): Toc | undefined {
    const nav = document?.html?.[0]?.body?.[0]?.nav?.[0]
    if (nav === undefined) {
        diags.push({
            message: 'nav is missing',
            data: document,
        })
        return undefined
    }
    const headerElement = nav.h1 ?? nav.h2 ?? nav.h3 ?? nav.h4 ?? nav.h5 ?? nav.h6
    const title = headerElement?.[0]?.['#text']
    const ol = nav.ol
    if (ol === undefined) {
        diags.push({
            message: 'nav is missing ol',
            data: nav,
        })
        return undefined
    }
    return {
        title,
        items: olIterator(ol, 0, diags),
    }
}

function* olIterator(lis: Unvalidated<NavOl>[], level: number, diags: Diagnoser): Generator<TocItem> {
    for (const { li } of lis) {
        if (li == undefined) {
            continue
        }
        const anchor = li[0]?.a?.[0]
        if (anchor == undefined) {
            diags.push({
                message: 'nav ol li is missing anchor',
                data: li,
            })
            continue
        }
        const { '@href': href, '#text': label } = anchor
        if (href == undefined) {
            diags.push({
                message: 'nav ol li is missing href',
                data: li,
            })
            continue
        }
        if (label == undefined) {
            diags.push({
                message: 'nav ol li is missing label',
                data: li,
            })
            continue
        }
        yield {
            label,
            href,
            level,
        }
        const children = li[0].ol
        if (children) {
            yield* olIterator(children, level + 1, diags)
        }
    }
}