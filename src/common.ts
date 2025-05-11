export type Diagnostic = DiagnosticString | DiagnosticObject | DiagnosticScope
export type DiagnosticObject = {
    message: string,
    data?: any,
    severity?: DiagnosticSeverity,
    scope?: string[],
}
export type DiagnosticScope = {
    label: string,
    inner: Diagnostic[],
    scope?: string[],
}
export type DiagnosticString = string & {
    label?: undefined,
    message?: undefined,
}
export type DiagnosticSeverity = 'error' | 'warning' | 'critical' | 'info'
export type Diagnoser = Diagnostic[]

export type FileProvider<Binary = unknown> = {
    readText(path: string, diags?: Diagnoser): Promise<string | undefined>,
    readBinary(path: string, diags?: Diagnoser): Promise<Binary | undefined>,
}
