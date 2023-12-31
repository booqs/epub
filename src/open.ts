import { Diagnoser, diagnoser } from "./diagnostic"
import { loadContainerDocument } from "./parse"
import { FileProvider, getBasePath, loadXml } from "./file"
import { ContainerDocument, ManifestItem, NavDocument, NavList, NavPoint, NcxDocument, Opf2Meta, PackageDocument, PackageItem, PageTarget, TocItem, Unvalidated } from "./model"
import { getRootfiles, loadManifestItem } from "./package"
import { parseXml } from "./xml"

export function openEpub(fileProvider: FileProvider, optDiags?: Diagnoser) {
    let diags = optDiags?.scope('open epub') ?? diagnoser('open epub')
    let _container: Promise<Unvalidated<ContainerDocument> | undefined> | undefined
    function getContainer() {
        if (_container == undefined) {
            _container = loadContainerDocument(fileProvider, diags)
        }
        return _container
    }
    async function container() {
        let document = await getContainer()
        if (document == undefined) {
            diags.push(`container.xml is missing`)
        }
        return document
    }
    async function* packages() {
        let container = await getContainer()
        if (container == undefined) {
            diags.push(`failed to load container.xml`)
        } else {
            yield* packageIterator(container, fileProvider, diags)
        }
    }

    return {
        container,
        packages,
        diagnostics() {
            return diags.all()
        },
    }
}

type ItemLoader = (item: Unvalidated<ManifestItem>) => Promise<PackageItem | undefined>
async function* packageIterator(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnoser) {
    let rootfiles = getRootfiles(container, diags)
    for (let fullPath of rootfiles) {
        let document: Unvalidated<PackageDocument> | undefined = await loadXml(fileProvider, fullPath, diags)
        if (document == undefined) {
            diags.push(`${fullPath} package is missing`)
            continue
        }
        let base = getBasePath(fullPath)
        const loadItem: ItemLoader = item => loadManifestItem(item, base, fileProvider, diags)
        yield {
            fullPath,
            ...openPackage(document, loadItem, diags),
        }
    }
}

function openPackage(document: Unvalidated<PackageDocument>, loadItem: ItemLoader, diags: Diagnoser) {
    return {
        document,
        metadata(): Record<string, string[]> {
            return getPackageMetadata(document, diags)
        },
        items() {
            return manifestIterator(document, loadItem, diags)
        },
        itemsForProperty: function* (property: string) {
            for (let item of manifestIterator(document, loadItem, diags)) {
                if (item.properties().includes(property)) {
                    yield item
                }
            }
        },
        spine() {
            return spineIterator(document, loadItem, diags)
        },
        loadHref(ref: string) {
            let manifestItem = document.package?.[0]?.manifest?.[0]?.item?.find(i => i['@href'] == ref)
            if (manifestItem == undefined) {
                diags.push(`failed to find manifest item for href: ${ref}`)
                return undefined
            }
            return loadItem(manifestItem)
        },
        loadId(id: string) {
            let manifestItem = document.package?.[0]?.manifest?.[0]?.item?.find(i => i['@id'] == id)
            if (manifestItem == undefined) {
                diags.push(`failed to find manifest item for id: ${id}`)
                return undefined
            }
            return loadItem(manifestItem)
        },
        async ncx() {
            let optNcxDocument = await getNcx(document, loadItem, diags)
            if (optNcxDocument == undefined) {
                return undefined
            }
            let ncxDocument = optNcxDocument
            return {
                document: ncxDocument,
                toc() {
                    return ncxToc(ncxDocument, diags)
                },
            }
        },
        async nav() {
            let optNavDocument = await getNavToc(document, loadItem, diags)
            if (optNavDocument == undefined) {
                return undefined
            }
            let navDocument = optNavDocument
            return {
                document: navDocument,
                toc() {
                    return navToc(navDocument, diags)
                },
            }
        },
        async toc(): Promise<Toc | undefined> {
            let optNavDocument = await getNavToc(document, loadItem, diags)
            if (optNavDocument != undefined) {
                return navToc(optNavDocument, diags)
            }
            let optNcxDocument = await getNcx(document, loadItem, diags)
            if (optNcxDocument != undefined) {
                return ncxToc(optNcxDocument, diags)
            }
            diags.push(`failed to find ncx or nav toc`)
            return undefined
        },
    }
}

