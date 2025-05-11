// Refere https://www.w3.org/TR/epub-33/ for the EPUB spec.

// ======OPF Container======
export type ContainerDocument = {
    container: [{
        '@version': string,
        rootfiles: [{
            rootfile: {
                '@full-path': string,
                '@media-type': 'application/oebps-package+xml',
            }[],
        }],
        links: {
            link: {
                '@href': string,
                '@rel': string,
                '@media-type'?: LinkMediaType,
            }[],
        }[],
    }]
}
// TODO: implement this
export type EncryptionDocument = {}
export type SignaturesDocument = {}
export type MetadataDocument = {}
export type RightsDocument = {}
export type ManifestDocument = {}

// ======Package Document======
export type PackageDocument = {
    package: [{
        '@unique-identifier': string,
        '@version': string,
        '@prefix'?: string,
        '@id'?: string,
        '@dir'?: ContentDirection,
        '@lang'?: string,
        metadata: [PackageMetadata],
        manifest: [PackageManifest],
        spine: [PackageSpine],
        collection?: PackageCollection[],
        guide?: [PackageGuide],
        bindings?: {}[],
    }],
}
export type KnownMetadataKey = 'title' | 'creator' | 'subject' | 'description' | 'publisher' | 'contributor' | 'date' | 'type' | 'format' | 'identifier' | 'coverage' | 'source' | 'relation' | 'rights'
export type PackageMetadata = {
    meta?: Meta[],
} & {
    [key in KnownMetadataKey]?: {
        '@id'?: string,
        '@dir'?: ContentDirection,
        '@lang'?: Language,
        '@file-as'?: string,
        '@role'?: string,
        '#text': string,
    }[]
}
export type Meta = Opf2Meta | Opf3Meta
export type MetaProperty = string
export type Opf3Meta = {
    '@property': MetaProperty,
    '@dir'?: ContentDirection,
    '@id'?: string,
    '@refines'?: string,
    '@scheme'?: string,
    '@lang'?: string,
    '#text': string,
}
export type Opf2Meta = {
    '@name': string,
    '@content': string,
}

export type PackageManifest = {
    '@id'?: string,
    item: ManifestItem[],
}
export type ManifestItem = {
    '@id': string,
    '@href': string,
    '@media-type': ManifestItemMediaType,
    '@fallback'?: string,
    '@properties'?: string,
    '@media-overlay'?: string,
}
export type TextItemMediaType =
    | 'application/xhtml+xml' | 'application/x-dtbncx+xml' | 'text/css'
export type BinaryItemMediaType =
    | 'image/png' | 'image/jpeg' | 'image/gif' | 'image/svg+xml'
    | 'application/x-font-ttf'
export type ManifestItemMediaType = TextItemMediaType | BinaryItemMediaType

export type PackageSpine = {
    '@id'?: string,
    '@toc'?: string,
    '@page-progression-direction'?: ContentDirection,
    itemref: SpineItem[],
}
export type SpineItem = {
    '@idref': string,
    '@linear'?: 'yes' | 'no',
    '@id'?: string,
    '@properties'?: string,
}

export type CollectionRole = string
export type PackageCollection = {
    '@role': CollectionRole,
    '@id'?: string,
    '@dir'?: ContentDirection,
    '@lang'?: string,
    metadata?: PackageMetadata[],
    collection?: PackageCollection[],
    link?: {
        '@href': string,
    }[],
}

export type PackageGuide = {
    guide: [{
        reference: {
            '@type': GuideReferenceType,
            '@href': string,
            '@title'?: string,
        }[],
    }]
}
export type GuideReferenceType = string

// ======Nav Document======
export type NavDocument = {
    html: [{
        body: [NavElement],
    }]
}

export type NavElement = {
    nav: [{
        '@epub:type': 'toc' | 'page-list' | 'landmark',
        h1?: [TextNode],
        h2?: [TextNode],
        h3?: [TextNode],
        h4?: [TextNode],
        h5?: [TextNode],
        h6?: [TextNode],
        ol: [NavOl],
    }],
}
export type NavOl = {
    li: {
        a?: [{
            '@href': string,
            '#text': string,
        }],
        span?: [TextNode],
        ol?: [NavOl],
    }[],
}

// ======NCX Document======

export type NcxDocument = {
    ncx: [{
        '@version': string,
        '@xmlns': string,
        '@xml:lang'?: string,
        navMap: [{
            navPoint: NavPoint[],
        }],
        head?: [{
            meta: Opf2Meta[],
        }],
        docTitle?: [NcxText],
        docAuthor?: [NcxText],
        pageList?: [{
            navLabel: [NcxText],
            pageTarget: PageTarget[],
        }],
        navList?: [{
            navLabel: [NcxText],
            navTarget: {
                '@id': string,
                navLabel: [NcxText],
                content: [NcxContent],
            }[],
        }],
    }]
}
export type NavPoint = {
    '@id': string,
    '@playOrder': NumberString,
    navLabel: [NcxText],
    content: [NcxContent],
    navPoint?: NavPoint[],
}
export type PageTarget = {
    '@id': string,
    '@value': string,
    '@type': string,
    '@playOrder': NumberString,
    navLabel: [NcxText],
    content: [NcxContent],
}
export type NcxContent = {
    '@src': string,
}
type TextNode = {
    '#text': string,
}
type NcxText = {
    text: [TextNode],
}

// ======Common & Utility Types======

export type LinkMediaType = string
export type Language = string // TODO: define this better
export type NumberString = `${number}`
export type ContentDirection = 'auto' | 'rtl' | 'ltr' | 'default'

    