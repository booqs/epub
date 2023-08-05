import { Diagnoser } from "./diagnostic"
import { loadXml, FileProvider, getBasePath, pathRelativeTo } from "./file"
import { ContainerDocument, ManifestItem, NcxDocument, Package, PackageDocument, PackageItem, Unvalidated } from "./model"
import { parseXml } from "./xml"

export function getRootfiles(container: Unvalidated<ContainerDocument> | undefined, diags: Diagnoser): string[] {
    let rootfiles = container?.container?.[0]?.rootfiles?.[0]?.rootfile
    if (!rootfiles) {
        diags.push({
            message: `container is missing rootfiles`,
            data: container
        })
        return []
    }
    let paths = rootfiles?.map(r => r['@full-path']) ?? []
    return paths.filter((p): p is string => {
        if (p == undefined) {
            diags.push(`rootfile is missing @full-path`)
            return false
        }
        return true
    })
}

export async function loadPackages(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<Package>[]> {
    let rootfiles = getRootfiles(container, diags)
    let packageOrUndefineds = rootfiles.map(async p => {
        return loadPackage(p, fileProvider, diags)
    })
    let packages = (await Promise.all(packageOrUndefineds)).filter((p): p is Unvalidated<Package> => {
        if (p == undefined) {
            diags.push(`failed to load package`)
            return false
        } else {
            return true
        }
    })
    return packages
}

async function loadPackage(fullPath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<Package> | undefined> {
    let document: Unvalidated<PackageDocument> | undefined = await loadXml(fileProvider, fullPath, diags)
    if (document == undefined) {
        diags.push(`${fullPath} package is missing`)
        return undefined
    }
    let result: Unvalidated<Package> = { fullPath, document }
    let items = await loadManifestItems(document, fullPath, fileProvider, diags)
    result.items = items
    let spine: PackageItem[] = []
    let spineElement = document?.package?.[0]?.spine?.[0]
    let itemrefs = spineElement?.itemref
    if (!itemrefs) {
        diags.push({
            message: `package is missing spine`,
            data: document,
        })
    } else {
        for (let itemref of itemrefs) {
            let idref = itemref['@idref']
            if (idref == undefined) {
                diags.push(`spine itemref is missing @idref`)
                continue
            }
            let item = items.find(i => i.item["@id"] == idref)
            if (item == undefined) {
                diags.push(`spine itemref @idref ${idref} does not match any manifest item`)
                continue
            }
            spine.push(item)
        }
        result.spine = spine
        let tocId = spineElement?.['@toc']
        if (tocId) {
            let ncx = items.find(i => i.item["@id"] == tocId)
            if (!ncx) {
                diags.push(`spine @toc ${tocId} does not match any manifest item`)
            } else if (typeof ncx.content !== 'string') {
                diags.push(`spine @toc ${tocId} is not a string`)
            } else {
                let parsed = parseXml(ncx.content, diags)
                if (parsed == undefined) {
                    diags.push(`failed to parse spine @toc ${tocId}`)
                } else {
                    result.ncx = parsed
                }
            }
        }
    }
    let nav = items.find(i => i.item["@properties"]?.includes("nav"))
    if (nav) {
        if (typeof nav.content !== 'string') {
            diags.push(`nav is not a text file`)
        } else {
            let parsed = parseXml(nav.content, diags)
            if (parsed == undefined) {
                diags.push(`failed to parse nav`)
            } else {
                result.nav = parsed
            }
        }
    }
    return result
}

export async function loadManifestItems(document: Unvalidated<PackageDocument>, documentPath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<PackageItem[]> {
    let item = document?.package?.[0]?.manifest?.[0]?.item
    if (item == undefined) {
        diags.push({
            message: `package is missing manifest items`,
            data: document,
        })
        return []
    }
    let base = getBasePath(documentPath)
    let itemOrUndefineds = item.map(i => loadManifestItem(i, base, fileProvider, diags))
    let items = (await Promise.all(itemOrUndefineds)).filter((i): i is PackageItem => {
        return i !== undefined
    })
    return items
}

export async function loadManifestItem(item: Unvalidated<ManifestItem>, basePath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<PackageItem | undefined> {
    diags = diags.scope(`manifest item: ${item['@id']}`)
    let href = item['@href']
    if (href == undefined) {
        diags.push(`manifest item is missing @href`)
        return undefined
    }
    let fullPath = sanitizeHref(pathRelativeTo(basePath, href))
    let mediaType = item['@media-type']
    switch (mediaType) {
        case 'application/xhtml+xml':
        case 'application/x-dtbncx+xml':
        case 'text/css': {
            let content = await fileProvider.readText(fullPath, diags)
            if (content == undefined) {
                diags.push(`failed to read text file ${fullPath}, base: ${basePath}`)
                return undefined
            }
            return {
                item,
                mediaType,
                kind: 'text',
                content,
            }
        }
        case 'application/x-font-ttf':
        case 'image/jpeg': case 'image/png':
        case 'image/gif': case 'image/svg+xml': {
            let content = await fileProvider.readBinary(fullPath, diags)
            if (content == undefined) {
                diags.push(`failed to read binary file ${fullPath}`)
                return undefined
            }
            return {
                item,
                mediaType,
                kind: 'binary',
                content,
            }
        }
        default: {
            diags.push(`unexpected item: ${item['@media-type']}`)
            let content = await fileProvider.readBinary(fullPath, diags)
            if (content == undefined) {
                diags.push(`failed to read binary file ${fullPath}`)
                return undefined
            }
            return {
                item,
                mediaType,
                kind: 'unknown',
                content,
            }
        }
    }
}

function sanitizeHref(href: string): string {
    if (href.endsWith('/')) {
        return href.substring(0, href.length - 1)
    } else {
        return href
    }
}