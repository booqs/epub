export type Diagnostic = DiagnosticString | DiagnosticObject
export type DiagnosticObject = {
    message: string,
    data?: any,
    severity?: DiagnosticSeverity,
}
export type DiagnosticString = string & {
    severity?: undefined,
}
export type DiagnosticSeverity = 'error' | 'warning' | 'critical' | 'info'
export type Diagnoser = Diagnostic[]

export type FileProvider<Binary = unknown> = {
    readText(path: string, diags?: Diagnoser): Promise<string | undefined>,
    readBinary(path: string, diags?: Diagnoser): Promise<Binary | undefined>,
}
