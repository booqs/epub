# booqs-epub

This is a simple epub parser. It is somewhat incomplete, though should cover most cases. This package intentionally doesn't take any dependencies on zip libraries. Instead user should provide simple ```FileProvider``` as an input to the API. For example, you can create a ```FileProvider``` using popular ```jszip``` lib and use it like this:

```{typescript}
import JSZip from 'jszip'
import fs from 'fs'
import { openEpub, FileProvider } from 'booqs-epub'

function createZipFileProvider(fileContent: Promise<Buffer>): FileProvider {
    let zip = JSZip.loadAsync(fileContent)
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

export function openEpubAtPath(epubFilePath: string) {
    const fileProvider = createZipFileProvider(fs.promises.readFile(epubFilePath))
    return openEpub(fileProvider)
}
```