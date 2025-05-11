import { Diagnoser, FileProvider } from './common'
import { ManifestItem, PackageDocument, SpineItem } from './model'
import { loadManifestItem, manifestItemForHref, manifestItemForId } from './manifest'
import { getBasePath, lazy, resolveHref, scoped } from './utils'
import { epubDocumentLoader } from './documents'
import { extractNavigationsFromNav, extractTocNavigationFromNcx, Navigation } from './toc'
import { extractMetadata } from './metadata'
import { UnvalidatedXml } from './xml'

export type Epub<Binary> = ReturnType<typeof openEpub<Binary>>
export function openEpub<Binary>(fileProvider: FileProvider<Binary>, optDiags?: Diagnoser) {
    const diags = optDiags ? scoped(optDiags, 'openEpub') : []
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
        const {content: navContent} = await documents.nav() ?? {}
        if (navContent != undefined) {
            navigations.push(
                ...extractNavigationsFromNav(navContent, diags)
            )
        }
        const {content: ncxContent} = await documents.ncx() ?? {}
        if (ncxContent != undefined) {
            const toc = extractTocNavigationFromNcx(ncxContent, diags)
            if (toc != undefined) {
                navigations.push(toc)
            }
        }
        return navigations
    })

    return {
        metadata: lazy(async () => {
            const {content} = await documents.package() ?? {}
            return content
                ? extractMetadata(content, diags)
                : {}
        }),
        documents() {
            return documents
        },
        loadItem,
        loadTextFile,
        loadBinaryFile,
        coverItem: lazy(async () => {
            const {content} = await documents.package() ?? {}
            return content
                ? extractCoverItem(content, diags)
                : {}
        }),
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
                diags.push('failed to find toc in nav or ncx')
                return undefined
            }
        }),
        diagnostics() {
            return diags
        },
    }
}

function extractCoverItem(document: UnvalidatedXml<PackageDocument>, diags: Diagnoser) {
    let coverItem = document.package?.[0]?.manifest?.[0]?.item?.find(item => item['@properties']?.includes('cover-image'))
    if (coverItem == undefined) {
        const coverMeta = document.package?.[0]?.metadata?.[0]?.meta?.find(item => item['@name'] == 'cover')
        if (coverMeta == undefined) {
            diags.push({
                message: 'package is missing cover item',
                data: document,
            })
            return undefined
        }
        const idref = coverMeta['@content']
        if (idref == undefined) {
            diags.push({
                message: 'cover meta is missing content',
                data: coverMeta,
            })
            return undefined
        }
        coverItem = document.package?.[0]?.manifest?.[0]?.item?.find(item => item['@id'] == idref)
        if (coverItem == undefined) {
            diags.push({
                message: 'package is missing cover item specified by meta',
                data: document,
            })
            return undefined
        }
    }
    
    return coverItem
}

function extractManifestItems(document: UnvalidatedXml<PackageDocument>, diags: Diagnoser) {
    const items = document.package?.[0]?.manifest?.[0]?.item
    if (items == undefined) {
        diags.push({
            message: 'package is missing manifest items',
            data: document,
        })
        return
    }
    return items
}

function extractSpine(document: UnvalidatedXml<PackageDocument>, diags: Diagnoser): Array<{
    spineItem: UnvalidatedXml<SpineItem>,
    manifestItem: UnvalidatedXml<ManifestItem>,
}> {
    const spineItems = document.package?.[0]?.spine?.[0]?.itemref
    if (spineItems == undefined) {
        diags.push({
            message: 'package is missing spine items',
            data: document,
        })
        return []
    }
    const result = spineItems
        .map(spineItem => {
            const idref = spineItem['@idref']
            if (idref == undefined) {
                diags.push({
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