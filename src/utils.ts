import { Diagnoser } from './common'

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
        : href + '/'
    return basePath + href
}

export function scoped(diagnoser: Diagnoser, label: string): Diagnoser {
    const scoped: Diagnoser = []
    diagnoser.push({
        message: `Scope: ${label}`,
        severity: 'info',
        inner: scoped,
    })
    return scoped
}