import { Diagnoser } from './diagnostic'
import { Opf2Meta, PackageDocument } from './model'
import { UnvalidatedXml } from './xml'

export type EpubMetadataItem = Record<string, string> 
export type EpubMetadata = Record<string, EpubMetadataItem[]>
export function extractMetadata(document: UnvalidatedXml<PackageDocument>, diags: Diagnoser) {
    const result: EpubMetadata = {}
    const [metadata] = document.package?.[0]?.metadata ?? []
    if (metadata == undefined) {
        diags.push({
            message: 'package is missing metadata',
            data: document,
        })
        return result
    }
    const { meta, ...rest } = metadata
    for (const [key, value] of Object.entries(rest)) {
        if (!Array.isArray(value)) {
            diags.push({
                message: 'package metadata is not an array',
                data: value,
            })
            continue
        }
        result[key] = value
    }
    for (const m of (meta ?? [])) {
        const { '@name': name, '@content': content } = (m as UnvalidatedXml<Opf2Meta>)
        if (name === undefined || content === undefined) {
            continue
        }
        const item: EpubMetadataItem = {
            '#text': content,
        }
        if (result[name] !== undefined) {
            result[name].push(item)
        } else {
            result[name] = [item]
        }
    }
    return result
}