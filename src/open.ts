import { Diagnoser, FileProvider } from './common'
import { ManifestItem, PackageDocument, SpineItem } from './model'
import { loadManifestItem, manifestItemForHref, manifestItemForId } from './manifest'
import { getBasePath, lazy, resolveHref } from './utils'
import { epubDocumentLoader } from './documents'
import { extractNavigationsFromNav, extractTocNavigationFromNcx, Navigation } from './toc'
import { extractMetadata } from './metadata'
import { UnvalidatedXml } from './xml'

export type Epub<Binary> = ReturnType<typeof openEpub<Binary>>
export function openEpub<Binary>(fileProvider: FileProvider<Binary>, diags?: Diagnoser) {
    const documents = epubDocumentLoader(fileProvider, diags)

    const packageBasePath = lazy(async () => {
        const { fullPath } = await documents.package() ?? {}
        if (fullPath == undefined) {
            return undefined
        }
        return getBasePath(fullPath)
    })
    async function loadItem(item: UnvalidatedXml<ManifestItem>) {
        const basePath = await packageBasePath()
        if (basePath == undefined) {
            return undefined
        }
        return loadManifestItem(item, basePath, fileProvider, diags)
    }
    async function loadTextFile(href: string) {
        const basePath = await packageBasePath()
        if (basePath == undefined) {
            return undefined
        }
        const fullPath = resolveHref(basePath, href)
        return fileProvider.readText(fullPath, diags)
    }
    async function loadBinaryFile(href: string) {
        const basePath = await packageBasePath()
        if (basePath == undefined) {
            return undefined
        }
        const fullPath = resolveHref(basePath, href)
        return fileProvider.readBinary(fullPath, diags)
    }

    const navigations = lazy(async () => {
        const navigations: Navigation[] = []
        const {content: navDocument} = await documents.nav() ?? {}
        if (navDocument != undefined) {
            navigations.push(
                ...extractNavigationsFromNav(navDocument, diags)
            )
        }
        const {content: ncxDocument} = await documents.ncx() ?? {}
        if (ncxDocument != undefined) {
            const toc = extractTocNavigationFromNcx(ncxDocument, diags)
            if (toc != undefined) {
                navigations.push(toc)
            }
        }
        return navigations
    })

    return {
        version: lazy(async () => {
            const {content} = await documents.package() ?? {}
            return content
                ? extractVersion(content, diags)
                : undefined
        }),
        uniqueIdentifier: lazy(async () => {
            const {content} = await documents.package() ?? {}
            return content
                ? extractUniqueIdentifier(content, diags)
                : undefined
        }),
        metadata: lazy(async () => {
            const {content} = await documents.package() ?? {}
            return content
                ? extractMetadata(content, diags)
                : undefined
        }),
        coverItem: lazy(async () => {
            const {content} = await documents.package() ?? {}
            return content
                ? extractCoverItem(content, diags)
                : undefined
        }),
        manifest: lazy(async () => {
            const {content} = await documents.package() ?? {}
            return content
                ? extractManifestItems(content, diags)
                : []
        }),
        spine: lazy(async () => {
            const { content } = await documents.package() ?? {}
            return content
                ? extractSpine(content, diags)
                : []
        }),
        navigations,
        toc: lazy(async () => {
            const naviagations = await navigations()
            const toc = naviagations.find(nav => nav.type == 'toc')
            if (toc != undefined) {
                return toc
            } else {
                diags?.push('failed to find toc in nav or ncx')
                return undefined
            }
        }),
        documents() {
            return documents
        },
        async itemForHref(href: string) {
            const { content } = await documents.package() ?? {}
            if (content == undefined) {
                return undefined
            }
            return manifestItemForHref(content, href, diags)
        },
        async itemForId(id: string) {
            const {content} = await documents.package() ?? {}
            if (content == undefined) {
                return undefined
            }
            return manifestItemForId(content, id, diags)
        },
        loadItem,
        loadTextFile,
        loadBinaryFile,
        diagnostics() {
            return diags
        },
    }
}

export type LoadedEpub<Binary> = ReturnType<typeof loadEpub<Binary>>
export async function loadEpub<Binary>(fileProvider: FileProvider<Binary>, diags?: Diagnoser) {
    const documents = epubDocumentLoader(fileProvider, diags)
    const {content: containerDocument} = await documents.container() ?? {}
    const packageData = await documents.package()
    if (packageData == undefined) {
        diags?.push('failed to load package document')
        return undefined
    }
    const {
        content: packageDocument,
        fullPath: packageFullPath,
    } = packageData
    const basePath = getBasePath(packageFullPath)

    const manifestItems = extractManifestItems(packageDocument, diags) ?? []
    const loadedManifestItems = (await Promise.all(
        manifestItems.map(async item => {
            return loadManifestItem(item, basePath, fileProvider, diags)
        })
    )).filter(item => item != undefined)

    const navigations: Navigation[] = []
    const {content: navDocument} = await documents.nav() ?? {}
    if (navDocument != undefined) {
        navigations.push(
            ...extractNavigationsFromNav(navDocument, diags)
        )
    }
    const {content: ncxDocument} = await documents.ncx() ?? {}
    if (ncxDocument != undefined) {
        const toc = extractTocNavigationFromNcx(ncxDocument, diags)
        if (toc != undefined) {
            navigations.push(toc)
        }
    }
    const toc = navigations.find(nav => nav.type == 'toc')
    if (toc === undefined) {
        diags?.push('failed to find toc in nav or ncx')
    }

    return {
        version: extractVersion(packageDocument, diags),
        uniqueIdentifier: extractUniqueIdentifier(packageDocument, diags),
        metadata: extractMetadata(packageDocument, diags),
        coverItem: extractCoverItem(packageDocument, diags),
        manifest: loadedManifestItems,
        spine: extractSpine(packageDocument, diags),
        navigations,
        toc,
        documents: {
            container: containerDocument,
            package: packageDocument,
            nav: navDocument,
            ncx: ncxDocument,
        },
        diagnostics: diags,
    }
}

