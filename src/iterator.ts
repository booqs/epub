import { diagnostics } from "./diagnostic"
import { loadContainerDocument } from "./epub"
import { FileProvider, loadXml } from "./file"
import { ContainerDocument, PackageDocument, Unvalidated } from "./model"
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
            let document: Unvalidated<PackageDocument> | undefined = await loadXml(fileProvider, fullPath, diags)
            if (document == undefined) {
                diags.push(`${fullPath} package is missing`)
                continue
            }
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