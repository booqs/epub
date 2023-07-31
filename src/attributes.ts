import { Diagnostics, XmlAttributes, ContentDirection, Language } from "./core"

export function processVersion(version: string | undefined, diags: Diagnostics): string {
    if (version === undefined) {
        diags.push(`version is missing`)
        return ''
    }
    return version
}

export function processUniqueIdentifier(uniqueIdentifier: string | undefined, diags: Diagnostics) {
    if (uniqueIdentifier === undefined) {
        diags.push(`unique_identifier is missing`)
        return ''
    }
    return uniqueIdentifier
}

export function processPrefix(prefix: string | undefined, diags: Diagnostics) {
    return prefix
}

export function processLang(lang: string | undefined, diags: Diagnostics): Language | undefined {
    return lang
}

export function processDir(dir: string | undefined, diags: Diagnostics): ContentDirection | undefined {
    switch (dir) {
        case 'auto':
        case 'ltr':
        case 'rtl':
            return dir
        case undefined:
            return undefined
        default:
            diags.push(`dir should be ltr, rtl or auto, got: ${dir}`)
            return undefined
    }
}

export function expectAttributes(attributes: XmlAttributes, expected: string[], diags: Diagnostics) {
    for (let key of Object.keys(attributes)) {
        if (!expected.includes(key)) {
            diags.push({
                message: `Unexpected attribute: ${key}`,
                severity: 'warning',
            })
        }
    }
}