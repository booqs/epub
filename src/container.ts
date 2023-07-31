import { AsyncResult, Container, RootFile } from "./core"
import { isEmptyObject } from "./utils"
import { Xml, parseXml, toArray } from "./xml"

export async function readContainer(containerContent: string): AsyncResult<Container> {
    let { value, diags } = parseXml(containerContent)
    if (value == undefined) {
        diags.push("Failed to parse container.xml")
        return {
            diags,
        }
    }
    let { container, ...restRoot } = value
    if (!isEmptyObject(restRoot)) {
        diags.push({
            message: "container.xml has unexpected children",
            data: restRoot,
        })
    }
    if (!container) {
        diags.push("container.xml has no container")
        return { diags }
    }
    let [{ rootfiles, '@': containerAttrs, ...restContainer }, ...restContainerArray] = toArray(container)
    if (!isEmptyObject(restContainer)) {
        diags.push({
            message: "container.xml has unexpected children",
            data: restContainer,
        })
    }
    if (containerAttrs?.xmlns !== "urn:oasis:names:tc:opendocument:xmlns:container") {
        diags.push({
            message: "container xmlns is not urn:oasis:names:tc:opendocument:xmlns:container",
            data: containerAttrs,
        })
    }
    if (restContainerArray.length) {
        diags.push("container.xml has multiple values for container")
        return { diags }
    }
    if (rootfiles == undefined) {
        diags.push("container.xml has no rootfiles")
        return { diags }
    }
    if (toArray(rootfiles).length != 1) {
        diags.push({
            message: "container.xml has multiple rootfiles",
            data: rootfiles,
        })
        return { diags }
    }
    let rootFiles: RootFile[] = []
    for (let child of toArray(rootfiles)) {
        let { rootfile, ...restChild } = child
        if (!isEmptyObject(restChild)) {
            diags.push({
                message: "rootfiles has unexpected children",
                data: child,
            })
            continue
        }
        let { '@': attributes, ...rest } = rootfile as Xml

        if (!isEmptyObject(rest)) {
            diags.push({
                message: "rootfile has unexpected children",
                data: toArray(rootfiles),
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
