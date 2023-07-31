import { Result, Container, Diagnostic, RootFile, Xml, XmlNode } from "./core"
import { isEmptyObject } from "./utils"

export function processContainerXml(containerXml: Xml): Result<Container> {
    let diags: Diagnostic[] = []
    if (containerXml.length != 1) {
        diags.push("container.xml should have exactly one rootfile element")
    }
    let rootFiles: RootFile[] = []
    for (let node of containerXml) {
        if (node.name !== 'container') {
            diags.push(`root element should be container, got: ${node.name}`)
            continue
        }
        let { version, xmlns, ...rest } = node.attrs ?? {}
        if (version !== '1.0') {
            diags.push(`container version should be 1.0, got: ${version}`)
        }
        if (xmlns !== 'urn:oasis:names:tc:opendocument:xmlns:container') {
            diags.push(`container xmlns should be urn:oasis:names:tc:opendocument:xmlns:container, got: ${xmlns}`)
        }
        if (!isEmptyObject(rest)) {
            diags.push(`container has unexpected attributes: ${Object.keys(rest).join(', ')}`)
        }
        if (node.children?.length != 1) {
            diags.push({
                message: `container should have exactly one rootfiles element`,
                data: node.children,
            })
        }
        for (let child of node.children ?? []) {
            rootFiles.push(...processContainerChild(child, diags))
        }
    }
    return {
        value: {
            rootFiles,
        },
        diags,
    }
}

function processContainerChild(containerChild: XmlNode, diags: Diagnostic[]): RootFile[] {
    if (containerChild.name === 'links') {
        diags.push('links element is not supported')
        return []
    }
    if (containerChild.name !== 'rootfiles') {
        diags.push(`Unexpected container child: ${containerChild.name}`)
        return []
    }
    if (!isEmptyObject(containerChild.attrs)) {
        diags.push({
            message: `rootfiles element has unexpected attributes`,
            data: containerChild.attrs,
        })
    }
    let result: RootFile[] = []
    for (let node of containerChild.children ?? []) {
        if (node.name !== 'rootfile') {
            diags.push(`Expected rootfile element, got: ${node.name}`)
            continue
        }
        let { 'full-path': fullPath, 'media-type': mediaType, ...rest } = node.attrs ?? {}
        if (!isEmptyObject(rest)) {
            diags.push({
                message: `rootfile element has unexpected attributes`,
                data: rest,
            })
        }
        if (mediaType !== 'application/oebps-package+xml') {
            diags.push(`rootfile media-type should be application/oebps-package+xml, got: ${mediaType}`)
        }
        if (!fullPath) {
            diags.push(`rootfile element is missing full_path attribute`)
            continue
        }

        result.push({
            fullPath,
            mediaType,
        })
    }
    return result
}
