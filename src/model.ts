// Refere https://www.w3.org/TR/epub-33/ for the EPUB spec.

import { z } from 'zod'
import {
    containerDocument, encryptionDocument, manifestDocument, metadataDocument, navDocument, ncxDocument, opf2meta, packageDocument, rightsDocument, signaturesDocument,
} from './schema'

export type Unvalidated<T> =
    T extends Array<infer U> ? Unvalidated<U>[] :
    T extends object ? {
        [P in keyof T]?: Unvalidated<T[P]>;
    } :
    T extends string ? string :
    T extends number ? number :
    T extends boolean ? boolean :
    T
    ;

export type Validated<T> =
    T extends Array<infer U> ? Validated<U>[] :
    T extends object ? {
        [P in keyof T]: Validated<T[P]>;
    } :
    T extends string ? T :
    T extends number ? T :
    T extends boolean ? T :
    T
    ;

export type Attributes = {
    [Attr in `@${string}`]?: string;
}

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
export type ContainerDocument = z.infer<typeof containerDocument>
export type EncryptionDocument = z.infer<typeof encryptionDocument>
export type SignaturesDocument = z.infer<typeof signaturesDocument>
export type MetadataDocument = z.infer<typeof metadataDocument>
export type RightsDocument = z.infer<typeof rightsDocument>
export type ManifestDocument = z.infer<typeof manifestDocument>
export type PackageDocument = z.infer<typeof packageDocument>
export type NavDocument = z.infer<typeof navDocument>
export type NcxDocument = z.infer<typeof ncxDocument>

export type NavOl = NavDocument['html'][number]['body'][number]['nav'][number]['ol'][number]

export type NavPoint = NonNullable<NcxDocument['ncx'][number]['navMap'][number]['navPoint']>[number]
export type PageTarget = NonNullable<NcxDocument['ncx'][number]['pageList']>[number]['pageTarget'][number]

export type Opf2Meta = z.infer<typeof opf2meta>

export type Package = {
    fullPath: string,
    document: PackageDocument,
    items: PackageItem[],
    spine: PackageItem[],
    ncx?: NcxDocument,
    nav?: NavDocument,
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

export type TocItem = {
    label: string,
    href: string,
    level: number,
}