import { processContainerXml } from "./container"
import { Epub, PackageDocument, RootFile, Xml } from "./model"
import { Diagnostic, Diagnostics, diagnostics } from "./diagnostic"
import { checkMimetype } from "./mimetype"
import { processPackageXml } from "./package"
import { parseXml } from "./xml"

export type FileProvider = {
    read: (path: string) => Promise<{
        value?: string,
        diags: Diagnostic[],
    }>,
}

export async function parseEpub(fileProvider: FileProvider): Promise<{
    value?: Epub,
    diags: Diagnostic[],
}> {
    const diags = diagnostics('parseEpub')
    const mimetype = await loadFile(fileProvider, "mimetype", diags)
    if (mimetype == undefined) {
        diags.push("mimetype file is missing")
    } else {
        checkMimetype(mimetype, diags)
    }
    let containerXml = await loadXml(fileProvider, "META-INF/container.xml", diags)
    if (containerXml == undefined) {
        diags.push("No valid container.xml")
        return { diags: diags.all() }
    }
    let container = processContainerXml(containerXml, diags.scope("container.xml"))
    if (container == undefined) {
        diags.push("Failed to process container.xml")
        return { diags: diags.all() }
    }
    let encryptionXml = await loadOptionalXml(fileProvider, "META-INF/encryption.xml", diags)
    let manifestXml = await loadOptionalXml(fileProvider, "META-INF/manifest.xml", diags)
    let metadataXml = await loadOptionalXml(fileProvider, "META-INF/metadata.xml", diags)
    let rightsXml = await loadOptionalXml(fileProvider, "META-INF/rights.xml", diags)
    let signaturesXml = await loadOptionalXml(fileProvider, "META-INF/signatures.xml", diags)
    let packages = await loadPackages(fileProvider, container.rootFiles, diags)
    return {
        value: {
            container,
            packages,
            encryption: encryptionXml,
            manifest: manifestXml,
            metadata: metadataXml,
            rights: rightsXml,
            signatures: signaturesXml,
        },
        diags: diags.all(),
    }
}

async function loadPackages(fileProvider: FileProvider, rootFiles: RootFile[], diags: Diagnostics): Promise<PackageDocument[]> {
    let packages: PackageDocument[] = []
    for (let rootFile of rootFiles) {
        let packageDoc = await loadPackage(fileProvider, rootFile, diags)
        if (packageDoc !== undefined) {
            packages.push(packageDoc)
        }
    }
    return packages
}

async function loadPackage(fileProvider: FileProvider, rootFile: RootFile, diags: Diagnostics): Promise<PackageDocument | undefined> {
    let packageXml = await loadXml(fileProvider, rootFile.fullPath, diags)
    if (!packageXml) {
        return undefined
    }
    let packageDocument = processPackageXml(packageXml, diags.scope(`package at ${rootFile.fullPath}`))
    if (!packageDocument) {
        return undefined
    }
    return {
        ...packageDocument,
        fullPath: rootFile.fullPath,
    }
}

async function loadXml(fileProvider: FileProvider, path: string, diags: Diagnostics): Promise<Xml | undefined> {
    let xmlFile = await loadFile(fileProvider, path, diags)
    if (xmlFile == undefined) {
        diags.push(`${path} is missing`)
        return undefined
    }
    let xml = parseXml(xmlFile, diags.scope(`xml at ${path}`))
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${path}`)
        return undefined
    } else {
        return xml
    }
}

async function loadOptionalXml(fileProvider: FileProvider, path: string, diags: Diagnostics): Promise<Xml | undefined> {
    let xmlFile = await loadFile(fileProvider, path, diagnostics('ignore'))
    if (xmlFile == undefined) {
        return undefined
    }
    let xml = parseXml(xmlFile, diags)
    if (xml == undefined) {
        diags.push(`Failed to parse xml: ${path}`)
        return undefined
    } else {
        return xml
    }
}

async function loadFile(fileProvider: FileProvider, path: string, diags: Diagnostics): Promise<string | undefined> {
    let { value, diags: fileOpenDiags } = await fileProvider.read(path)
    diags.push(...fileOpenDiags)
    if (value == undefined) {
        diags.push(`${path} is missing`)
    }
    return value
}
