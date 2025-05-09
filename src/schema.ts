import { z } from 'zod'

//===== Package document =====//

// Attributes

// Specifies the base direction [bidi] of the textual content and attribute values of the carrying element and its descendants.
// Allowed on: collection, Dublin Core elements, meta, and package.
const dir = z.enum(['ltr', 'rtl', 'auto'])

// A valid URL string [url] that references a resource.
// Allowed on: item and link.
const href = z.string() //.brand<'href'>()

// The ID [xml] of the element, which MUST be unique within the document scope.
// Allowed on: collection, Dublin Core elements, item, itemref, link, manifest, meta, package, and spine.
const id = z.string() //.brand<'id'>()

// A media type [rfc2046] that specifies the type and format of the referenced resource.
// Allowed on: item and link.
const mediaType = z.string() //.brand<'media-type'>()

// A space-separated list of property values
// Allowed on: item, itemref, and link
const properties = z.string() //.brand<'properties'>()

// Establishes an association between the current expression and the element or resource identified by its value.
// Allowed on: link and meta.
const refines = z.string()

// Specifies the language of the textual content and attribute values of the carrying element and its descendants, as defined in section 2.12 Language Identification of [xml]. The value of each xml:lang attribute MUST be a well-formed language tag [bcp47].
// Allowed on: collection, Dublin Core elements, meta, and package.
const xmlLang = z.string() //.brand<'xml:lang'>()

const idref = z.string() //.brand<'idref'>() // TODO: check validity

// Elements

// Elements/Metadata

// Note: epub2
const epub2DcExtra = {
    '@opf:scheme': z.string().optional(),
    '@opf:event': z.string().optional(),
    '@xsi:type': z.string().optional(),
}

const dcOptionalElement = z.object({
    '@id': id.optional(),
    '@dir': dir.optional(),
    '@xml:lang': xmlLang.optional(),
    '#text': z.string(),
    ...epub2DcExtra,
}).strict()

const dcCreatorOrContributor = z.object({
    '@id': id.optional(),
    '@dir': dir.optional(),
    '@xml:lang': xmlLang.optional(),
    '@opf:role': z.string().optional(), // Note: epub2
    '@opf:file-as': z.string().optional(), // Note: epub2
    '#text': z.string(),
    ...epub2DcExtra,
}).strict()

export const knownMetaProperties = [
    'alternate-script', 'authority', 'belongs-to-collection', 'collection-type', 'display-seq', 'file-as', 'group-position', 'identifier-type', 'role', 'source-of', 'term', 'title-type',
] as const
const otherMetaPropery = z.string() as z.ZodType<`${string}:${string}`>

export const meta = z.object({
    '@property': z.union([
        z.enum(knownMetaProperties),
        otherMetaPropery,
    ]), // TODO: check this in conformance with the spec as defined by D.3 Meta properties vocabulary
    '@refines': refines.optional(),
    '@id': id.optional(),
    '@dir': dir.optional(),
    '@xml:lang': xmlLang.optional(),
    '#text': z.string(),
}).strict()

// Note: epub2
export const opf2meta = z.object({
    '@name': z.string(),
    '@content': z.string(),
}).strict()

// Note: epub2
const epub2metaTag = z.tuple([z.object({
    '#text': z.string(),
}).strict()])

const metadata = z.object({
    'meta': z.array(z.union([
        meta,
        opf2meta, // Note: epub2
    ])).nonempty(),
    'dc:identifier': z.array(z.object({
        '@id': id.optional(),
        '#text': z.string(),
        ...epub2DcExtra,
    }).strict()).nonempty(),
    'dc:title': z.array(z.object({
        '@id': id.optional(),
        '@dir': dir.optional(),
        '@xml:lang': xmlLang.optional(),
        '#text': z.string(),
        ...epub2DcExtra,
    }).strict()).nonempty(),
    'dc:language': z.array(z.object({
        '@id': id.optional(),
        '#text': z.string(),
        ...epub2DcExtra,
    }).strict()).nonempty(),
    'dc:contributor': z.array(dcCreatorOrContributor).optional(),
    'dc:creator': z.array(dcCreatorOrContributor).optional(),
    'dc:coverage': z.array(dcOptionalElement).optional(),
    'dc:date': z.array(dcOptionalElement).optional(),
    'dc:description': z.array(dcOptionalElement).optional(),
    'dc:format': z.array(dcOptionalElement).optional(),
    'dc:publisher': z.array(dcOptionalElement).optional(),
    'dc:relation': z.array(dcOptionalElement).optional(),
    'dc:rights': z.array(dcOptionalElement).optional(),
    'dc:source': z.array(dcOptionalElement).optional(),
    'dc:subject': z.array(dcOptionalElement).optional(),
    'dc:type': z.array(dcOptionalElement).optional(),
    // Note: epub2
    'title': epub2metaTag.optional(),
    'creator': epub2metaTag.optional(),
    'subject': epub2metaTag.optional(),
    'description': epub2metaTag.optional(),
    'publisher': epub2metaTag.optional(),
    'contributor': epub2metaTag.optional(),
    'date': epub2metaTag.optional(),
    'type': epub2metaTag.optional(),
    'format': epub2metaTag.optional(),
    'identifier': epub2metaTag.optional(),
    'source': epub2metaTag.optional(),
    'language': epub2metaTag.optional(),
    'relation': epub2metaTag.optional(),
    'coverage': epub2metaTag.optional(),
    'rights': epub2metaTag.optional(),
}).strict()

