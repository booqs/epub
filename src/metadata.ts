import { Diagnoser } from './common'
import { Opf2Meta, Opf3Meta, PackageDocument } from './model'
import { UnvalidatedXml } from './xml'

export type EpubMetadataItem = Record<string, string> 
export type EpubMetadata = Record<string, EpubMetadataItem[]>
export function extractMetadata(document: UnvalidatedXml<PackageDocument>, diags?: Diagnoser) {
    const [metadata] = document.package?.[0]?.metadata ?? []
    if (metadata == undefined) {
        diags?.push({
            message: 'package is missing metadata',
            data: document,
        })
        return {}
    }
    const result: EpubMetadata = {}
    function addMetadata(key: string, items: EpubMetadataItem[]) {
        if (result[key] !== undefined) {
            result[key].push(...items)
        } else {
            result[key] = items
        }
    }
    function refineMetadata(id: string, property: string, value: string) {
        const item = Object.values(result).flat().find(i => i['@id'] == id)
        if (item == undefined) {
            diags?.push({
                message: `failed to find metadata item for id: ${id}`,
                data: metadata,
            })
            return
        }
        if (item[property] !== undefined) {
            diags?.push({
                message: `metadata item already has property ${property}: ${id}`,
                data: metadata,
            })
            return
        }
        item[property] = value
    }
    const { meta, link, ...rest } = metadata
    for (const [key, value] of Object.entries(rest)) {
        if (key.startsWith('@')) {
            diags?.push(`Unexpected attribute in metadata: ${key}=${value}`)
            continue
        }
        if (!Array.isArray(value)) {
            diags?.push({
                message: 'package metadata is not an array',
                data: value,
            })
            continue
        }
        addMetadata(key, value)
    }
    for (const m of (meta ?? [])) {
        const { '@name': name, '@content': content } = (m as UnvalidatedXml<Opf2Meta>)
        if (name && content) {
            addMetadata(name, [{ '#text': content }])
            continue
        }
        const { '@property': property, '@refines': refines, '#text': text } = (m as UnvalidatedXml<Opf3Meta>)
        if (!text) {
            diags?.push({
                message: 'metadata is missing text',
                data: m,
            })
            continue
        }
        if (property) {
            if (refines) {
                if (refines.startsWith('#')) {
                    const id = refines.substring(1)
                    refineMetadata(id, property, text)
                } else {
                    diags?.push({
                        message: `refines attribute is not a valid id: ${refines}`,
                        data: m,
                    })
                }
            } else {
                addMetadata(property, [{ '#text': text }])
            }
        }
    }
    return result
}