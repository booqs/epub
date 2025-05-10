import { Diagnoser, diagnoser } from './diagnostic'
import { FileProvider, getBasePath } from './file'
import {
    EpubMetadata, EpubMetadataItem, ManifestItem, Opf2Meta, PackageDocument, Unvalidated,
} from './model'
import { loadManifestItem, manifestItemForHref, manifestItemForId } from './package'
import { lazy } from './utils'
import { epubDocumentLoader } from './documents'
import { extractTocFromNav, extractTocFromNcx } from './toc'

export function openEpub(fileProvider: FileProvider, optDiags?: Diagnoser) {
    const diags = optDiags?.scope('open epub') ?? diagnoser('open epub')
    const documents = epubDocumentLoader(fileProvider, diags)
    const packageBasePath = lazy(async () => {
        const { fullPath } = await documents('package') ?? {}
        if (fullPath == undefined) {
            return undefined
        }
        return getBasePath(fullPath)
    })
    async function loadItem(item: Unvalidated<ManifestItem>) {
        const basePath = await packageBasePath()
        if (basePath == undefined) {
            return undefined
        }
        return loadManifestItem(item, basePath, fileProvider, diags)
    }

    return {
        metadata: lazy(async () => {
            const {content} = await documents('package') ?? {}
            return content
                ? extractMetadata(content, diags)
                : {}
        }),
        documents,
        loadItem,
        async itemForHref(href: string) {
            const { content } = await documents('package') ?? {}
            if (content == undefined) {
                return undefined
            }
            return manifestItemForHref(content, href, diags)
        },
        async itemForId(id: string) {
            const {content} = await documents('package') ?? {}
            if (content == undefined) {
                return undefined
            }
            return manifestItemForId(content, id, diags)
        },
        manifest: lazy(async () => {
            const {content} = await documents('package') ?? {}
            return content
                ? extractManifestItems(content, diags)
                : []
        }),
        spine: lazy(async () => {
            const { content } = await documents('package') ?? {}
            return content
                ? extractSpine(content, diags)
                : []
        }),
        toc: lazy(async () => {
            const {content} = await documents('package') ?? {}
            if (content == undefined) {
                return {
                    title: undefined,
                    items: [],
                }
            }
            const optNavDocument = await documents('nav')
            if (optNavDocument != undefined) {
                return extractTocFromNav(optNavDocument.content, diags)
            }
            const optNcxDocument = await documents('ncx')
            if (optNcxDocument != undefined) {
                return extractTocFromNcx(optNcxDocument.content, diags)
            }
            diags.push('failed to find nav or ncx toc')
            return undefined
        }),
        diagnostics() {
            return diags.all()
        },
    }
}

function extractManifestItems(document: Unvalidated<PackageDocument>, diags: Diagnoser) {
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

function extractSpine(document: Unvalidated<PackageDocument>, diags: Diagnoser) {
    const spineItems = document.package?.[0]?.spine?.[0]?.itemref
    if (spineItems == undefined) {
        diags.push({
            message: 'package is missing spine items',
            data: document,
        })
        return
    }
    return spineItems.map(spineItem => {
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
    }).filter(i => i !== undefined)
}

function extractMetadata(document: Unvalidated<PackageDocument>, diags: Diagnoser) {
    const result: EpubMetadata = {}
    const [metadata] = document.package?.[0]?.metadata ?? []
    if (metadata == undefined) {
        diags.push({
            message: 'package is missing metadata',
            data: document,
        })
        return result
    }
    const { meta, ...rest } = metadata
    for (const [key, value] of Object.entries(rest)) {
        if (!Array.isArray(value)) {
            diags.push({
                message: 'package metadata is not an array',
                data: value,
            })
            continue
        }
        result[key] = value
    }
    for (const m of (meta ?? [])) {
        const { '@name': name, '@content': content } = (m as Opf2Meta)
        if (name === undefined || content === undefined) {
            continue
        }
        const item: EpubMetadataItem = {
            '#text': content,
        }
        if (result[name] !== undefined) {
            result[name].push(item)
        } else {
            result[name] = [item]
        }
    }
    return result
}