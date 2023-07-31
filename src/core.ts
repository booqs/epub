// Refere https://www.w3.org/TR/epub-33/ for the EPUB spec.
// This implementation is partial, but should cover most use cases
export type Epub = {
    // The REQUIRED container.xml file in the META-INF directory identifies the package documents available in the OCF abstract container.
    // This library processe the container.xml file and extracts relevant information from it.
    container: Container,
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
    read: (path: string) => AsyncResult<string>,
}

export type Diagnostic = string | {
    message: string,
    data?: any,
}
export type Success<T> = {
    value: T,
    diags: Diagnostic[],
}
export type Failure = {
    value?: undefined,
    diags: Diagnostic[],
}
export type Result<T> = Success<T> | Failure
export type AsyncResult<T> = Promise<Result<T>>