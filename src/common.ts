export type Diagnostic = DiagnosticString | DiagnosticObject | DiagnosticScope
export type DiagnosticObject = {
    message: string,
    data?: any,
    severity?: DiagnosticSeverity,
    scope?: string[],
    label?: undefined,
    inner?: undefined,
}
export type DiagnosticScope = {
    message?: undefined,
    data?: undefined,
    severity?: DiagnosticSeverity,
    scope?: string[],
    label: string,
    inner: Diagnostic[],
}
export type DiagnosticString = string & {
    message?: undefined,
    data?: undefined,
    severity?: undefined,
    scope?: undefined,
    label?: undefined,
    inner?: undefined,
}
export type DiagnosticSeverity = 'error' | 'warning' | 'critical' | 'info'
export type Diagnoser = Diagnostic[]

export type FileProvider<Binary = unknown> = {
    readText(path: string, diags?: Diagnoser): Promise<string | undefined>,
    readBinary(path: string, diags?: Diagnoser): Promise<Binary | undefined>,
}