// Elemetns/Manifest

const manifest = z.object({
    '@id': id.optional(),
    'item': z.array(z.object({
        '@href': href,
        '@id': id,
        '@media-type': mediaType,
        '@fallback': idref.optional(),
        '@properties': properties.optional(),
        '@media-overlay': idref.optional(),
    }).strict()).nonempty(),
}).strict()

// Elements/Spine

const spine = z.object({
    '@id': id.optional(),
    '@page-progression-direction': z.enum(['ltr', 'rtl', 'auto']).optional(),
    '@toc': idref.optional(),
    'itemref': z.array(z.object({
        '@idref': idref,
        '@id': id.optional(),
        '@linear': z.enum(['yes', 'no']).optional(),
        '@properties': properties.optional(),
    }).strict()).nonempty(),
}).strict()

// Elements/Guide

export const knownGuideReferenceTypes = [
    'cover', 'title-page', 'toc', 'index', 'glossary',
    'acknowledgements', 'bibliography', 'colophon', 'copyright-page',
    'dedication', 'epigraph', 'foreword', 'loi', 'lot', 'notes',
    'preface', 'text',
] as const
const otherGuideReferenceType = z.string().startsWith('other.') as z.ZodType<`other.${string}`>
const guide = z.object({
    'reference': z.array(z.object({
        '@href': href,
        '@type': z.union([
            z.enum(knownGuideReferenceTypes),
            otherGuideReferenceType,
        ]),
        '@title': z.string().optional(),
    }).strict()).nonempty(),
})

// Elements/Collection

const collectionBaseShape = {
    '@role': z.string(),
    '@id': id.optional(),
    '@dir': dir.optional(),
    '@xml:lang': xmlLang.optional(),
    'metadata': z.tuple([metadata]).optional(),
    'link': z.array(z.object({
        '@href': href,
        '@rel': z.string().optional(),
        '@properties': properties.optional(),
        '@media-type': mediaType.optional(),
        '@id': id.optional(),
    }).strict()).optional(),
}
const collectionBase = z.object(collectionBaseShape).strict()
type Collection = z.infer<typeof collectionBase> & {
    collection?: Collection[]
}
const collection = z.object({
    ...collectionBaseShape,
    'collection': z.array(z.lazy(() => collection)).optional(),
}).strict() as z.ZodType<Collection>


// Elements/Bindings

const bindings = z.object({
    'mediaType': z.array(z.object({
        '@media-type': mediaType,
        '@handler': idref,
    }).strict()).nonempty(),
}).strict()

// Document

export const packageDocument = z.object({
    package: z.tuple([z.object({
        '@unique-identifier': z.string(),
        '@version': z.enum([
            '3.0',
            '2.0', // Note: epub2
        ]),
        '@dir': dir.optional(),
        '@id': id.optional(),
        '@prefix': z.string().optional(),
        '@xml:lang': xmlLang.optional(),
        'metadata': z.tuple([metadata]),
        'manifest': z.tuple([manifest]),
        'spine': z.tuple([spine]),
        'collection': z.array(collection).optional(),
        'guide': z.tuple([guide]).optional(),
        'bindings': z.tuple([bindings]).optional(),
        // Note: epub2
        '@xmlns:opf': z.string().optional(),
        '@xmlns:dc': z.string().optional(),
        '@xmlns:dcterms': z.string().optional(),
        '@xmlns:xsi': z.string().optional(),
        '@xmlns': z.string().optional(),
    }).strict()]),
}).strict()

// ===== Navigation document =====//

