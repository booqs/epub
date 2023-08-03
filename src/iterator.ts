import { diagnostics } from "./diagnostic"
import { loadContainerDocument } from "./epub"
import { FileProvider, loadXml } from "./file"
import { ContainerDocument, Opf2Meta, PackageDocument, Unvalidated } from "./model"
import { getRootfiles, loadManifestItem, relativeFileProvider } from "./package"

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
        let rootfiles = getRootfiles(await getContainer(), diags)
        for (let fullPath of rootfiles) {
            let optDocument: Unvalidated<PackageDocument> | undefined = await loadXml(fileProvider, fullPath, diags)
            if (optDocument == undefined) {
                diags.push(`${fullPath} package is missing`)
                continue
            }
            let document = optDocument
            let docItems = document.package?.[0]?.manifest?.[0]?.item
            if (docItems === undefined) {
                diags.push({
                    message: `package is missing manifest items`,
                    data: document,
                })
                continue
            }
            let defined = docItems
            let relativeProvider = relativeFileProvider(fileProvider, fullPath)
            yield {
                fullPath,
                document,
                metadata(): Record<string, string[]> {
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
                },
                items: async function* items() {
                    for (let item of defined) {
                        let loaded = await loadManifestItem(item, relativeProvider, diags)
                        if (loaded === undefined) {
                            diags.push({
                                message: `failed to load manifest item`,
                                data: item,
                            })
                            continue
                        }
                        yield loaded
                    }
                },
            }
        }
    }

    return {
        container,
        packages,
        diags() {
            return diags.all()
        },
    }
}