function* manifestIterator(document: Unvalidated<PackageDocument>, loadItem: ItemLoader, diags: Diagnoser) {
    let itemTag = document.package?.[0]?.manifest?.[0]?.item
    if (itemTag == undefined) {
        diags.push({
            message: `package is missing manifest items`,
            data: document,
        })
        return
    }
    let items = itemTag
    for (let item of items) {
        yield {
            item,
            properties() {
                let properties = item['@properties']
                if (properties == undefined) {
                    return []
                }
                return properties.split(' ')
            },
            async load() {
                let loaded = await loadItem(item)
                if (loaded === undefined) {
                    diags.push({
                        message: `failed to load manifest item`,
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
    let itemTag = document.package?.[0]?.spine?.[0]?.itemref
    if (itemTag == undefined) {
        diags.push({
            message: `package is missing spine items`,
            data: document,
        })
        return
    }
    let items = itemTag
    for (let item of items) {
        let idref = item['@idref']
        if (idref == undefined) {
            diags.push({
                message: `spine item is missing idref`,
                data: item,
            })
            continue
        }
        let manifestItemOpt = document.package?.[0]?.manifest?.[0]?.item?.find(i => i['@id'] == idref)
        if (manifestItemOpt == undefined) {
            diags.push({
                message: `spine item is not in manifest`,
                data: item,
            })
            continue
        }
        let manifestItem = manifestItemOpt
        yield {
            item,
            manifestItem,
            async load() {
                let loaded = await loadItem(manifestItem)
                if (loaded === undefined) {
                    diags.push({
                        message: `failed to load manifest item`,
                        data: manifestItem,
                    })
                    return undefined
                }
                return loaded
            }
        }
    }
}

function getPackageMetadata(document: Unvalidated<PackageDocument>, diags: Diagnoser) {
    let result: Record<string, string[]> = {}
    let metadatas = document.package?.[0]?.metadata
    if (metadatas == undefined || metadatas.length == 0) {
        diags.push({
            message: `package is missing metadata`,
            data: document,
        })
        return result
    }
    if (metadatas.length > 1) {
        diags.push({
            message: `package has multiple metadata`,
            data: document,
        })
        return result
    }
    let { meta, ...metadata } = metadatas[0]
    for (let [key, value] of Object.entries(metadata)) {
        if (!Array.isArray(value)) {
            diags.push({
                message: `package metadata is not an array`,
                data: value,
            })
            continue
        }
        let values = value
            .map(v => v['#text'])
            .filter((v): v is string => {
                if (v === undefined) {
                    diags.push(`package metadata is missing text: ${key}: ${value}`)
                }
                return v !== undefined
            })
        result[key] = values
    }
    for (let m of (meta ?? [])) {
        let { '@name': name, '@content': content } = (m as Opf2Meta)
        if (name === undefined || content === undefined) {
            continue
        }
        if (result[name] !== undefined) {
            result[name].push(content)
        } else {
            result[name] = [content]
        }
    }
    return result
}

async function getNcx(document: Unvalidated<PackageDocument>, loadItem: ItemLoader, diags: Diagnoser) {
    let ncxId = document?.package?.[0].spine?.[0]?.['@toc']
    if (ncxId == undefined) {
        return undefined
    }
    let item = document?.package?.[0].manifest?.[0]?.item?.find(i => i['@id'] === ncxId)
    if (item == undefined) {
        diags.push(`failed to find manifest ncx item for id: ${ncxId}`)
        return undefined
    }
    let ncxItem = await loadItem(item)
    if (ncxItem == undefined) {
        diags.push(`failed to load ncx item for id: ${ncxId}`)
        return undefined
    }
    let ncxContent = ncxItem.content
    if (typeof ncxContent !== 'string') {
        diags.push(`ncx content is not a string`)
        return undefined
    }
    let parsed: Unvalidated<NcxDocument> | undefined = parseXml(ncxContent, diags.scope('ncx'))
    if (parsed == undefined) {
        diags.push(`failed to parse ncx content`)
        return undefined
    }
    return parsed
}

type Toc = {
    title?: string,
    items: Generator<TocItem>,
}
function ncxToc(ncx: Unvalidated<NcxDocument>, diags: Diagnoser): Toc | undefined {
    let navMap = ncx.ncx?.[0]?.navMap
    if (navMap == undefined || navMap.length == 0) {
        let pageLists = ncx.ncx?.[0]?.pageList
        if (pageLists == undefined || pageLists.length == 0) {
            diags.push({
                message: `ncx is missing navMap and pageList`,
                data: ncx,
            })
            return undefined
        }
        if (pageLists.length > 1) {
            diags.push({
                message: `ncx has multiple pageLists`,
                data: ncx,
            })
        }
        let pageList = pageLists[0]
        if (!pageList.pageTarget?.length) {
            diags.push({
                message: `ncx pageList is missing pageTargets`,
                data: ncx,
            })
            return undefined
        }
        let title = pageList.navLabel?.[0]?.text?.[0]?.["#text"]
        return {
            title,
            items: pageListIterator(pageList.pageTarget, diags),
        }
    } else {
        if (navMap.length > 1) {
            diags.push({
                message: `ncx has multiple navMaps`,
                data: ncx,
            })
        }
        let navPoints = navMap[0].navPoint
        if (navPoints == undefined || navPoints.length == 0) {
            diags.push({
                message: `ncx navMap is missing navPoints`,
                data: ncx,
            })
            return undefined
        }
        let title = ncx.ncx?.[0]?.docTitle?.[0]?.text?.[0]?.["#text"]
        return {
            title,
            items: navPointsIterator(navPoints, 0, diags),
        }
    }
}

function* navPointsIterator(navPoints: Unvalidated<NavPoint>[], level: number, diags: Diagnoser): Generator<TocItem> {
    for (let navPoint of navPoints) {
        let label = navPoint.navLabel?.[0]?.text?.[0]?.["#text"]
        if (label == undefined) {
            diags.push({
                message: `navPoints navPoint is missing label`,
                data: navPoint,
            })
            continue
        }
        let src = navPoint.content?.[0]?.['@src']
        if (src == undefined) {
            diags.push({
                message: `navPoints navPoint is missing content src`,
                data: navPoint,
            })
            continue
        }
        yield {
            label,
            href: src,
            level,
        }
        let children = navPoint.navPoint
        if (children) {
            yield* navPointsIterator(children, level + 1, diags)
        }
    }
}

function* pageListIterator(pageTargets: Unvalidated<PageTarget>[], diags: Diagnoser): Generator<TocItem> {
    for (let pageTarget of pageTargets) {
        let label = pageTarget.navLabel?.[0]?.text?.[0]?.["#text"]
        if (label == undefined) {
            diags.push({
                message: `pageList pageTarget is missing label`,
                data: pageTarget,
            })
            continue
        }
        let src = pageTarget.content?.[0]?.['@src']
        if (src == undefined) {
            diags.push({
                message: `pageList pageTarget is missing content src`,
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

async function getNavToc(document: Unvalidated<PackageDocument>, loadItem: ItemLoader, diags: Diagnoser) {
    let manifestItems = document.package?.[0]?.manifest?.[0]?.item
    if (manifestItems == undefined) {
        diags.push({
            message: `package is missing manifest items`,
            data: document,
        })
        return undefined
    }
    let tocItem = manifestItems.find(i => i['@properties']?.includes('nav'))
    if (tocItem == undefined) {
        return undefined
    }
    let loaded = await loadItem(tocItem)
    if (loaded == undefined) {
        diags.push({
            message: `failed to load nav item`,
            data: tocItem,
        })
        return undefined
    } else if (typeof loaded.content !== 'string') {
        diags.push({
            message: `nav item content is not a string`,
            data: loaded,
        })
        return undefined
    }
    let parsed: Unvalidated<NavDocument> | undefined = parseXml(loaded.content, diags.scope('nav'))
    if (parsed == undefined) {
        diags.push({
            message: `failed to parse nav item content`,
            data: loaded,
        })
        return undefined
    }
    return parsed
}

function navToc(document: Unvalidated<NavDocument>, diags: Diagnoser): Toc | undefined {
    let nav = document?.html?.[0]?.body?.[0]?.nav?.[0]
    if (nav === undefined) {
        diags.push({
            message: `nav is missing`,
            data: document,
        })
        return undefined
    }
    let headerElement = nav.h1 ?? nav.h2 ?? nav.h3 ?? nav.h4 ?? nav.h5 ?? nav.h6
    let title = headerElement?.[0]?.["#text"]
    let ol = nav.ol
    if (ol === undefined) {
        diags.push({
            message: `nav is missing ol`,
            data: nav,
        })
        return undefined
    }
    return {
        title,
        items: olIterator(ol, 0, diags),
    }
}

function* olIterator(lis: Unvalidated<NavList>[], level: number, diags: Diagnoser): Generator<TocItem> {
    for (let { li } of lis) {
        if (li == undefined) {
            continue
        }
        let anchor = li[0]?.a?.[0]
        if (anchor == undefined) {
            diags.push({
                message: `nav ol li is missing anchor`,
                data: li,
            })
            continue
        }
        let { '@href': href, '#text': label } = anchor
        if (href == undefined) {
            diags.push({
                message: `nav ol li is missing href`,
                data: li,
            })
            continue
        }
        if (label == undefined) {
            diags.push({
                message: `nav ol li is missing label`,
                data: li,
            })
            continue
        }
        yield {
            label,
            href,
            level,
        }
        let children = li[0].ol
        if (children) {
            yield* olIterator(children, level + 1, diags)
        }
    }
}