import { Diagnostics, diagnostics } from "./diagnostic"
import { loadContainerDocument } from "./epub"
import { FileProvider, getBasePath, loadXml } from "./file"
import { ContainerDocument, ManifestItem, Opf2Meta, PackageDocument, PackageItem, Unvalidated } from "./model"
import { getRootfiles, loadManifestItem } from "./package"

export function epubIterator(fileProvider: FileProvider) {
    let diags = diagnostics('epubIterator')
    let _container: Promise<Unvalidated<ContainerDocument> | undefined> | undefined
    function getContainer() {
        if (_container == undefined) {
            _container = loadContainerDocument(fileProvider, diags)
        }
        return _container
    }
    async function container() {
        let document = await getContainer()
        if (document == undefined) {
            diags.push(`container.xml is missing`)
        }
        return document
    }
    async function* packages() {
        let container = await getContainer()
        if (container == undefined) {
            diags.push(`failed to load container.xml`)
        } else {
            yield* containerIterator(container, fileProvider, diags)
        }
    }

    return {
        container,
        packages,
        diagnostics() {
            return diags.all()
        },
    }
}

type ItemLoader = (item: Unvalidated<ManifestItem>) => Promise<PackageItem | undefined>
async function* containerIterator(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnostics) {
    let rootfiles = getRootfiles(container, diags)
    for (let fullPath of rootfiles) {
        let documentOpt: Unvalidated<PackageDocument> | undefined = await loadXml(fileProvider, fullPath, diags)
        if (documentOpt == undefined) {
            diags.push(`${fullPath} package is missing`)
            continue
        }
        let document = documentOpt
        let base = getBasePath(fullPath)
        const loadItem: ItemLoader = item => loadManifestItem(item, base, fileProvider, diags)
        yield {
            fullPath,
            document: documentOpt,
            metadata(): Record<string, string[]> {
                return getPackageMetadata(document, diags)
            },
            items() {
                return manifestIterator(document, loadItem, diags)
            },
            spine() {
                return spineIterator(document, loadItem, diags)
            },
            loadHref(ref: string) {
                let manifestItem = document.package?.[0]?.manifest?.[0]?.item?.find(i => i['@href'] == ref)
                if (manifestItem == undefined) {
                    diags.push(`failed to find manifest item for href: ${ref}`)
                    return undefined
                }
                return loadItem(manifestItem)
            },
            loadId(id: string) {
                let manifestItem = document.package?.[0]?.manifest?.[0]?.item?.find(i => i['@id'] == id)
                if (manifestItem == undefined) {
                    diags.push(`failed to find manifest item for id: ${id}`)
                    return undefined
                }
                return loadItem(manifestItem)
            },
        }
    }
}

async function* manifestIterator(document: Unvalidated<PackageDocument>, loadItem: ItemLoader, diags: Diagnostics) {
    let itemTag = document.package?.[0]?.manifest?.[0]?.item
    if (itemTag == undefined) {
        diags.push({
            message: `package is missing manifest items`,
            data: document,
        })
        return
    }
    let items = itemTag
    for (let item of items) {
        yield {
            item,
            async load() {
                let loaded = await loadItem(item)
                if (loaded === undefined) {
                    diags.push({
                        message: `failed to load manifest item`,
                        data: item,
                    })
                    return undefined
                }
                return loaded
            }
        }
    }
}

async function* spineIterator(document: Unvalidated<PackageDocument>, loadItem: ItemLoader, diags: Diagnostics) {
    let itemTag = document.package?.[0]?.spine?.[0]?.itemref
    if (itemTag == undefined) {
        diags.push({
            message: `package is missing spine items`,
            data: document,
        })
        return
    }
    let items = itemTag
    for (let item of items) {
        let idref = item['@idref']
        if (idref == undefined) {
            diags.push({
                message: `spine item is missing idref`,
                data: item,
            })
            continue
        }
        let manifestItemOpt = document.package?.[0]?.manifest?.[0]?.item?.find(i => i['@id'] == idref)
        if (manifestItemOpt == undefined) {
            diags.push({
                message: `spine item is not in manifest`,
                data: item,
            })
            continue
        }
        let manifestItem = manifestItemOpt
        yield {
            item,
            manifestItem,
            async load() {
                let loaded = await loadItem(manifestItem)
                if (loaded === undefined) {
                    diags.push({
                        message: `failed to load manifest item`,
                        data: manifestItem,
                    })
                    return undefined
                }
                return loaded
            }
        }
    }
}

function getPackageMetadata(document: Unvalidated<PackageDocument>, diags: Diagnostics) {
    let result: Record<string, string[]> = {}
    let metadatas = document.package?.[0]?.metadata
    if (metadatas == undefined || metadatas.length == 0) {
        diags.push({
            message: `package is missing metadata`,
            data: document,
        })
        return result
    }
    if (metadatas.length > 1) {
        diags.push({
            message: `package has multiple metadata`,
            data: document,
        })
        return result
    }
    let { meta, ...metadata } = metadatas[0]
    for (let [key, value] of Object.entries(metadata)) {
        if (!Array.isArray(value)) {
            diags.push({
                message: `package metadata is not an array`,
                data: value,
            })
            continue
        }
        let values = value
            .map(v => v['#text'])
            .filter((v): v is string => {
                if (v === undefined) {
                    diags.push(`package metadata is missing text: ${key}: ${value}`)
                }
                return v !== undefined
            })
        result[key] = values
    }
    for (let m of (meta ?? [])) {
        let { '@name': name, '@content': content } = (m as Opf2Meta)
        if (name === undefined || content === undefined) {
            continue
        }
        if (result[name] !== undefined) {
            result[name].push(content)
        } else {
            result[name] = [content]
        }
    }
    return result
}