import {
    expectAttributes, processDir, processLang, processPrefix, processUniqueIdentifier, processVersion,
} from "./attributes"
import { Diagnostics, PackageDocument, PackageMetadata, Xml, XmlAttributes } from "./core"
import { processPackageMetadata } from "./metadata"

export function processPackageXml(packageXml: Xml, diags: Diagnostics): Omit<PackageDocument, 'fullPath'> | undefined {
    let [root, ...restNodes] = packageXml
    if (restNodes.length > 0) {
        diags.push(`package.xml should have exactly one rootfile element, got ${packageXml.length}`)
    }
    if (root.name !== 'package') {
        diags.push(`root element should be package, got: ${root.name}`)
        return undefined
    }
    let {
        version, 'unique-identifier': uniqueIdentifier, 'prefix': prefix, 'xml:lang': lang, 'dir': dir,
        ...rest
    } = root.attrs ?? {}
    expectAttributes(
        rest,
        ['xmlns:opf', 'xmlns:dc', 'xmlns:dcterms', 'xmlns:xsi', 'xmlns'],
        diags.scope(root.name),
    )
    let metadata: PackageMetadata | undefined
    for (let node of root.children ?? []) {
        switch (node.name) {
            case 'metadata':
                if (metadata !== undefined) {
                    diags.push({
                        message: `metadata should be defined only once`,
                        data: node,
                    })
                    continue
                }
                metadata = processPackageMetadata(node, diags.scope('metadata'))
                break
        }
    }
    if (metadata === undefined) {
        diags.push(`package metadata is missing`)
        return undefined
    }
    uniqueIdentifier = processUniqueIdentifier(uniqueIdentifier, diags)
    let uid = metadata.identifiers.find(id => id.id === uniqueIdentifier)?.value
    if (!uid) {
        diags.push(`unique-identifier ${uniqueIdentifier} is not defined in metadata`)
    }
    return {
        version: processVersion(version, diags),
        uid,
        uniqueIdentifier,
        prefix: processPrefix(prefix, diags),
        lang: processLang(lang, diags),
        dir: processDir(dir, diags),
        otherAttributes: rest,
        metadata,
    }
}