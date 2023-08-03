import { Diagnostic, Diagnostics, diagnostics } from "./diagnostic"
import { ContainerDocument, EncryptionDocument, FullEpub, ManifestDocument, MetadataDocument, Package, PackageDocument, PackageItem, RightsDocument, SignaturesDocument, Unvalidated, knownGuideReferenceTypes, knownManifestItemMediaTypes, knownMetaProperties } from "./model"
import { ObjectValidator, array, number, object, oneOf, optional, string, validateObject } from "./validator"

function field(validator: ObjectValidator['properties']) {
    return array(object(
        validator,
        key => key.startsWith('@xmlns:') || key.startsWith('@opf:') || key.startsWith('@xsi:'),
    ))
}

function optField(validator: ObjectValidator['properties']) {
    return optional(field(validator))
}

function optString() {
    return optional(string())
}

const CONTAINER = object({
    container: field({
        '@version': '1.0',
        '@xmlns': 'urn:oasis:names:tc:opendocument:xmlns:container',
        rootfiles: field({
            rootfile: field({
                '@full-path': string(),
                '@media-type': string(),
            }),
        }),
        links: optField({
            link: field({
                '@href': string(),
                '@rel': string(),
                '@media-type': optString(),
            }),
        }),
    }),
})

const DIR = oneOf('ltr', 'rtl', 'auto')
const OPF2META = object({
    '@name': string(),
    '@content': string(),
})
const META_PROPERTY = oneOf(...knownMetaProperties)
const OPF3META = object({
    '@property': META_PROPERTY,
    '@dir': optional(DIR),
    '@id': optString(),
    '@refines': optString(),
    '@scheme': optString(),
    '@xml:lang': optString(),
    '#text': string(),
})
const META = optional(array(oneOf(OPF2META, OPF3META)))
const DC_ELEMENT = optField({
    '@id': optString(),
    '@dir': optional(DIR),
    '@xml:lang': optString(),
    // TODO: make this required
    '#text': optional(oneOf(string(), number())),
})
const METADATA = field({
    'dc:identifier': field({
        '@id': optString(),
        // TODO: make this required
        '#text': optional(oneOf(string(), number())),
    }),
    'dc:title': optField({
        '@id': optString(),
        // TODO: make this required
        '#text': optional(oneOf(string(), number())),
    }),
    'dc:language': field({
        '@id': optString(),
        // TODO: make this required
        '#text': optional(oneOf(string(), number())),
    }),
    'dc:subject': DC_ELEMENT,
    'dc:description': DC_ELEMENT,
    'dc:publisher': DC_ELEMENT,
    'dc:contributor': DC_ELEMENT,
    'dc:creator': DC_ELEMENT,
    'dc:date': DC_ELEMENT,
    'dc:source': DC_ELEMENT,
    'dc:rights': DC_ELEMENT,
    meta: META,
})
const SPINE = field({
    '@toc': optString(),
    itemref: field({
        '@idref': string(),
        '@id': optString(),
        '@linear': optString(),
        '@properties': optString(),
    }),
})
const MANIFEST = field({
    '@id': optString(),
    item: field({
        '@id': string(),
        '@href': string(),
        '@media-type': oneOf(...knownManifestItemMediaTypes),
        '@fallback': optString(),
        '@properties': optString(),
        '@media-overlay': optString(),
    })
})
const GUIDE = optField({
    reference: field({
        '@type': oneOf(...knownGuideReferenceTypes, ''),
        '@title': optString(),
        '@href': string(),
    }),
})
// Validator for the package document
const PACKAGE = object({
    package: field({
        '@xmlns': 'http://www.idpf.org/2007/opf',
        '@unique-identifier': string(),
        '@version': string(),
        metadata: METADATA,
        manifest: MANIFEST,
        spine: SPINE,
        guide: GUIDE,
    }),
})

export function validateContainer(object: Unvalidated<ContainerDocument> | undefined, diags: Diagnostics): object is ContainerDocument {
    diags = diags.scope('container')
    let m = validateObject(object, CONTAINER)
    diags.push(...m.map(m => ({
        message: `failed validation: ${m}`,
    })))
    return m.length === 0
}

export function validatePackageDocument(object: Unvalidated<PackageDocument> | undefined, diags: Diagnostics): object is PackageDocument {
    diags = diags.scope('package')
    if (object === undefined) {
        diags.push({
            message: 'undefined package',
        })
        return false
    }
    let m = validateObject(object, PACKAGE)
    diags.push(...m.map(m => ({
        message: `failed validation: ${m}`,
    })))
    return m.length === 0
}

export function validateEpub(epub: Unvalidated<FullEpub>): { diags: Diagnostic[], value?: FullEpub } {
    let diags = diagnostics('epub validation')
    let {
        container, packages,
        mimetype,
        encryption,
        signatures,
        manifest,
        metadata,
        rights,
    } = epub
    if (!container) {
        diags.push({
            message: 'missing container document',
        })
        return { diags: diags.all() }
    }
    if (!validateContainer(container, diags)) {
        return {
            diags: diags.all(),
        }
    }
    let validatedPackages: Package[] = []
    for (let pkg of packages ?? []) {
        let document = pkg.document
        if (!validatePackageDocument(document, diags)) {
            return {
                diags: diags.all(),
            }
        }
        validatedPackages.push({
            ...pkg,
            fullPath: pkg.fullPath as string,
            document,
            items: pkg.items as PackageItem[],
        })
    }
    if (validatedPackages.length !== packages?.length) {
        diags.push('failed to validate some packages')
        return {
            diags: diags.all(),
        }
    }
    if (mimetype !== 'application/epub+zip') {
        diags.push({
            message: `mimetype is not application/epub+zip: ${mimetype}`,
        })
        return {
            diags: diags.all(),
        }
    }
    return {
        diags: diags.all(),
        value: {
            encryption: encryption as EncryptionDocument,
            signatures: signatures as SignaturesDocument,
            manifest: manifest as ManifestDocument,
            metadata: metadata as MetadataDocument,
            rights: rights as RightsDocument,
            mimetype,
            container,
            packages: validatedPackages,
        },
    }
}