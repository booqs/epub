import { Diagnostic, Result } from "./core"

export function getValue<T>(result: Result<T>, diagnostics: Diagnostic[]): T | undefined {
    let { value, diags } = result
    diagnostics.push(...diags)
    return value
}

export function isEmptyObject(obj: any): boolean {
    return obj === undefined || obj === '' || (Object.keys(obj).length === 0 && obj.constructor === Object)
}

export function diagnosticsToString(diagnostics: Diagnostic[]): string {
    return diagnostics.map(diagnosticToString).join('\n')
}

export function diagnosticToString(diagnostic: Diagnostic): string {
    return typeof diagnostic === 'string' ? diagnostic : JSON.stringify(diagnostic)
}