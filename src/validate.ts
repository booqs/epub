import { Diagnostic, Diagnoser, diagnoser } from "./diagnostic"
import {
    ContainerDocument, EncryptionDocument, FullEpub, ManifestDocument, MetadataDocument, NavDocument, NcxDocument, Package, PackageDocument,
    PackageItem, RightsDocument, SignaturesDocument, Unvalidated,
    knownGuideReferenceTypes, knownManifestItemMediaTypes, knownMetaProperties,
} from "./model"
import {
    ObjectValidator, array, custom, object, oneOf, optional,
    string, validateObject,
} from "./validator"

export function validateEpub(epub: Unvalidated<FullEpub>, optDiags?: Diagnoser): FullEpub | undefined {
    let diags = optDiags?.scope('epub validation') ?? diagnoser('epub validation')
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
        return undefined
    }
    if (!validateContainer(container, diags)) {
        return undefined
    }
    let validatedPackages: Package[] = []
    for (let pkg of packages ?? []) {
        let document = pkg.document
        if (!validatePackageDocument(document, diags)) {
            return undefined
        }
        if (pkg.ncx) {
            if (!validateNcxDocument(pkg.ncx, diags)) {
                return undefined
            }
        }
        if (pkg.nav) {
            if (!validateNavDocument(pkg.nav, diags)) {
                return undefined
            }
        }
        let items = pkg.items as PackageItem[] ?? []
        let spine = pkg.spine as PackageItem[] ?? []
        validatedPackages.push({
            fullPath: pkg.fullPath as string,
            document,
            spine,
            items,
            ncx: pkg.ncx,
            nav: pkg.nav,
        })
    }
    if (validatedPackages.length !== packages?.length) {
        diags.push('failed to validate some packages')
        return undefined
    }
    if (mimetype !== 'application/epub+zip') {
        diags.push({
            message: `mimetype is not application/epub+zip: ${mimetype}`,
        })
        return undefined
    }
    return {
        encryption: encryption as EncryptionDocument,
        signatures: signatures as SignaturesDocument,
        manifest: manifest as ManifestDocument,
        metadata: metadata as MetadataDocument,
        rights: rights as RightsDocument,
        mimetype,
        container,
        packages: validatedPackages,
    }
}

export function validateContainer(object: Unvalidated<ContainerDocument> | undefined, diags: Diagnoser): object is ContainerDocument {
    diags = diags.scope('container')
    let m = validateObject(object, CONTAINER)
    diags.push(...m.map(m => ({
        message: `failed validation: ${m}`,
    })))
    return m.length === 0
}

