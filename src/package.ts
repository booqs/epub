import { Diagnostics } from "./diagnostic"
import { loadXml, FileProvider, loadFile, getSiblingPath } from "./file"
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
        read(relativePath, kind) {
            return fileProvider.read(getSiblingPath(fullPath, relativePath), kind)
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

async function loadManifestItem(manifestItem: Unvalidated<ManifestItem>, fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<PackageItem> | undefined> {
    let fullPath = manifestItem['@href']
    if (fullPath == undefined) {
        diags.push(`manifest item is missing @href`)
        return undefined
    }
    let mediaType = manifestItem['@media-type']
    switch (mediaType) {
        case 'application/xhtml+xml':
            return {
                mediaType,
                html: parseHtml(await loadFile(fileProvider, fullPath, 'text', diags), diags),
            }
        case 'application/x-dtbncx+xml':
            return {
                mediaType,
                ncx: parseXml(await loadFile(fileProvider, fullPath, 'text', diags), diags),
            }
        case 'text/css':
            return {
                mediaType,
                css: await loadFile(fileProvider, fullPath, 'text', diags),
            }
        case 'image/jpeg': case 'image/png': case 'image/gif': case 'image/svg+xml':
            return {
                mediaType,
                image: await loadFile(fileProvider, fullPath, 'nodebuffer', diags),
            }
        default:
            diags.push(`unexpected item: ${manifestItem['@media-type']}`)
            return undefined
    }
}