export type Diagnostic = {
    message: string,
    data?: any,
    severity?: DiagnosticSeverity,
    scope?: DiagnosticScope[],
}
export type DiagnosticSeverity = 'error' | 'warning' | 'critical' | 'info'
export type DiagnosticScope = string | object
export type Diagnoser = {
    push(...diagnostic: Array<Diagnostic | string>): void,
    all(): Diagnostic[],
    scope(scope: DiagnosticScope): Diagnoser,
}

export function diagnosticsToString(diagnostics: Diagnostic[]): string {
    return diagnostics.map(diagnosticToString).join('\n')
}

export function diagnosticToString(diagnostic: Diagnostic): string {
    return typeof diagnostic === 'string' ? diagnostic : JSON.stringify(diagnostic)
}

export function diagnoser(topScope: DiagnosticScope): Diagnoser {
    function isDiagnostics(diag: InternalDiagnostic): diag is Diagnoser {
        return typeof (diag as Diagnoser).all === 'function'
    }
    type InternalDiagnostic = Diagnostic | string | Diagnoser
    let internal: InternalDiagnostic[] = []
    function flatten(diags: InternalDiagnostic[], scope: DiagnosticScope[]): Diagnostic[] {
        return diags.map((diag): Diagnostic[] => {
            if (isDiagnostics(diag)) {
                return diag.all().map(d => ({
                    ...d,
                    scope: [topScope, ...d.scope ?? []],
                }))
            } else if (typeof diag === 'string') {
                return [{
                    message: diag,
                    scope,
                }]
            } else {
                return [{
                    ...diag,
                    scope: [topScope, ...diag.scope ?? []],
                }]
            }
        }).flat()
    }
    return {
        all() {
            return flatten(internal, [topScope])
        },
        push(...diags: Array<Diagnostic | string>) {
            internal.push(...diags)
        },
        scope(scope: DiagnosticScope) {
            let scoped = diagnoser(scope)
            internal.push(scoped)
            return scoped
        },
    }
}