export function validatePackageDocument(object: Unvalidated<PackageDocument> | undefined, diags: Diagnoser): object is PackageDocument {
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

export function validateNcxDocument(object: Unvalidated<NcxDocument> | undefined, diags: Diagnoser): object is NcxDocument {
    diags = diags.scope('ncx')
    if (object === undefined) {
        diags.push({
            message: 'undefined ncx',
        })
        return false
    }
    let m = validateObject(object, NCX)
    diags.push(...m.map(m => ({
        message: `failed validation: ${m}`,
    })))
    return m.length === 0
}

export function validateNavDocument(object: Unvalidated<NavDocument> | undefined, diags: Diagnoser): object is NavDocument {
    diags = diags.scope('nav')
    if (object === undefined) {
        diags.push({
            message: 'undefined nav',
        })
        return false
    }
    let m = validateObject(object, NAV_DOCUMENT)
    diags.push(...m.map(m => ({
        message: `failed validation: ${m}`,
    })))
    return m.length === 0
}

function valideExtraKey(key: string) {
    return key.startsWith('@xmlns:') || key.startsWith('@opf:') || key.startsWith('@xsi:')
}
function field(validator: ObjectValidator['properties']) {
    return array(object(
        validator,
        valideExtraKey,
    ), 1, 1)
}

function collection(validator: ObjectValidator['properties']) {
    return array(object(validator, valideExtraKey), 1)
}

function optCollection(validator: ObjectValidator['properties']) {
    return optional(collection(validator))
}

function optField(validator: ObjectValidator['properties']) {
    return optional(field(validator))
}

function optString() {
    return optional(string())
}

function numberString() {
    return custom((value) => {
        const num = Number(value)
        if (isNaN(num)) {
            return [`Expected a number, got ${value}`]
        } else {
            return []
        }
    })
}

const CONTAINER = object({
    container: field({
        '@version': '1.0',
        '@xmlns': 'urn:oasis:names:tc:opendocument:xmlns:container',
        rootfiles: field({
            rootfile: collection({
                '@full-path': string(),
                '@media-type': string(),
            }),
        }),
        links: optField({
            link: collection({
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
const DC_ELEMENT = optCollection({
    '@id': optString(),
    '@dir': optional(DIR),
    '@xml:lang': optString(),
    '#text': string(),
})
const METADATA = field({
    'dc:identifier': optCollection({
        '@id': optString(),
        '#text': string(),
    }),
    'dc:title': optCollection({
        '@id': optString(),
        '#text': string(),
    }),
    'dc:language': optCollection({
        '@id': optString(),
        '#text': string(),
    }),
    'dc:creator': optCollection({
        '@id': optString(),
        '@xml:lang': optString(),
        '@opf:file-as': optString(),
        '@opf:role': optString(),
        '#text': string(),
    }),
    'dc:subject': DC_ELEMENT,
    'dc:description': DC_ELEMENT,
    'dc:publisher': DC_ELEMENT,
    'dc:contributor': DC_ELEMENT,
    'dc:date': DC_ELEMENT,
    'dc:source': DC_ELEMENT,
    'dc:rights': DC_ELEMENT,
    meta: META,
})
const SPINE = field({
    '@toc': optString(),
    itemref: collection({
        '@idref': string(),
        '@id': optString(),
        '@linear': optString(),
        '@properties': optString(),
    }),
})
const MANIFEST = field({
    '@id': optString(),
    item: collection({
        '@id': string(),
        '@href': string(),
        '@media-type': oneOf(...knownManifestItemMediaTypes),
        '@fallback': optString(),
        '@properties': optString(),
        '@media-overlay': optString(),
    })
})
const GUIDE = optField({
    reference: collection({
        '@type': oneOf(...knownGuideReferenceTypes, ''),
        '@title': optString(),
        '@href': string(),
    }),
})
// Validator for the package document
const PACKAGE = object({
    package: collection({
        '@xmlns': 'http://www.idpf.org/2007/opf',
        '@unique-identifier': string(),
        '@version': string(),
        metadata: METADATA,
        manifest: MANIFEST,
        spine: SPINE,
        guide: GUIDE,
    }),
})

const LABEL = field({
    text: field({
        '#text': string(),
    }),
})
const CONTENT = field({
    '@src': string(),
})
const NAV_POINT = collection({
    '@id': string(),
    '@playOrder': numberString(),
    navLabel: LABEL,
    content: CONTENT,
    navPoint: optional(custom<object>((value) => {
        return validateObject(value, NAV_POINT)
    })),
})

const NCX = object({
    ncx: field({
        '@version': string(),
        '@xmlns': optString(),
        '@xml:lang': optString(),
        head: optField({
            meta: optCollection({
                '@name': string(),
                '@content': string(),
            }),
        }),
        docTitle: optional(LABEL),
        docAuthor: optional(LABEL),
        navMap: oneOf(field({
            navPoint: NAV_POINT,
        }), field({
            '#text': '',
        })),
        pageList: optField({
            '@class': optString(),
            '@id': optString(),
            navLabel: LABEL,
            pageTarget: collection({
                '@playOrder': numberString(),
                '@value': numberString(),
                '@type': optString(),
                '@id': optString(),
                navLabel: LABEL,
                content: CONTENT,
            }),
        }),
    }),
})

const OL = collection({
    li: collection({
        a: field({
            '@href': string(),
            '#text': string(),
        }),
        span: optField({
            '@class': string(),
            '#text': string(),
        }),
        ol: optional(custom<object>((value) => {
            return validateObject(value, OL)
        }))
    }),
})


const NAV_DOCUMENT = object({
    html: field({
        '@xmlns': 'http://www.w3.org/1999/xhtml',
        '@xmlns:epub': 'http://www.idpf.org/2007/ops',
        head: field({
            title: optField({
                '#text': string(),
            }),
        }),
        body: field({
            nav: field({
                '@epub:type': oneOf('toc', 'landmarks', 'page-list'),
                ol: OL,
            }),
        }),
    }),
})