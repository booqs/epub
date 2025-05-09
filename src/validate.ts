import { z } from "zod"
import { Diagnoser, diagnoser } from "./diagnostic"
import {
    ContainerDocument, EncryptionDocument, FullEpub, ManifestDocument, MetadataDocument, NavDocument, NcxDocument, Package, PackageDocument,
    PackageItem, RightsDocument, SignaturesDocument, Unvalidated,
} from "./model"
import { containerDocument, navDocument, ncxDocument, packageDocument } from "./schema"

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
    if (!validateContainerDocument(container, diags)) {
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