function extractVersion(document: UnvalidatedXml<PackageDocument>, diags?: Diagnoser) {
    const version = document.package?.[0]?.['@version']
    if (version == undefined) {
        diags?.push({
            message: 'package is missing version',
            data: document,
        })
        return undefined
    }
    return version
}

function extractUniqueIdentifier(document: UnvalidatedXml<PackageDocument>, diags?: Diagnoser) {
    // Epub 3
    const identifierId = document.package?.[0]?.['@unique-identifier']
    if (identifierId !== undefined) {
        const identifier = document.package?.[0]?.metadata?.[0]?.identifier?.find(item => item['@id'] == identifierId)
        if (identifier == undefined) {
            diags?.push({
                message: 'package is missing metadata specified by unique identifier attribute',
                data: {
                    metadata: document.package?.[0]?.metadata,
                    uniqueIdentifier: identifierId,
                },
            })
            return undefined
        }
        const uniqueIdentifier = identifier['#text']
        if (uniqueIdentifier == undefined) {
            diags?.push({
                message: 'package unique identifier is missing text',
                data: identifier,
            })
            return undefined
        }
        return uniqueIdentifier
    }

    // Epub 2
    const identifiers = document.package?.[0]?.metadata?.[0]?.meta?.filter(item => item['@name'] == 'dtb:id')
    if (identifiers == undefined || identifiers.length == 0) {
        diags?.push({
            message: 'package is missing unique identifier attribute or meta with @name="dtb:id"',
            data: document,
        })
        return undefined
    }
    if (identifiers.length > 1) {
        diags?.push({
            message: 'package has multiple unique identifiers',
            data: identifiers,
        })
    }
    const uniqueIdentifier = identifiers[0]['@content']
    if (uniqueIdentifier == undefined) {
        diags?.push({
            message: 'package unique identifier meta element is missing content',
            data: identifiers[0],
        })
        return undefined
    }
    return uniqueIdentifier
}

function extractCoverItem(document: UnvalidatedXml<PackageDocument>, diags?: Diagnoser) {
    let coverItem = document.package?.[0]?.manifest?.[0]?.item?.find(item => item['@properties']?.includes('cover-image'))
    if (coverItem == undefined) {
        const coverMeta = document.package?.[0]?.metadata?.[0]?.meta?.find(item => item['@name'] == 'cover')
        if (coverMeta == undefined) {
            diags?.push({
                message: 'package is missing cover item',
                data: document,
                severity: 'info',
            })
            return undefined
        }
        const idref = coverMeta['@content']
        if (idref == undefined) {
            diags?.push({
                message: 'cover meta is missing content',
                data: coverMeta,
            })
            return undefined
        }
        coverItem = document.package?.[0]?.manifest?.[0]?.item?.find(item => item['@id'] == idref)
        if (coverItem == undefined) {
            diags?.push({
                message: 'package is missing cover item specified by meta',
                data: document,
            })
            return undefined
        }
    }
    
    return coverItem
}

function extractManifestItems(document: UnvalidatedXml<PackageDocument>, diags?: Diagnoser) {
    const items = document.package?.[0]?.manifest?.[0]?.item
    if (items == undefined) {
        diags?.push({
            message: 'package is missing manifest items',
            data: document,
        })
        return
    }
    return items
}

function extractSpine(document: UnvalidatedXml<PackageDocument>, diags?: Diagnoser): Array<{
    spineItem: UnvalidatedXml<SpineItem>,
    manifestItem: UnvalidatedXml<ManifestItem>,
}> {
    const spineItems = document.package?.[0]?.spine?.[0]?.itemref
    if (spineItems == undefined) {
        diags?.push({
            message: 'package is missing spine items',
            data: document,
        })
        return []
    }
    const result = spineItems
        .map(spineItem => {
            const idref = spineItem['@idref']
            if (idref == undefined) {
                diags?.push({
                    message: 'spine item is missing idref',
                    data: spineItem,
                })
                return undefined
            }
            const manifestItem = manifestItemForId(document, idref, diags)
            if (manifestItem == undefined) {
                return undefined
            }
            return {
                spineItem,
                manifestItem,
            }
        })
        .filter(item => item != undefined)
    return result
}