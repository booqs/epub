import { FullEpub, Unvalidated } from "./model"
import { Diagnostic, Diagnostics, diagnostics } from "./diagnostic"
import { FileProvider, loadOptionalXml, loadXml } from "./file"
import { loadPackages } from "./package"
import { Validator, ValidatorType, validateObject } from "./validator"

export async function parseEpub(fileProvider: FileProvider): Promise<{
    value?: Unvalidated<FullEpub>,
    diags: Diagnostic[],
}> {
    const diags = diagnostics('parseEpub')
    let container = await loadXml(fileProvider, "META-INF/container.xml", diags)
    if (container == undefined) {
        return {
            value: undefined,
            diags: diags.all(),
        }
    }
    let packages = await loadPackages(container, fileProvider, diags)
    let encryption = await loadOptionalXml(fileProvider, "META-INF/encryption.xml", diags)
    let manifest = await loadOptionalXml(fileProvider, "META-INF/manifest.xml", diags)
    let metadata = await loadOptionalXml(fileProvider, "META-INF/metadata.xml", diags)
    let rights = await loadOptionalXml(fileProvider, "META-INF/rights.xml", diags)
    let signatures = await loadOptionalXml(fileProvider, "META-INF/signatures.xml", diags)
    return {
        value: {
            mimetype: await fileProvider.readText('mimetype'),
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
