import { FullEpub, Unvalidated } from "./model"
import { Diagnostic, Diagnostics, diagnostics } from "./diagnostic"
import { FileProvider, loadOptionalXml, loadXml } from "./file"
import { loadPackages } from "./package"
import { Validator, ValidatorType, validateObject } from "./validator"
import { validateContainer, validatePackage } from "./epub-validators"

export async function parseEpub(fileProvider: FileProvider): Promise<{
    value?: Unvalidated<FullEpub>,
    diags: Diagnostic[],
}> {
    const diags = diagnostics('parseEpub')
    let mimetype = await fileProvider.readText("mimetype")
    validateMimetype(mimetype, diags)
    let container = await loadXml(fileProvider, "META-INF/container.xml", diags)
    if (container == undefined) {
        return {
            value: undefined,
            diags: diags.all(),
        }
    }
    if (!validateContainer(container, diags)) {
        return {
            value: undefined,
            diags: diags.all(),
        }
    }
    let packages = await loadPackages(container, fileProvider, diags)
    packages.forEach(p => validatePackage(p.document, diags))
    let encryption = await loadOptionalXml(fileProvider, "META-INF/encryption.xml", diags)
    let manifest = await loadOptionalXml(fileProvider, "META-INF/manifest.xml", diags)
    let metadata = await loadOptionalXml(fileProvider, "META-INF/metadata.xml", diags)
    let rights = await loadOptionalXml(fileProvider, "META-INF/rights.xml", diags)
    let signatures = await loadOptionalXml(fileProvider, "META-INF/signatures.xml", diags)
    return {
        value: {
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

function validateMimetype(mimetype: string | undefined, diags: Diagnostics) {
    if (mimetype != "application/epub+zip") {
        diags.push("mimetype file is not application/epub+zip")
        return false
    }
}

function validate<T extends Validator>(obj: unknown, validator: T, diags: Diagnostics): obj is ValidatorType<T> {
    let missmatches = validateObject(obj, validator)
    for (let m of missmatches) {
        diags.push({
            message: `object failed validation`,
            data: m,
        })
    }
    return missmatches.length == 0
}
