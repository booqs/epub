import { Diagnostics } from "./diagnostic"
import { ContainerDocument, PackageDocument, Unvalidated, knownGuideReferenceTypes, knownManifestItemMediaTypes, knownMetaProperties } from "./model"
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

export function validateContainer(object: Unvalidated<ContainerDocument>, diags: Diagnostics): object is ContainerDocument {
    diags = diags.scope('container')
    let m = validateObject(object, CONTAINER)
    diags.push(...m.map(m => ({
        message: `failed validation: ${m}`,
    })))
    return m.length === 0
}

export function validatePackage(object: Unvalidated<PackageDocument> | undefined, diags: Diagnostics): object is PackageDocument {
    diags = diags.scope('package')
    let m = validateObject(object, PACKAGE)
    diags.push(...m.map(m => ({
        message: `failed validation: ${m}`,
    })))
    return m.length === 0
}