export function lazy<T>(fn: () => T): () => T {
    let stored: {value: T} | undefined
    return () => {
        if (stored == undefined) {
            stored = {value: fn()}
        }
        return stored.value
    }
}