import { Diagnostic, Diagnoser, diagnostics } from "./diagnostic"
import { ContainerDocument, EncryptionDocument, FullEpub, ManifestDocument, MetadataDocument, NavDocument, NcxDocument, Package, PackageDocument, PackageItem, RightsDocument, SignaturesDocument, Unvalidated, knownGuideReferenceTypes, knownManifestItemMediaTypes, knownMetaProperties } from "./model"
import {
    ObjectValidator, array, custom, object, oneOf, optional,
    string, validateObject,
} from "./validator"
import { parseXml } from "./xml"

export function validateEpub(epub: Unvalidated<FullEpub>): { diagnostics: Diagnostic[], value?: FullEpub } {
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
        return { diagnostics: diags.all() }
    }
    if (!validateContainer(container, diags)) {
        return {
            diagnostics: diags.all(),
        }
    }
    let validatedPackages: Package[] = []
    for (let pkg of packages ?? []) {
        let document = pkg.document
        if (!validatePackageDocument(document, diags)) {
            return {
                diagnostics: diags.all(),
            }
        }
        let ncxId = document?.package?.[0].spine?.[0]?.['@toc']
        if (ncxId) {
            let item = pkg.items?.find(i => i['item']?.['@id'] === ncxId)
            if (!item) {
                diags.push({
                    message: `ncx id not found: ${ncxId}`,
                })
            } else if (!item.content) {
                diags.push({
                    message: `ncx id content not found: ${ncxId}`,
                })
            } else if (typeof item.content !== 'string') {
                diags.push({
                    message: `ncx id content is not a string: ${ncxId}`,
                })
            } else {
                let parsed: Unvalidated<NcxDocument> | undefined = parseXml(item.content, diags.scope('ncx'))
                validateNcx(parsed, diags)
            }
        }
        let navItem = pkg.items?.find(i => i.item?.['@properties']?.includes('nav'))
        if (navItem) {
            if (!navItem.content) {
                diags.push({
                    message: `nav id content not found: ${navItem}`,
                })
            } else if (typeof navItem.content !== 'string') {
                diags.push({
                    message: `nav id content is not a string: ${navItem.item}`,
                })
            } else {
                let parsed: Unvalidated<NavDocument> | undefined = parseXml(navItem.content, diags.scope('nav'))
                validateNavDocument(parsed, diags)
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
            diagnostics: diags.all(),
        }
    }
    if (mimetype !== 'application/epub+zip') {
        diags.push({
            message: `mimetype is not application/epub+zip: ${mimetype}`,
        })
        return {
            diagnostics: diags.all(),
        }
    }
    return {
        diagnostics: diags.all(),
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

export function validateNcx(object: Unvalidated<NcxDocument> | undefined, diags: Diagnoser): object is NcxDocument {
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
    '#text': optString(),
})
const METADATA = field({
    'dc:identifier': field({
        '@id': optString(),
        // TODO: make this required
        '#text': optString(),
    }),
    'dc:title': optField({
        '@id': optString(),
        // TODO: make this required
        '#text': optString(),
    }),
    'dc:language': field({
        '@id': optString(),
        // TODO: make this required
        '#text': optString(),
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

const LABEL = field({
    text: field({
        '#text': string(),
    }),
})
const CONTENT = field({
    '@src': string(),
})
const NAV_POINT = field({
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
            meta: optField({
                '@name': string(),
                '@content': string(),
            }),
        }),
        docTitle: optional(LABEL),
        docAuthor: optional(LABEL),
        navMap: field({
            navPoint: NAV_POINT,
        }),
        pageList: optField({
            '@class': optString(),
            '@id': optString(),
            navLabel: LABEL,
            pageTarget: field({
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

const OL = field({
    li: field({
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