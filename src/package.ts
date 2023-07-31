import {
    expectAttributes, processDir, processLang, processPrefix, processUniqueIdentifier, processVersion,
} from "./attributes"
import { Diagnostic, PackageDocument, PackageMetadata, Result, Xml, XmlAttributes } from "./core"
import { processPackageMetadata } from "./metadata"

export function processPackageXml(packageXml: Xml): Result<Omit<PackageDocument, 'fullPath'>> {
    let diags: Diagnostic[] = []
    let [root, ...restNodes] = packageXml
    if (restNodes.length > 0) {
        diags.push(`package.xml should have exactly one rootfile element, got ${packageXml.length}`)
    }
    if (root.name !== 'package') {
        diags.push(`root element should be package, got: ${root.name}`)
        return { diags }
    }
    let {
        version, 'unique-identifier': uniqueIdentifier, 'prefix': prefix, 'xml:lang': lang, 'dir': dir,
        ...rest
    } = root.attrs ?? {}
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
                metadata = processPackageMetadata(node, diags)
                break
        }
    }
    if (metadata === undefined) {
        diags.push(`package metadata is missing`)
        return { diags }
    }
    uniqueIdentifier = processUniqueIdentifier(uniqueIdentifier, diags)
    let uid = metadata.identifiers.find(id => id.id === uniqueIdentifier)?.value
    if (!uid) {
        diags.push(`unique-identifier ${uniqueIdentifier} is not defined in metadata`)
    }
    return {
        value: {
            version: processVersion(version, diags),
            uid,
            uniqueIdentifier,
            prefix: processPrefix(prefix, diags),
            lang: processLang(lang, diags),
            dir: processDir(dir, diags),
            otherAttributes: processRest(rest, diags),
            metadata,
        },
        diags,
    }
}

function processRest(rest: XmlAttributes, diags: Diagnostic[]) {
    expectAttributes(
        rest,
        ['xmlns:opf', 'xmlns:dc', 'xmlns:dcterms', 'xmlns:xsi', 'xmlns'],
        diags,
    )
    return rest
}