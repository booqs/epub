import { FileProvider, Diagnoser } from './common'
import {
    ContainerDocument, EncryptionDocument, ManifestDocument, MetadataDocument, NavDocument, NcxDocument, PackageDocument, RightsDocument, SignaturesDocument,
} from './model'
import { loadManifestItem } from './manifest'
import { getBasePath, lazy, scoped } from './utils'
import { parseXml, UnvalidatedXml, XmlNode, Unvalidated } from './xml'

export type DocumentData<Content> = {
    fullPath: string,
    content: Content,
}
export function epubDocumentLoader(fileProvider: FileProvider, diags?: Diagnoser) {
    const container = lazy(() => 
        loadXmlData<ContainerDocument>(fileProvider, 'META-INF/container.xml', false, diags)
    )
    const pkg = lazy(async () => {
        const containerData = await container()
        if (containerData == undefined) {
            diags?.push('container is missing')
            return undefined
        }
        return loadPackageData(containerData.content, fileProvider, diags)
    })
    return {
        container,
        package: pkg,
        mimetype: lazy(() => loadMimetypeData(fileProvider, diags)),
        
        encryption: lazy(() =>
            loadXmlData<EncryptionDocument>(fileProvider, 'META-INF/encryption.xml', true, diags)
        ),
        signatures: lazy(() =>
            loadXmlData<SignaturesDocument>(fileProvider, 'META-INF/signatures.xml', true, diags)
        ),
        manifest: lazy(() => loadXmlData<ManifestDocument>(fileProvider, 'META-INF/manifest.xml', true, diags)),
        metadata: lazy(() => loadXmlData<MetadataDocument>(fileProvider, 'META-INF/metadata.xml', true, diags)),
        rights: lazy(() => loadXmlData<RightsDocument>(fileProvider, 'META-INF/rights.xml', true, diags)),
        nav: lazy(async () => {
            const packageData = await pkg()
            if (packageData == undefined) {
                return undefined
            }
            const packageBasePath = getBasePath(packageData.fullPath)
            return loadNavData(packageData.content, packageBasePath, fileProvider, diags)
        }),
        ncx: lazy(async () => {
            const packageData = await pkg()
            if (packageData == undefined) {
                return undefined
            }
            const packageBasePath = getBasePath(packageData.fullPath)
            return loadNcxData(packageData.content, packageBasePath, fileProvider, diags)
        }),
    }
}

async function loadMimetypeData(fileProvider: FileProvider, diags?: Diagnoser) {
    diags = diags && scoped(diags, 'loadMimetypeData')
    const fullPath = 'mimetype'
    const content: Unvalidated<'application/epub+zip'> | undefined = await fileProvider.readText(fullPath, diags)
    if (content == undefined) {
        diags?.push(`${fullPath} is missing`)
        return undefined
    }
    if (content !== 'application/epub+zip') {
        diags?.push(`mimetype is not application/epub+zip: ${content}`)
    }
    return {
        fullPath,
        content,
    }
}

async function loadPackageData(container: UnvalidatedXml<ContainerDocument>, fileProvider: FileProvider, diags?: Diagnoser) {
    diags = diags && scoped(diags, 'loadPackageData')
    const [rootfile] = container?.container?.[0]?.rootfiles?.[0]?.rootfile ?? []
    if (!rootfile) {
        diags?.push({
            message: 'container is missing rootfile',
            data: container
        })
        return undefined
    }
    const fullPath = rootfile['@full-path']
    if (fullPath == undefined) {
        diags?.push('rootfile is missing @full-path')
        return undefined
    }
    if (fullPath == undefined) {
        diags?.push('container is missing package full path')
        return undefined
    }
    return loadXmlData<PackageDocument>(fileProvider, fullPath, false, diags)
}

async function loadNavData(document: UnvalidatedXml<PackageDocument>, packageBasePath: string, fileProvider: FileProvider, diags?: Diagnoser): Promise<DocumentData<UnvalidatedXml<NavDocument>> | undefined> {
    diags = diags && scoped(diags, 'loadNavData')
    const manifestItems = document.package?.[0]?.manifest?.[0]?.item
    if (manifestItems == undefined) {
        diags?.push({
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
        diags?.push({
            message: 'failed to load nav item',
            data: tocItem,
        })
        return undefined
    } else if (typeof loaded.content !== 'string') {
        diags?.push({
            message: 'nav item content is not a string',
            data: loaded,
        })
        return undefined
    }
    const parsed = parseXml(loaded.content, diags)
    if (parsed === undefined) {
        diags?.push({
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

async function loadNcxData(document: UnvalidatedXml<PackageDocument>, packageBasePath: string, fileProvider: FileProvider, diags?: Diagnoser): Promise<DocumentData<UnvalidatedXml<NcxDocument>> | undefined> {
    diags = diags && scoped(diags, 'loadNcxData')
    const ncxId = document?.package?.[0].spine?.[0]?.['@toc']
    if (ncxId == undefined) {
        return undefined
    }
    const item = document?.package?.[0].manifest?.[0]?.item?.find(i => i['@id'] === ncxId)
    if (item == undefined) {
        diags?.push(`failed to find manifest ncx item for id: ${ncxId}`)
        return undefined
    }
    const ncxItem = await loadManifestItem(item, packageBasePath, fileProvider, diags)
    if (ncxItem == undefined) {
        diags?.push(`failed to load ncx item for id: ${ncxId}`)
        return undefined
    }
    const ncxContent = ncxItem.content
    if (typeof ncxContent !== 'string') {
        diags?.push('ncx content is not a string')
        return undefined
    }
    const parsed = parseXml(ncxContent, diags)
    if (parsed == undefined) {
        diags?.push('failed to parse ncx content')
        return undefined
    }
    return {
        fullPath: ncxItem.fullPath,
        content: parsed,
    }
}

async function loadXmlData<T extends XmlNode>(fileProvider: FileProvider, fullPath: string, optional: boolean, diags?: Diagnoser): Promise<DocumentData<UnvalidatedXml<T>> | undefined> {
    const xmlFile = await fileProvider.readText(fullPath, diags)
    if (xmlFile == undefined) {
        if (!optional) {
            diags?.push(`${fullPath} is missing`)
        }
        return undefined
    }
    const xml = parseXml(xmlFile, diags)
    if (xml == undefined) {
        diags?.push(`Failed to parse xml: ${fullPath}`)
        return undefined
    } else {
        return {
            fullPath,
            content: xml as UnvalidatedXml<T>,
        }
    }
}