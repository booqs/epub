import { ContainerDocument, EncryptionDocument, FullEpub, ManifestDocument, MetadataDocument, RightsDocument, SignaturesDocument, Unvalidated } from "./model"
import { Diagnostic, Diagnostics, diagnostics } from "./diagnostic"
import { FileProvider, loadOptionalXml, loadXml } from "./file"
import { loadPackages } from "./package"

export async function parseEpub(fileProvider: FileProvider): Promise<{
    value?: Unvalidated<FullEpub>,
    diags: Diagnostic[],
}> {
    const diags = diagnostics('parseEpub')
    let mimetype = await loadMimetype(fileProvider, diags)
    let container = await loadContainerDocument(fileProvider, diags)
    if (container == undefined) {
        return {
            value: undefined,
            diags: diags.all(),
        }
    }
    let packages = await loadPackages(container, fileProvider, diags)
    let encryption = await loadEncryptionDocument(fileProvider, diags)
    let manifest = await loadManifestDocument(fileProvider, diags)
    let metadata = await loadMetadataDocument(fileProvider, diags)
    let rights = await loadRightsDocument(fileProvider, diags)
    let signatures = await loadSignaturesDocument(fileProvider, diags)
    return {
        value: {
            mimetype,
            container,
            packages,
            encryption,
            manifest,
            metadata,
            rights,
            signatures,
        },
        diags: diags.all(),
    }
}

export async function loadContainerDocument(fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<ContainerDocument> | undefined> {
    return loadXml(fileProvider, "META-INF/container.xml", diags)
}

export async function loadEncryptionDocument(fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<EncryptionDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/encryption.xml", diags)
}

export async function loadManifestDocument(fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<ManifestDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/manifest.xml", diags)
}

export async function loadMetadataDocument(fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<MetadataDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/metadata.xml", diags)
}

export async function loadRightsDocument(fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<RightsDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/rights.xml", diags)
}

export async function loadSignaturesDocument(fileProvider: FileProvider, diags: Diagnostics): Promise<Unvalidated<SignaturesDocument> | undefined> {
    return loadOptionalXml(fileProvider, "META-INF/signatures.xml", diags)
}

export async function loadMimetype(fileProvider: FileProvider, diags: Diagnostics): Promise<string | undefined> {
    let mimetype = fileProvider.readText('mimetype', diags)
    if (!mimetype) {
        diags.push({
            message: 'missing mimetype',
        })
    }
    return mimetype
}

