import { expectAttributes } from "./attributes"
import { Result, Container, Diagnostic, RootFile, Xml, XmlNode } from "./core"

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
        expectAttributes(rest, [], diags)
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
        diags.push({
            message: 'links element is not supported',
            severity: 'warning',
        })
        return []
    }
    if (containerChild.name !== 'rootfiles') {
        diags.push(`Unexpected container child: ${containerChild.name}`)
        return []
    }
    expectAttributes(containerChild.attrs ?? {}, [], diags)
    let result: RootFile[] = []
    for (let node of containerChild.children ?? []) {
        if (node.name !== 'rootfile') {
            diags.push(`Expected rootfile element, got: ${node.name}`)
            continue
        }
        let { 'full-path': fullPath, 'media-type': mediaType, ...rest } = node.attrs ?? {}
        expectAttributes(rest, [], diags)
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
