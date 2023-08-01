import { XmlAttributes } from "./model"

export type EmptyObject = Record<string, never>
export function optionalExtra(obj: XmlAttributes | undefined): {
    extra?: XmlAttributes
} | EmptyObject {
    return obj && Object.keys(obj).length > 0
        ? { extra: obj }
        : {}
}