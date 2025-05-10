import { Diagnoser } from './diagnostic'
import { FileProvider, pathRelativeTo } from './file'
import { ManifestItem, PackageDocument, PackageItem, Unvalidated } from './model'

export function  manifestItemForHref(packageDocument: Unvalidated<PackageDocument>, href: string, diags: Diagnoser): Unvalidated<ManifestItem> | undefined {
    const manifestItem = packageDocument.package?.[0]?.manifest?.[0]?.item?.find(i => i['@href'] == href)
    if (manifestItem == undefined) {
        diags.push(`failed to find manifest item for href: ${href}`)
        return undefined
    }
    return manifestItem
}
export function manifestItemForId(packageDocument: Unvalidated<PackageDocument>, id: string, diags: Diagnoser): Unvalidated<ManifestItem> | undefined {
    const manifestItem = packageDocument.package?.[0]?.manifest?.[0]?.item?.find(i => i['@id'] == id)
    if (manifestItem == undefined) {
        diags.push(`failed to find manifest item for id: ${id}`)
        return undefined
    }
    return manifestItem
}

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