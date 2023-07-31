import { Diagnostic, Dir, PackageDocument, Result, Xml, XmlAttributes } from "./core"

export function processPackageXml(packageXml: Xml): Result<Omit<PackageDocument, 'fullPath'>> {
    let diags: Diagnostic[] = []
    let [root, ...restNodes] = packageXml
    if (restNodes.length > 0) {
        diags.push(`package.xml should have exactly one rootfile element, got ${packageXml.length}`)
    }
    if (root.name !== 'package') {
        diags.push(`root element should be package, got: ${root.name}`)
        return { diags }
    }
    let {
        version, 'unique-identifier': uniqueIdentifier, 'prefix': prefix, 'xml:lang': lang, 'dir': dir,
        ...rest
    } = root.attrs ?? {}
    return {
        value: {
            version: processVersion(version, diags),
            uniqueIdentifier: processUniqueIdentifier(uniqueIdentifier, diags),
            prefix: processPrefix(prefix, diags),
            lang: processLang(lang, diags),
            dir: processDir(dir, diags),
            otherAttributes: processRest(rest, diags),
        },
        diags,
    }
}

function processVersion(version: string | undefined, diags: Diagnostic[]): string {
    if (version === undefined) {
        diags.push(`version is missing`)
        return ''
    }
    return version
}

function processUniqueIdentifier(uniqueIdentifier: string | undefined, diags: Diagnostic[]) {
    if (uniqueIdentifier === undefined) {
        diags.push(`unique_identifier is missing`)
        return ''
    }
    return uniqueIdentifier
}

function processPrefix(prefix: string | undefined, diags: Diagnostic[]) {
    return prefix
}

function processLang(lang: string | undefined, diags: Diagnostic[]) {
    return lang
}

function processDir(dir: string | undefined, diags: Diagnostic[]): Dir | undefined {
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

function processRest(rest: XmlAttributes, diags: Diagnostic[]) {
    expectAttributes(
        rest,
        ['xmlns:opf', 'xmlns:dc', 'xmlns:dcterms', 'xmlns:xsi', 'xmlns'],
        diags,
    )
    return rest
}

function expectAttributes(attributes: XmlAttributes, expected: string[], diags: Diagnostic[]) {
    for (let key of Object.keys(attributes)) {
        if (!expected.includes(key)) {
            diags.push(`Unexpected attribute: ${key}`)
        }
    }
}