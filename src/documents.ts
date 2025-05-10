import { Diagnoser } from './diagnostic'
import { FileProvider, getBasePath } from './file'
import { ContainerDocument, EncryptionDocument, ManifestDocument, MetadataDocument, NavDocument, NcxDocument, PackageDocument, RightsDocument, SignaturesDocument, Unvalidated, Xml } from './model'
import { loadManifestItem } from './manifest'
import { lazy } from './utils'
import { parseXml } from './xml'

export type Documents = {
    mimetype: 'application/epub+zip',
    container: ContainerDocument,
    encryption: EncryptionDocument,
    signatures: SignaturesDocument,
    manifest: ManifestDocument,
    metadata: MetadataDocument,
    rights: RightsDocument,
    package: PackageDocument,
    ncx: NcxDocument,
    nav: NavDocument,
}
type DocumentData<Content> = {
    fullPath: string,
    content: Unvalidated<Content>,
}
export function epubDocumentLoader(fileProvider: FileProvider, diags: Diagnoser) {
    const loaders: {
        [Key in keyof Documents]: () => Promise<DocumentData<Unvalidated<Documents[Key]>> | undefined>
    } = {
        mimetype: lazy(() => loadMimetypeData(fileProvider, diags)),
        container: lazy(() => loadXmlData(fileProvider, 'META-INF/container.xml', false, diags)),
        encryption: lazy(() => loadXmlData(fileProvider, 'META-INF/encryption.xml', true, diags)),
        signatures: lazy(() => loadXmlData(fileProvider, 'META-INF/signatures.xml', true, diags)),
        manifest: lazy(() => loadXmlData(fileProvider, 'META-INF/manifest.xml', true, diags)),
        metadata: lazy(() => loadXmlData(fileProvider, 'META-INF/metadata.xml', true, diags)),
        rights: lazy(() => loadXmlData(fileProvider, 'META-INF/rights.xml', true, diags)),
        package: lazy(async () => {
            const containerData = await loaders.container()
            if (containerData == undefined) {
                diags.push('container is missing')
                return undefined
            }
            return loadPackageData(containerData.content, fileProvider, diags)
        }),
        nav: lazy(async () => {
            const packageData = await loaders.package()
            if (packageData == undefined) {
                diags.push('package is missing')
                return undefined
            }
            const packageBasePath = getBasePath(packageData.fullPath)
            return loadNavData(packageData.content, packageBasePath, fileProvider, diags)
        }),
        ncx: lazy(async () => {
            const packageData = await loaders.package()
            if (packageData == undefined) {
                diags.push('package is missing')
                return undefined
            }
            const packageBasePath = getBasePath(packageData.fullPath)
            return loadNcxData(packageData.content, packageBasePath, fileProvider, diags)
        }),
    }
    return async function<Key extends keyof Documents>(key: Key): Promise<DocumentData<Unvalidated<Documents[Key]>> | undefined> {
        return loaders[key]()
    }
}

async function loadMimetypeData(fileProvider: FileProvider, diags: Diagnoser) {
    const fullPath = 'mimetype'
    const content = await fileProvider.readText(fullPath, diags)
    if (content == undefined) {
        diags.push(`${fullPath} is missing`)
        return undefined
    }
    if (content !== 'application/epub+zip') {
        diags.push(`mimetype is not application/epub+zip: ${content}`)
    }
    return {
        fullPath,
        content,
    }
}

async function loadPackageData(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnoser) {
    const [rootfile] = container?.container?.[0]?.rootfiles?.[0]?.rootfile ?? []
    if (!rootfile) {
        diags.push({
            message: 'container is missing rootfile',
            data: container
        })
        return undefined
    }
    const fullPath = rootfile['@full-path']
    if (fullPath == undefined) {
        diags.push('rootfile is missing @full-path')
        return undefined
    }
    if (fullPath == undefined) {
        diags.push('container is missing package full path')
        return undefined
    }
    return loadXmlData(fileProvider, fullPath, false, diags)
}

async function loadNavData(document: Unvalidated<PackageDocument>, packageBasePath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<DocumentData<NavDocument> | undefined> {
    const manifestItems = document.package?.[0]?.manifest?.[0]?.item
    if (manifestItems == undefined) {
        diags.push({
            message: 'package is missing manifest items',
            data: document,
        })
        return undefined
    }
    const tocItem = manifestItems.find(i => i['@properties']?.includes('nav'))
    if (tocItem == undefined) {
        return undefined
    }
    const loaded = await loadManifestItem(tocItem, packageBasePath, fileProvider, diags)
    if (loaded == undefined) {
        diags.push({
            message: 'failed to load nav item',
            data: tocItem,
        })
        return undefined
    } else if (typeof loaded.content !== 'string') {
        diags.push({
            message: 'nav item content is not a string',
            data: loaded,
        })
        return undefined
    }
    const parsed: Unvalidated<NavDocument> | undefined = parseXml(loaded.content, diags.scope('nav'))
    if (parsed === undefined) {
        diags.push({
            message: 'failed to parse nav item content',
            data: loaded,
        })
        return undefined
    }
    return {
        fullPath: loaded.fullPath,
        content: parsed,
    }
}

async function loadNcxData(document: Unvalidated<PackageDocument>, packageBasePath: string, fileProvider: FileProvider, diags: Diagnoser): Promise<DocumentData<NcxDocument> | undefined> {
    const ncxId = document?.package?.[0].spine?.[0]?.['@toc']
    if (ncxId == undefined) {
        return undefined
    }
    const item = document?.package?.[0].manifest?.[0]?.item?.find(i => i['@id'] === ncxId)
    if (item == undefined) {
        diags.push(`failed to find manifest ncx item for id: ${ncxId}`)
        return undefined
    }
    const ncxItem = await loadManifestItem(item, packageBasePath, fileProvider, diags)
    if (ncxItem == undefined) {
        diags.push(`failed to load ncx item for id: ${ncxId}`)
        return undefined
    }
    const ncxContent = ncxItem.content
    if (typeof ncxContent !== 'string') {
        diags.push('ncx content is not a string')
        return undefined
    }
    const parsed: Unvalidated<NcxDocument> | undefined = parseXml(ncxContent, diags.scope('ncx'))
    if (parsed == undefined) {
        diags.push('failed to parse ncx content')
        return undefined
    }
    return {
        fullPath: ncxItem.fullPath,
        content: parsed,
    }
}

async function loadXmlData(fileProvider: FileProvider, fullPath: string, optional: boolean, diags: Diagnoser): Promise<DocumentData<Xml> | undefined> {
    const xmlFile = await fileProvider.readText(fullPath, diags)
    if (xmlFile == undefined) {
        if (!optional) {
            diags.push(`${fullPath} is missing`)
        }
        return undefined
    }
    const xml = parseXml(xmlFile, diags)
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${fullPath}`)
        return undefined
    } else {
        return {
            fullPath,
            content: xml,
        }
    }
}