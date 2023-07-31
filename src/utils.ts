import { Diagnostic, Result } from "./core"

export function getValue<T>(result: Result<T>, diagnostics: Diagnostic[]): T | undefined {
    let { value, diags } = result
    diagnostics.push(...diags)
    return value
}

export function isEmptyObject(obj: any): boolean {
    return obj === undefined || Object.keys(obj).length === 0 && obj.constructor === Object
}