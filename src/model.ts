// Refere https://www.w3.org/TR/epub-33/ for the EPUB spec.

export type Unvalidated<T> = T extends string ? string
    : T extends Array<infer U> ? Unvalidated<U>[]
    : T extends object ? {
        [P in keyof T]?: Unvalidated<T[P]>;
    } : T;

export type Attributes = {
    [Attr in `@${string}`]?: string;
}

export type LinkMediaType = string
export type Language = string // TODO: define this better
export type NumberString = `${number}`
export type ContentDirection = 'auto' | 'rtl' | 'ltr' | 'default'

export type BinaryType = unknown

export type Xml = XmlContainer
export type XmlNode = XmlContainer | XmlText
export type XmlContainer = {
    [key in string]?: XmlNode[];
}
export type XmlText = {
    '#text': string,
}
// TODO: change to better type
export type Html = {
    html: HtmlNode,
}
export type HtmlNode = {
    [key in string]?: HtmlNode[];
} & {
    attrs: {
        [key in string]?: string;
    };
} | {
    '#text': string,
}

export type FullEpub = {
    mimetype: 'application/epub+zip',
    container: ContainerDocument,
    packages: Package[],
    encryption?: EncryptionDocument,
    manifest?: ManifestDocument,
    metadata?: MetadataDocument,
    rights?: RightsDocument,
    signatures?: SignaturesDocument,
}
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
export type EncryptionDocument = Xml
export type SignaturesDocument = Xml
export type MetadataDocument = Xml
export type RightsDocument = Xml
export type ManifestDocument = Xml

export type Package = {
    fullPath: string,
    document: PackageDocument,
    items: PackageItem[],
}

export type PackageDocument = {
    package: [{
        '@unique-identifier': string,
        '@version': string,
        '@prefix'?: string,
        '@id'?: string,
        '@dir'?: ContentDirection,
        '@xml:lang'?: string,
        metadata: [PackageMetadata],
        manifest: [PackageManifest],
        spine: [PackageSpine],
        collection?: PackageCollection[],
        guide?: [PackageGuide],
        bindings?: XmlNode[],
    }],
}
export type PackageMetadata = {
    meta?: Meta[],
    'dc:identifier'?: {
        '@id'?: string,
        '#text': string,
    }[],
    'dc:title'?: {
        '@id'?: string,
        '@dir'?: ContentDirection,
        '@xml:lang'?: string,
        '#text': string,
    }[],
    'dc:language'?: {
        '@id'?: string,
        '#text': string,
    }[],
} & Opf2Metadata & OptionalDcMetadata
export const opf2MetadataKeys = [
    'title', 'creator', 'subject', 'description', 'publisher', 'contributor',
    'date', 'type', 'format', 'identifier', 'coverage', 'source', 'relation',
    'rights', 'language',
] as const
export type Opf2MetadataKey = typeof opf2MetadataKeys[number]
export type Opf2Metadata = {
    [key in Opf2MetadataKey]?: {
        '#text': string,
    };
}
export const optionalDcMetadataKeys = [
    'dc:contributor', 'dc:coverage', 'dc:creator', 'dc:date', 'dc:description',
    'dc:format', 'dc:publisher', 'dc:relation', 'dc:rights', 'dc:source',
    'dc:subject', 'dc:type',
] as const
export type OptionalDcMetadataKey = typeof optionalDcMetadataKeys[number]
export type OptionalDcMetadata = {
    [key in OptionalDcMetadataKey]?: Array<{
        '@id'?: string,
        '@dir'?: ContentDirection,
        '@xml:lang'?: string,
        '#text': string,
    } & Attributes>;
}
export type Meta = Opf2Meta | Opf3Meta
export const knownMetaProperties = [
    'alternate-script', 'authority', 'belongs-to-collection', 'collection-type', 'display-seq', 'file-as', 'group-position', 'identifier-type', 'role', 'source-of', 'term', 'title-type',
] as const
export type MetaProperty = | typeof knownMetaProperties[number] | `${string}:${string}`
export type Opf3Meta = {
    '@property': MetaProperty,
    '@dir'?: ContentDirection,
    '@id'?: string,
    '@refines'?: string,
    '@scheme'?: string,
    '@xml:lang'?: string,
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
export const knownTextItems = [
    'application/xhtml+xml', 'application/x-dtbncx+xml',
    'text/css',
] as const
export const knownBinaryItems = [
    'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml',
    'application/x-font-ttf',
] as const
export const knownManifestItemMediaTypes = [
    ...knownTextItems, ...knownBinaryItems,
] as const
export type TextItemMediaType = typeof knownTextItems[number]
export type BinaryItemMediaType = typeof knownBinaryItems[number]
export type ManifestItemMediaType = TextItemMediaType | BinaryItemMediaType
export type PackageItem = TextItem | BinaryItem | UnknownItem
export type TextItem = {
    item: Unvalidated<ManifestItem>,
    mediaType: TextItemMediaType,
    kind: 'text',
    content: string,
}
export type BinaryItem = {
    item: Unvalidated<ManifestItem>,
    mediaType: BinaryItemMediaType,
    kind: 'binary',
    content: BinaryType,
}
export type UnknownItem = {
    item: Unvalidated<ManifestItem>,
    mediaType: string | undefined,
    kind: 'unknown',
    content: BinaryType,
}

export type PackageSpine = {
    '@id'?: string,
    '@toc'?: string,
    '@page-progression-direction'?: ContentDirection,
    itemref: {
        '@idref': string,
        '@linear'?: 'yes' | 'no',
        '@id'?: string,
        '@properties'?: string,
    }[],
}

export type CollectionRole = string
export type PackageCollection = {
    '@role': CollectionRole,
    '@id'?: string,
    '@dir'?: ContentDirection,
    '@xml:lang'?: string,
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
export const knownGuideReferenceTypes = [
    'cover', 'title-page', 'toc', 'index', 'glossary', 'acknowledgements',
    'bibliography', 'colophon', 'dedication', 'epigraph', 'foreword',
    'loi', 'lot', 'notes', 'preface', 'text',
    'copyright-page',
] as const
export type GuideReferenceType = typeof knownGuideReferenceTypes[number] | `other${string}`

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
            pageTarget: {
                '@id': string,
                '@value': string,
                '@type': string,
            }[],
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
export type NcxContent = {
    '@src': string,
}
export type NcxText = {
    text: [XmlText],
}

export type NavDocument = {
    html: [{
        body: [NavElement],
    }]
}

export type NavElement = {
    nav: [{
        '@epub:type': 'toc' | 'page-list' | 'landmark',
        h1?: [XmlText],
        h2?: [XmlText],
        h3?: [XmlText],
        h4?: [XmlText],
        h5?: [XmlText],
        h6?: [XmlText],
        ol: [NavList],
    }],
}
export type NavList = {
    li: {
        a?: [{
            '@href': string,
            '#text': string,
        }],
        span?: [XmlText],
        ol?: [NavList],
    }[],
}

export type TocItem = {
    label: string,
    href: string,
    level: number,
}