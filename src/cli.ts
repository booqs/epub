import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { parseEpub } from './index'
import util from 'util'
import { Diagnostic } from './diagnostic'
import { FileProvider } from './file'
import { validateEpub } from './epub-validators'
import { epubIterator } from './iterator'

const inputPath = process.argv[2]
checkAllEpubs(inputPath ?? './epubs')

export async function checkAllEpubs(inputPath: string) {

    let diagnostics: Diagnostic[] = []
    const files = getAllEpubFiles(inputPath)
    const problems: string[] = []
    let count = 0
    for await (const file of files) {
        if (++count % 100 == 0) {
            console.log(`Checked ${count} files`)
        }
        const diags = await getEpubDiagnostic(file)
        diagnostics.push(...diags)
        if (diags.length > 0) {
            console.log(`File: ${file}::::::::::`)
            problems.push(file)
            printDiagnostics(diags)
        }
    }
    console.log(`Checked ${count} files`)
    if (problems.length > 0) {
        console.log('Problems::::::::::')
        console.log(problems.join('\n'))
    }
}

function printDiagnostics(diagnostics: Diagnostic[]) {
    console.log(util.inspect(diagnostics, false, null, true))
}

async function getEpubDiagnostic(epubFilePath: string): Promise<Diagnostic[]> {
    const fileProvider = createZipFileProvider(fs.promises.readFile(epubFilePath))
    let { diags, value } = await parseEpub(fileProvider)
    if (value) {
        let { diags: validationDiags } = validateEpub(value)
        diags.push(...validationDiags)
    }
    let iterator = epubIterator(fileProvider)
    // for await (const pkg of iterator.packages()) {
    //     for await (let item of pkg.items()) {
    //         item.load()
    //     }
    // }
    diags.push(...iterator.diagnostics())
    return diags
}

function createZipFileProvider(fileContent: Promise<Buffer>): FileProvider {
    let zip: Promise<JSZip> | undefined
    return {
        async readText(path) {
            try {
                if (!zip) {
                    zip = JSZip.loadAsync(fileContent)
                }
                const file = (await zip).file(path)
                if (!file) {
                    return undefined
                }

                const content = await file.async('text')

                return content
            } catch (e) {
                console.error(`Error reading text ${path}: ${e}`)
                return undefined
            }
        },
        async readBinary(path) {
            try {
                if (!zip) {
                    zip = JSZip.loadAsync(fileContent)
                }
                const file = (await zip).file(path)
                if (!file) {
                    return undefined
                }

                const content = await file.async('nodebuffer')

                return content
            } catch (e) {
                console.error(`Error reading binary ${path}: ${e}`)
                return undefined
            }
        }
    }
}

async function* getAllEpubFiles(directoryPath: string): AsyncGenerator<string> {
    const stat = await fs.promises.stat(directoryPath)
    if (stat.isDirectory()) {
        const files: string[] = await fs.promises.readdir(directoryPath)
        for (const file of files) {
            const filePath = path.join(directoryPath, file)
            yield* getAllEpubFiles(filePath)
        }
    } else if (path.extname(directoryPath) === '.epub') {
        yield directoryPath
    }
}