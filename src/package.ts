import {
    expectAttributes, processDir, processLang, processPrefix, processUniqueIdentifier, processVersion,
} from "./attributes"
import { Collection, Guide, Manifest, PackageDocument, PackageMetadata, Spine, Xml } from "./model"
import { Diagnostics } from "./diagnostic"
import { processPackageMetadata } from "./metadata"
import { optionalExtra, pushIfDefined } from "./utils"
import { processManifest } from "./manifest"
import { processSpine } from "./spine"
import { processCollection } from "./collection"
import { processGuide } from "./guide"

export function processPackageXml(packageXml: Xml, diags: Diagnostics): PackageDocument | undefined {
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
    let manifest: Manifest | undefined
    let spine: Spine | undefined
    let collections: Collection[] = []
    let guide: Guide | undefined
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
            case 'manifest':
                if (manifest !== undefined) {
                    diags.push({
                        message: `manifest should be defined only once`,
                        data: node,
                    })
                    continue
                }
                manifest = processManifest(node, diags.scope('manifest'))
                break
            case 'spine':
                if (spine !== undefined) {
                    diags.push({
                        message: `spine should be defined only once`,
                        data: node,
                    })
                    continue
                }
                spine = processSpine(node, diags.scope('spine'))
                break
            case 'collection':
                pushIfDefined(collections, processCollection(node, diags.scope('collection')))
                break
            case 'guide':
                if (guide !== undefined) {
                    diags.push({
                        message: `guide should be defined only once`,
                        data: node,
                    })
                    continue
                }
                guide = processGuide(node, diags.scope('guide'))
                break
            case 'bindings':
                diags.push(`element ${node.name} is not supported`)
                break
            default:
                diags.push(`unexpected element ${node.name}`)
                break
        }
    }
    if (metadata === undefined) {
        diags.push(`package metadata is missing`)
        return undefined
    }
    uniqueIdentifier = processUniqueIdentifier(uniqueIdentifier, diags)
    let uid = metadata.identifier.find(id => id.id === uniqueIdentifier)?.value
    if (!uid) {
        diags.push(`unique-identifier ${uniqueIdentifier} is not defined in metadata`)
    }
    if (manifest === undefined) {
        diags.push(`manifest is missing`)
        return undefined
    }
    if (spine === undefined) {
        diags.push(`spine is missing`)
        return undefined
    }

    return {
        metadata,
        manifest,
        spine,
        ...(collections.length > 0 ? { collections } : {}),
        ...(guide !== undefined ? { guide } : {}),
        version: processVersion(version, diags),
        uid,
        uniqueIdentifier,
        prefix: processPrefix(prefix, diags),
        lang: processLang(lang, diags),
        dir: processDir(dir, diags),
        ...optionalExtra(rest),
    }
}