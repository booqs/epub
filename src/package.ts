import { Diagnoser } from './diagnostic'
import { loadXml, FileProvider, getBasePath, pathRelativeTo } from './file'
import { ContainerDocument, ManifestItem, Package, PackageDocument, PackageItem, Unvalidated } from './model'
import { parseXml } from './xml'

// TODO: move to open.ts
export function getRootfiles(container: Unvalidated<ContainerDocument> | undefined, diags: Diagnoser): string[] {
    const rootfiles = container?.container?.[0]?.rootfiles?.[0]?.rootfile
    if (!rootfiles) {
        diags.push({
            message: 'container is missing rootfiles',
            data: container
        })
        return []
    }
    const paths = rootfiles?.map(r => r['@full-path']) ?? []
    return paths.filter((p): p is string => {
        if (p == undefined) {
            diags.push('rootfile is missing @full-path')
            return false
        }
        return true
    })
}

// TODO: remove this completely?
export async function loadPackages(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<Package>[]> {
    const rootfiles = getRootfiles(container, diags)
    const packageOrUndefineds = rootfiles.map(async p => {
        return loadPackage(p, fileProvider, diags)
    })
    const packages = (await Promise.all(packageOrUndefineds)).filter((p): p is Unvalidated<Package> => {
        if (p == undefined) {
            diags.push('failed to load package')
            return false
        } else {
            return true
        }
    })
    return packages
}

async function loadPackage(fullPath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<Package> | undefined> {
    const document: Unvalidated<PackageDocument> | undefined = await loadXml(fileProvider, fullPath, diags)
    if (document == undefined) {
        diags.push(`${fullPath} package is missing`)
        return undefined
    }
    const result: Unvalidated<Package> = { fullPath, document }
    const items = await loadManifestItems(document, fullPath, fileProvider, diags)
    result.items = items
    const spine: PackageItem[] = []
    const spineElement = document?.package?.[0]?.spine?.[0]
    const itemrefs = spineElement?.itemref
    if (!itemrefs) {
        diags.push({
            message: 'package is missing spine',
            data: document,
        })
    } else {
        for (const itemref of itemrefs) {
            const idref = itemref['@idref']
            if (idref == undefined) {
                diags.push('spine itemref is missing @idref')
                continue
            }
            const item = items.find(i => i.item['@id'] == idref)
            if (item == undefined) {
                diags.push(`spine itemref @idref ${idref} does not match any manifest item`)
                continue
            }
            spine.push(item)
        }
        result.spine = spine
        const tocId = spineElement?.['@toc']
        if (tocId) {
            const ncx = items.find(i => i.item['@id'] == tocId)
            if (!ncx) {
                diags.push(`spine @toc ${tocId} does not match any manifest item`)
            } else if (typeof ncx.content !== 'string') {
                diags.push(`spine @toc ${tocId} is not a string`)
            } else {
                const parsed = parseXml(ncx.content, diags)
                if (parsed == undefined) {
                    diags.push(`failed to parse spine @toc ${tocId}`)
                } else {
                    result.ncx = parsed
                }
            }
        }
    }
    const nav = items.find(i => i.item['@properties']?.includes('nav'))
    if (nav) {
        if (typeof nav.content !== 'string') {
            diags.push('nav is not a text file')
        } else {
            const parsed = parseXml(nav.content, diags)
            if (parsed == undefined) {
                diags.push('failed to parse nav')
            } else {
                result.nav = parsed
            }
        }
    }
    return result
}

export async function loadManifestItems(document: Unvalidated<PackageDocument>, documentPath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<PackageItem[]> {
    const item = document?.package?.[0]?.manifest?.[0]?.item
    if (item == undefined) {
        diags.push({
            message: 'package is missing manifest items',
            data: document,
        })
        return []
    }
    const base = getBasePath(documentPath)
    const itemOrUndefineds = item.map(i => loadManifestItem(i, base, fileProvider, diags))
    const items = (await Promise.all(itemOrUndefineds)).filter((i): i is PackageItem => {
        return i !== undefined
    })
    return items
}

// TODO: move to open.ts
export async function loadManifestItem(item: Unvalidated<ManifestItem>, basePath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<PackageItem | undefined> {
    diags = diags.scope(`manifest item: ${item['@id']}`)
    const href = item['@href']
    if (href == undefined) {
        diags.push('manifest item is missing @href')
        return undefined
    }
    const fullPath = sanitizeHref(pathRelativeTo(basePath, href))
    const mediaType = item['@media-type']
    switch (mediaType) {
    case 'application/xhtml+xml':
    case 'application/x-dtbncx+xml':
    case 'text/css': {
        const content = await fileProvider.readText(fullPath, diags)
        if (content == undefined) {
            diags.push(`failed to read text file ${fullPath}, base: ${basePath}`)
            return undefined
        }
        return {
            item,
            mediaType,
            kind: 'text',
            content,
            fullPath,
        }
    }
    case 'application/x-font-ttf':
    case 'image/jpeg': case 'image/png':
    case 'image/gif': case 'image/svg+xml': {
        const content = await fileProvider.readBinary(fullPath, diags)
        if (content == undefined) {
            diags.push(`failed to read binary file ${fullPath}`)
            return undefined
        }
        return {
            item,
            mediaType,
            kind: 'binary',
            content,
            fullPath,
        }
    }
    default: {
        diags.push(`unexpected item: ${item['@media-type']}`)
        const content = await fileProvider.readBinary(fullPath, diags)
        if (content == undefined) {
            diags.push(`failed to read binary file ${fullPath}`)
            return undefined
        }
        return {
            item,
            mediaType,
            kind: 'unknown',
            content,
            fullPath,
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