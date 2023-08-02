import { Diagnostics } from "./diagnostic"
import { loadXml, FileProvider, getSiblingPath } from "./file"
import { ContainerDocument, ManifestItem, Package, PackageDocument, PackageItem, Unvalidated } from "./model"
import { parseHtml, parseXml } from "./xml"

export async function loadPackages(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<Package>[]> {
    let rootfiles = container?.container?.[0]?.rootfiles?.[0]?.rootfile
    if (!rootfiles) {
        diags.push({
            message: `container is missing rootfiles`,
            data: container
        })
        return []
    }
    let paths = rootfiles?.map(r => r['@full-path']) ?? []
    let packageOrUndefineds = paths.map(async p => {
        if (p == undefined) {
            diags.push(`rootfile is missing @full-path`)
            return undefined
        }
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
    let items = await loadManifestItems(document, {
        readText(relativePath) {
            return fileProvider.readText(getSiblingPath(fullPath, relativePath))
        },
        readBuffer(relativePath) {
            return fileProvider.readBuffer(getSiblingPath(fullPath, relativePath))
        },
    }, diags)
    return {
        fullPath,
        document,
        items,
    }
}

export async function loadManifestItems(document: Unvalidated<PackageDocument>, fileProvider: FileProvider, diags: Diagnostics): Promise<PackageItem[]> {
    let item = document?.package?.[0]?.manifest?.[0]?.item
    if (item == undefined) {
        diags.push({
            message: `package is missing manifest items`,
            data: document,
        })
        return []
    }
    let itemOrUndefineds = item.map(i => loadManifestItem(i, fileProvider, diags))
    let items = (await Promise.all(itemOrUndefineds)).filter((i): i is PackageItem => {
        return i !== undefined
    })
    return items
}

async function loadManifestItem(item: Unvalidated<ManifestItem>, fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<PackageItem> | undefined> {
    let fullPath = item['@href']
    if (fullPath == undefined) {
        diags.push(`manifest item is missing @href`)
        return undefined
    }
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
                content,
            }
        }
        case 'image/jpeg': case 'image/png':
        case 'image/gif': case 'image/svg+xml': {
            let content = await fileProvider.readBuffer(fullPath)
            if (content == undefined) {
                diags.push(`failed to read buffer file ${fullPath}`)
                return undefined
            }
            return {
                item,
                mediaType,
                content,
            }
        }
        default:
            diags.push(`unexpected item: ${item['@media-type']}`)
            return undefined
    }
}