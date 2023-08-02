import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { parseEpub } from './index'
import util from 'util'
import { Diagnostic } from './diagnostic'
import { FileProvider } from './file'

const inputPath = process.argv[2]
checkAllEpubs(inputPath ?? './epubs')

export async function checkAllEpubs(inputPath: string) {

    let diagnostics: Diagnostic[] = []
    const files = getAllEpubFiles(inputPath)
    let count = 0
    for await (const file of files) {
        if (++count % 100 == 0) {
            console.log(`Checked ${count} files`)
        }
        const diags = await getEpubDiagnostic(file)
        diagnostics.push(...diags)
        if (diags.length > 0) {
            console.log(`File: ${file}::::::::::`)
            printDiagnostics(diags)
        }
    }
}

function printDiagnostics(diagnostics: Diagnostic[]) {
    console.log(util.inspect(diagnostics, false, null, true))
}

async function getEpubDiagnostic(epubFilePath: string): Promise<Diagnostic[]> {
    const fileProvider = createZipFileProvider(fs.promises.readFile(epubFilePath))
    let { diags, value } = await parseEpub(fileProvider)
    return diags
}

function createZipFileProvider(fileContent: Promise<Buffer>): FileProvider {
    let zip: Promise<JSZip> | undefined
    return {
        async readText(path) {
            if (!zip) {
                zip = JSZip.loadAsync(fileContent)
            }
            const file = (await zip).file(path)
            if (!file) {
                return undefined
            }

            const content = await file.async('text')

            return content
        },
        async readBuffer(path) {
            if (!zip) {
                zip = JSZip.loadAsync(fileContent)
            }
            const file = (await zip).file(path)
            if (!file) {
                return undefined
            }

            const content = await file.async('nodebuffer')

            return content
        }
    }
}

async function* getAllEpubFiles(directoryPath: string): AsyncGenerator<string> {
    const files: string[] = await fs.promises.readdir(directoryPath)

    for (const file of files) {
        const filePath = path.join(directoryPath, file)
        const stat = await fs.promises.stat(filePath)

        if (stat.isDirectory()) {
            yield* getAllEpubFiles(filePath)
        } else if (path.extname(filePath) === '.epub') {
            yield filePath
        }
    }
}