// Refere https://www.w3.org/TR/epub-33/ for the EPUB spec.
// This implementation is partial, but should cover most use cases
export type Epub = {
    // The REQUIRED container.xml file in the META-INF directory identifies the package documents available in the OCF abstract container.
    // This library processe the container.xml file and extracts relevant information from it.
    container: Container,
    packages: PackageDocument[],
    // The OPTIONAL encryption.xml file in the META-INF directory holds all encryption information on the contents of the container. If an EPUB creator encrypts any resources within the container, they MUST include an encryption.xml file to provide information about the encryption used.
    // Spec provide further details on the encryption.xml file, but this library doesn't support processing it.
    encryption?: Xml,
    // The OPTIONAL signatures.xml file in the META-INF directory holds digital signatures for the container and its contents.
    // Spec provide further details on the signatures.xml file, but this library doesn't support processing it.
    signatures?: Xml,
    // The OPTIONAL metadata.xml file in the META-INF directory is only for container-level metadata.
    // If EPUB creators include a metadata.xml file, they SHOULD use only namespace-qualified elements [xml-names] in it. The file SHOULD contain the root element [xml] metadata in the namespace http://www.idpf.org/2013/metadata, but this specification allows other root elements for backwards compatibility.
    metadata?: Xml,
    //This specification reserves the OPTIONAL rights.xml file in the META-INF directory for the trusted exchange of EPUB publications among rights holders, intermediaries, and users.
    // When EPUB creators do not include a rights.xml file, no part of the OCF abstract container is rights governed at the container level. Rights expressions might exist within the EPUB publications.
    rights?: Xml,
    // The OPTIONAL manifest.xml file in the META-INF directory provides a manifest of files in the container.
    // The OCF specification does not mandate a format for the manifest.
    manifest?: Xml,
}
export type Container = {
    // Each rootfile element identifies the location of one package document in the EPUB container.
    rootFiles: RootFile[],
    // NOTE: Link elements are not supported by this library!
}
export type RootFile = {
    fullPath: string,
    mediaType: MediaType,
}
export type MediaType = string
export type PackageDocument = {
    // Full path to map to the root file.
    fullPath: string,
    // This is resolved unique identifier for the package document.
    // It is required by spec, but not enfoced by this library.
    uid?: string,
    // Thid is identifier of the metadata dc:identifier element that should be used as uid.
    // It is required by spec, but not enfoced by this library.
    uniqueIdentifier?: string,
    metadata: PackageMetadata,
    // Version is required by the spec, but this library doesn't enforce it.
    version?: string,
    dir?: ContentDirection,
    id?: string,
    // The prefix attribute defines prefix mappings for use in property values.
    // Spec elaborate on how prefix mappings are defined, but this library doesn't support processing them.
    prefix?: string,
    // This is xml:lang
    lang?: Language,
    otherAttributes?: XmlAttributes,
}
export type PackageMetadata = {
    titles: MetadataTitle[],
    identifiers: MetadataIdentifier[],
}
export type MetadataTitle = {
    value: string,
    lang?: Language,
    dir?: ContentDirection,
    id?: string,
}
export type MetadataIdentifier = {
    value: string,
    id?: string,
}
export type DublinCoreElement = {
    value: string,
    name: string,
    id?: string,
    dir?: ContentDirection,
    lang?: Language,
}
export type ContentDirection = 'auto' | 'rtl' | 'ltr'
export type Language = string
export type MetadataLanguage = {
    value: string,
    id?: string,
}
export type XmlAttributes = {
    [key: string]: string,
}
export type XmlNode = {
    name: string,
    attrs?: XmlAttributes,
    children?: XmlNode[],
}
export type Xml = XmlNode[]

export type FileProvider = {
    read: (path: string) => Promise<{
        value?: string,
        diags: Diagnostic[],
    }>,
}

export type Diagnostic = {
    message: string,
    data?: any,
    severity?: DiagnosticSeverity,
    scope?: DiagnosticScope[],
}
export type DiagnosticSeverity = 'error' | 'warning' | 'critical'
export type DiagnosticScope = string | object
export type Diagnostics = {
    push(...diagnostic: Array<Diagnostic | string>): void,
    all(): Diagnostic[],
    scope(scope: DiagnosticScope): Diagnostics,
}