const htmlPhrasingContent = z.object({
    '#text': z.string().optional(),
})
const liBaseShape = {
    'span': z.tuple([z.object({
        '#text': z.string().optional(),
    }).strict()]).optional(),
    'a': z.tuple([z.object({
        '@href': z.string(),
        '#text': z.string().optional(),
    }).strict()]).optional(),
}
const liBase = z.object(liBaseShape).strict()
type Li = z.infer<typeof liBase> & {
    ol?: z.infer<typeof ol>[]
}
const li = z.lazy((): z.ZodType<Li> =>
    z.object({
        'span': z.tuple([z.object({
            '#text': z.string().optional(),
        }).strict()]).optional(),
        'a': z.tuple([z.object({
            '@href': href,
            '#text': z.string().optional(),
        }).strict()]).optional(),
        ol: z.array(ol).optional(),
    }).strict()
)
const ol = z.object({
    li: z.array(li).nonempty(),
}).strict()
const nav = z.object({
    '@epub:type': z.enum(['toc', 'page-list', 'landmarks']).optional(),
    'h1': z.tuple([htmlPhrasingContent]).optional(),
    'h2': z.tuple([htmlPhrasingContent]).optional(),
    'h3': z.tuple([htmlPhrasingContent]).optional(),
    'h4': z.tuple([htmlPhrasingContent]).optional(),
    'h5': z.tuple([htmlPhrasingContent]).optional(),
    'h6': z.tuple([htmlPhrasingContent]).optional(),
    'ol': z.tuple([ol]),
}).strict()

export const navDocument = z.object({
    'html': z.tuple([z.object({
        'body': z.tuple([z.object({
            'nav': z.array(nav).nonempty(),
        })]),
    })]),
}).strict()

//===== NCX document =====//

const ncxText = z.tuple([z.object({
    'text': z.array(z.object({
        '#text': z.string(),
    }).strict()).nonempty(),
}).strict()])

const navPointBaseShape = {
    '@id': id,
    '@playOrder': idref,
    'navLabel': ncxText,
    'content': z.tuple([z.object({
        '@src': href,
    }).strict()]),
}
const navPointBase = z.object(navPointBaseShape).strict()
export type NavPoint = z.infer<typeof navPointBase> & {
    navPoint?: NavPoint[],
}
const navPoint = z.object({
    ...navPointBaseShape,
    'navPoint': z.array(z.lazy(() => navPoint)).optional(),
}).strict() as z.ZodType<NavPoint>

const ncxContent = z.tuple([z.object({
    '@src': href,
}).strict()])

// TODO: verify this is okay
export const ncxDocument = z.object({
    'ncx': z.tuple([z.object({
        '@version': z.literal('2005-1'),
        '@xmlns': z.literal('http://www.daisy.org/z3986/2005/ncx/'),
        '@xml:lang': xmlLang.optional(),
        'head': z.tuple([z.object({
            'meta': z.array(opf2meta).nonempty(),
        }).strict()]).optional(),
        'docTitle': ncxText.optional(),
        'docAuthor': ncxText.optional(),
        'navMap': z.tuple([z.object({
            'navPoint': z.array(navPoint).nonempty(),
        }).strict()]),
        'pageList': z.tuple([z.object({
            'navLabel': ncxText,
            'pageTarget': z.array(z.object({
                '@id': id,
                '@value': z.string(),
                '@playOrder': z.string(), // should be number
                navLabel: ncxText,
                content: ncxContent,
            }).strict())
        }).strict()]).optional(),
        navList: z.tuple([z.object({
            'navLabel': ncxText,
            'navTarget': z.array(z.object({
                '@id': id,
                'navLabel': ncxText,
                'content': ncxContent,
            }).strict())
        }).strict()]).optional(),
    }).strict()]),
}).strict()

//===== OCF container =====//

// NOTE: this is a path-relative-scheme-less-URL string
const relativePath = z.string() //.brand<'relativePath'>()
const ocfNamespace = z.literal('urn:oasis:names:tc:opendocument:xmlns:container')

export const containerDocument = z.object({
    container: z.tuple([z.object({
        '@version': z.literal('1.0'),
        '@xmlns': ocfNamespace,
        'rootfiles': z.tuple([z.object({
            'rootfile': z.array(z.object({
                '@full-path': relativePath,
                '@media-type': z.literal('application/oebps-package+xml'),
            }).strict()).nonempty(),
        }).strict()]),
        'links': z.tuple([z.object({
            'link': z.array(z.object({
                '@href': relativePath,
                '@rel': z.string(),
                '@media-type': mediaType.optional(),
            }).strict()).nonempty(),
        }).strict()]).optional(),
    }).strict()]),
}).strict()

// TODO: expand encryption document definition
const encryptedKey = z.any()
const encryptedData = z.any()

export const encryptionDocument = z.object({
    'encryption': z.tuple([z.object({
        '@xmlns': ocfNamespace,
        'enc.EncryptedKey': z.array(encryptedKey).nonempty(),
        'enc.EncryptedData': z.array(encryptedData).nonempty(),
    }).strict()]),
}).strict()

// TODO: expand signatures document definition
const signature = z.any()
export const signaturesDocument = z.object({
    'signatures': z.tuple([z.object({
        '@xmlns': ocfNamespace,
        'Signature': z.array(signature).nonempty(),
    }).strict()]),
}).strict()

// Epub 3 spec does not define the manifest, metadata or rights documents
export const manifestDocument = z.object({})
export const metadataDocument = z.object({})
export const rightsDocument = z.object({})

export const mimetypeDocument = z.literal('application/epub+zip')