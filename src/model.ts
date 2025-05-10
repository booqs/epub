// Refere https://www.w3.org/TR/epub-33/ for the EPUB spec.

import { z } from 'zod'
import {
    containerDocument, encryptionDocument, manifestDocument, metadataDocument, navDocument, ncxDocument, opf2meta, packageDocument, rightsDocument, signaturesDocument,
} from './schema'

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