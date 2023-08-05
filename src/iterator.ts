import { Diagnoser, diagnostics } from "./diagnostic"
import { loadContainerDocument } from "./epub"
import { FileProvider, getBasePath, loadXml } from "./file"
import { ContainerDocument, ManifestItem, NavPoint, NcxDocument, Opf2Meta, PackageDocument, PackageItem, TocItem, Unvalidated } from "./model"
import { getRootfiles, loadManifestItem } from "./package"
import { parseXml } from "./xml"

export function epubIterator(fileProvider: FileProvider) {
    let diags = diagnostics('epubIterator')
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
            yield* containerIterator(container, fileProvider, diags)
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
async function* containerIterator(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnoser) {
    let rootfiles = getRootfiles(container, diags)
    for (let fullPath of rootfiles) {
        let documentOpt: Unvalidated<PackageDocument> | undefined = await loadXml(fileProvider, fullPath, diags)
        if (documentOpt == undefined) {
            diags.push(`${fullPath} package is missing`)
            continue
        }
        let document = documentOpt
        let base = getBasePath(fullPath)
        const loadItem: ItemLoader = item => loadManifestItem(item, base, fileProvider, diags)
        yield {
            fullPath,
            document: documentOpt,
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
                        return ncxIterator(ncxDocument, diags)
                    },
                }
            }
        }
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

function* ncxIterator(ncx: Unvalidated<NcxDocument>, diags: Diagnoser): Generator<TocItem> {
    let navMap = ncx.ncx?.[0]?.navMap
    if (navMap == undefined || navMap.length == 0) {
        diags.push({
            message: `ncx is missing navMap`,
            data: ncx,
        })
        return
    } else if (navMap.length > 1) {
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
        return
    }
    yield* navPointsIterator(navPoints, 0, diags)
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