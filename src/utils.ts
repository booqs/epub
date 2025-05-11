import { Diagnoser, Diagnostic } from './common'

export function lazy<T>(fn: () => T): () => T {
    let stored: {value: T} | undefined
    return () => {
        if (stored == undefined) {
            stored = {value: fn()}
        }
        return stored.value
    }
}

export function getBasePath(path: string): string {
    const index = path.lastIndexOf('/')
    if (index == -1) {
        return ''
    } else {
        return path.slice(0, index + 1)
    }
}

export function resolveHref(basePath: string, href: string): string {
    href = href.endsWith('/')
        ? href.substring(0, href.length - 1)
        : href
    return basePath + href
}

export function scoped(diagnoser: Diagnoser, label: string): Diagnoser {
    const inner: Diagnostic[] = []
    const scope: Diagnostic = {
        label,
        inner,
    }
    diagnoser.push(scope)
    return inner
}

export function flattenDiags(diags: Diagnoser): Diagnoser {
    const flattened: Diagnoser = []
    for (const diag of diags) {
        if (typeof diag == 'string') {
            flattened.push(diag)
        } else if ('label' in diag) {
            flattened.push(...flattenDiags(diag.inner.map(d => {
                if (typeof d == 'string') {
                    return {
                        message: d,
                        scope: [diag.label],
                    }
                } else {
                    return {
                        ...d,
                        scope: [diag.label, ...(d.scope ?? [])],
                    }
                }
            })))
        } else {
            flattened.push(diag)
        }
    }
    return flattened
}