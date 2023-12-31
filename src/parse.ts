import { ContainerDocument, EncryptionDocument, FullEpub, ManifestDocument, MetadataDocument, RightsDocument, SignaturesDocument, Unvalidated } from "./model"
import { Diagnoser, diagnoser } from "./diagnostic"
import { FileProvider, loadOptionalXml, loadXml } from "./file"
import { loadPackages } from "./package"

export async function parseEpub(fileProvider: FileProvider, diags?: Diagnoser): Promise<Unvalidated<FullEpub> | undefined> {
    diags = diags ?? diagnoser('parseEpub')
    let mimetype = await loadMimetype(fileProvider, diags)
    let container = await loadContainerDocument(fileProvider, diags)
    if (container == undefined) {
        return undefined
    }
    let packages = await loadPackages(container, fileProvider, diags)
    let encryption = await loadEncryptionDocument(fileProvider, diags)
    let manifest = await loadManifestDocument(fileProvider, diags)
    let metadata = await loadMetadataDocument(fileProvider, diags)
    let rights = await loadRightsDocument(fileProvider, diags)
    let signatures = await loadSignaturesDocument(fileProvider, diags)
    return {
        mimetype,
        container,
        packages,
        encryption,
        manifest,
        metadata,
        rights,
        signatures,
    }
}

export async function loadContainerDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<ContainerDocument> | undefined> {
    return loadXml(fileProvider, "META-INF/container.xml", diags)
}

export async function loadEncryptionDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<EncryptionDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/encryption.xml", diags)
}

export async function loadManifestDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<ManifestDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/manifest.xml", diags)
}

export async function loadMetadataDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<MetadataDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/metadata.xml", diags)
}

export async function loadRightsDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<RightsDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/rights.xml", diags)
}

export async function loadSignaturesDocument(fileProvider: FileProvider, diags: Diagnoser): Promise<Unvalidated<SignaturesDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/signatures.xml", diags)
}

export async function loadMimetype(fileProvider: FileProvider, diags: Diagnoser): Promise<string | undefined> {
    let mimetype = fileProvider.readText('mimetype', diags)
    if (!mimetype) {
        diags.push({
            message: 'missing mimetype',
        })
    }
    return mimetype
}

