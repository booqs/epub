import { Diagnostics } from "./diagnostic"
import { loadXml, FileProvider, getBasePath, pathRelativeTo } from "./file"
import { ContainerDocument, ManifestItem, Package, PackageDocument, PackageItem, Unvalidated } from "./model"

export function getRootfiles(container: Unvalidated<ContainerDocument> | undefined, diags: Diagnostics): string[] {
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

export async function loadPackages(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<Package>[]> {
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

async function loadPackage(fullPath: string, fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<Package> | undefined> {
    let document = await loadXml(fileProvider, fullPath, diags)
    if (document == undefined) {
        diags.push(`${fullPath} package is missing`)
        return undefined
    }
    let items = await loadManifestItems(document, fullPath, fileProvider, diags)
    return {
        fullPath,
        document,
        items,
    }
}

export async function loadManifestItems(document: Unvalidated<PackageDocument>, documentPath: string, fileProvider: FileProvider, diags: Diagnostics): Promise<PackageItem[]> {
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

export async function loadManifestItem(item: Unvalidated<ManifestItem>, basePath: string, fileProvider: FileProvider, diags: Diagnostics): Promise<PackageItem | undefined> {
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
            let content = await fileProvider.readText(fullPath)
            if (content == undefined) {
                diags.push(`failed to read text file ${fullPath}`)
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
            let content = await fileProvider.readBinary(fullPath)
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
            let content = await fileProvider.readBinary(fullPath)
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