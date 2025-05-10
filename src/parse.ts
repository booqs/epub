import { Unvalidated } from './model'
import { Diagnoser, diagnoser } from './diagnostic'
import { FileProvider, getBasePath, loadOptionalXml, loadXml } from './file'
import { loadManifestItem, PackageItem } from './manifest'
import { parseXml } from './xml'
import { ContainerDocument, EncryptionDocument, ManifestDocument, MetadataDocument, NavDocument, NcxDocument, PackageDocument, RightsDocument, SignaturesDocument } from './model'

export type Package = {
    fullPath: string,
    document: PackageDocument,
    items: PackageItem[],
    spine: PackageItem[],
    ncx?: NcxDocument,
    nav?: NavDocument,
}
export type FullEpub = {
    mimetype: 'application/epub+zip',
    container: ContainerDocument,
    package: Package,
    encryption?: EncryptionDocument,
    manifest?: ManifestDocument,
    metadata?: MetadataDocument,
    rights?: RightsDocument,
    signatures?: SignaturesDocument,
}

export async function parseEpub(fileProvider: FileProvider, diags?: Diagnoser): Promise<Unvalidated<FullEpub> | undefined> {
    diags = diags ?? diagnoser('parseEpub')
    const mimetype = await loadMimetype(fileProvider, diags)
    const container = await loadContainerDocument(fileProvider, diags)
    if (container == undefined) {
        return undefined
    }
    const pkg = await loadPackage(container, fileProvider, diags)
    const encryption = await loadEncryptionDocument(fileProvider, diags)
    const manifest = await loadManifestDocument(fileProvider, diags)
    const metadata = await loadMetadataDocument(fileProvider, diags)
    const rights = await loadRightsDocument(fileProvider, diags)
    const signatures = await loadSignaturesDocument(fileProvider, diags)
    return {
        mimetype,
        container,
        package: pkg,
        encryption,
        manifest,
        metadata,
        rights,
        signatures,
    }
}

export async function loadContainerDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<ContainerDocument> | undefined> {
    return loadXml(fileProvider, 'META-INF/container.xml', diags)
}

export async function loadEncryptionDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<EncryptionDocument> | undefined> {
    return loadOptionalXml(fileProvider, 'META-INF/encryption.xml', diags)
}

export async function loadManifestDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<ManifestDocument> | undefined> {
    return loadOptionalXml(fileProvider, 'META-INF/manifest.xml', diags)
}

export async function loadMetadataDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<MetadataDocument> | undefined> {
    return loadOptionalXml(fileProvider, 'META-INF/metadata.xml', diags)
}

export async function loadRightsDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<RightsDocument> | undefined> {
    return loadOptionalXml(fileProvider, 'META-INF/rights.xml', diags)
}

export async function loadSignaturesDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<SignaturesDocument> | undefined> {
    return loadOptionalXml(fileProvider, 'META-INF/signatures.xml', diags)
}

export async function loadMimetype(fileProvider: FileProvider, diags: Diagnoser): Promise<string | undefined> {
    const mimetype = fileProvider.readText('mimetype', diags)
    if (!mimetype) {
        diags.push({
            message: 'missing mimetype',
        })
    }
    return mimetype
}

export async function loadPackage(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<Package> | undefined> {
    const [rootfile] = container?.container?.[0]?.rootfiles?.[0]?.rootfile ?? []
    const fullPath = rootfile?.['@full-path']
    if (fullPath == undefined) {
        diags.push({
            message: 'container is missing rootfile full path',
            data: container,
        })
        return undefined
    }
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

async function loadManifestItems(document: Unvalidated<PackageDocument>, documentPath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<PackageItem[]> {
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

