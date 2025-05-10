import { z } from 'zod'
import { Diagnoser, diagnoser } from './diagnostic'
import {
    ContainerDocument, EncryptionDocument, ManifestDocument, MetadataDocument, NavDocument, NcxDocument, PackageDocument,
    RightsDocument, SignaturesDocument, Unvalidated,
} from './model'
import { containerDocument, navDocument, ncxDocument, packageDocument } from './schema'
import { FullEpub, Package } from './parse'

export function validateEpub(epub: Unvalidated<FullEpub>, optDiags?: Diagnoser): FullEpub | undefined {
    const diags = optDiags?.scope('epub validation') ?? diagnoser('epub validation')
    const {
        container, package: pkg,
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
    if (!validateContainerDocument(container, diags)) {
        return undefined
    }
    if (!validatePackage(pkg, diags)) {
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
        package: pkg,
    }
}

export function validatePackage(pkg: Unvalidated<Package> | undefined, diags: Diagnoser): pkg is Package {
    if (pkg == undefined) {
        diags.push({
            message: 'missing package document',
        })
        return false
    }
    if (!validatePackageDocument(pkg.document, diags)) {
        return false
    }
    if (pkg.ncx) {
        if (!validateNcxDocument(pkg.ncx, diags)) {
            return false
        }
    }
    if (pkg.nav) {
        if (!validateNavDocument(pkg.nav, diags)) {
            return false
        }
    }
    return true
}

export const validateContainerDocument = makeValidator(containerDocument, 'container')
export const validatePackageDocument = makeValidator(packageDocument, 'package')
export const validateNavDocument = makeValidator(navDocument, 'nav')
export const validateNcxDocument = makeValidator(ncxDocument, 'ncx')

type DocumentType = ContainerDocument | PackageDocument | NavDocument | NcxDocument
function makeValidator<T extends DocumentType>(zodValidator: z.ZodType<T>, scope: string) {
    return function validate(object: Unvalidated<DocumentType> | undefined, diags: Diagnoser): object is T {
        diags = diags.scope(scope)
        const result = zodValidator.safeParse(object)
        if (result.success) {
            return true
        } else {
            diags.push({
                message: `failed validation: ${result.error}`
            })
            return false
        }
    }
}