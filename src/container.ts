import { AsyncResult, Container, RootFile } from "./core"
import { isEmptyObject } from "./utils"
import { parseXml, toArray } from "./xml"

export async function readContainer(container: string): AsyncResult<Container> {
    let { value, diags } = parseXml(container)
    if (value == undefined) {
        diags.push("Failed to parse container.xml")
        return {
            diags,
        }
    }
    let { rootfiles, ...restRoot } = value
    if (!isEmptyObject(restRoot)) {
        diags.push({
            message: "container.xml has unexpected children",
            data: restRoot,
        })
    }
    if (rootfiles == undefined) {
        diags.push("container.xml has no rootfiles")
        return { diags }
    }
    if (rootfiles.length != 1) {
        diags.push("container.xml has more than one rootfile")
        return { diags }
    }
    let rootFiles: RootFile[] = []
    for (let rootfile of toArray(rootfiles)) {
        let { '@': attributes, ...rest } = rootfile

        if (!isEmptyObject(rest)) {
            diags.push({
                message: "rootfile has unexpected children",
                data: rest,
            })
        }
        if (attributes == undefined) {
            diags.push({
                message: "rootfile has no attributes",
                data: rootfile,
            })
            continue
        }
        let { 'full-path': path, 'media-type': mediaType } = attributes
        if (mediaType != "application/oebps-package+xml") {
            diags.push({
                message: "rootfile media-type is not application/oebps-package+xml",
                data: rootfile,
            })
        }
        if (path == undefined) {
            diags.push({
                message: "rootfile has no path",
                data: rootfile,
            })
        }
        rootFiles.push({
            path,
            mediaType,
        })
    }

    return {
        value: {
            rootFiles: rootFiles,
        },
        diags,
    }
}
