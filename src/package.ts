import { Diagnostics } from "./diagnostic"
import { loadXml, FileProvider } from "./file"
import { ContainerDocument, Package, Unvalidated } from "./model"

export async function loadPackages(container: Unvalidated<ContainerDocument>, fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<Package>[]> {
    let rootfiles = container?.container?.[0]?.rootfiles?.[0]?.rootfile
    if (!rootfiles) {
        diags.push({
            message: `container is missing rootfiles`,
            data: container
        })
        return []
    }
    let paths = rootfiles?.map(r => r['@full-path']) ?? []
    let packageOrUndefineds = paths.map(async p => {
        if (p == undefined) {
            diags.push(`rootfile is missing @full-path`)
            return undefined
        }
        return loadPackage(p, fileProvider, diags)
    })
    let packages = (await Promise.all(packageOrUndefineds)).filter((p): p is Unvalidated<Package> => {
        if (p == undefined) {
            diags.push(`failed to load package`)
            return false
        } else {
            return true
        }
    })
    return packages
}

async function loadPackage(fullPath: string, fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<Package> | undefined> {
    let xml = await loadXml(fileProvider, fullPath, diags)
    if (xml == undefined) {
        diags.push(`${fullPath} package is missing`)
        return undefined
    }
    return {
        fullPath,
        document: xml,
    }
}