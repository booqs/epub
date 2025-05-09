import JSZip from 'jszip'
import { FileProvider } from "./file"

export function createFileProvider(fileContent: Promise<Buffer>): FileProvider {
    const zip = JSZip.loadAsync(fileContent)
    return {
        async readText(path, diags) {
            try {
                const file = (await zip).file(path)
                if (!file) {
                    return undefined
                }
                return file.async('text')
            } catch (e) {
                diags.push({
                    message: `Error reading text ${path}: ${e}`,
                })
                return undefined
            }
        },
        async readBinary(path, diags) {
            try {
                const file = (await zip).file(path)
                if (!file) {
                    return undefined
                }
                return file.async('nodebuffer')
            } catch (e) {
                diags.push({
                    message: `Error reading binary ${path}: ${e}`,
                })
                return undefined
            }
        }
    }
}