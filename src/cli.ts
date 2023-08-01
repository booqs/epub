import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { parseEpub } from './index'
import util from 'util'
import { Diagnostic } from './diagnostic'
import { FileProvider } from './epub'

checkAllEpubs()

export async function checkAllEpubs() {
    let epubFiles = await getAllEpubFiles('epubs')
    let diagnostics: Diagnostic[] = []
    for (let file of epubFiles) {
        let diags = await getEpubDiagnostic(file)
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
    let { diags } = await parseEpub(fileProvider)
    return diags
}

function createZipFileProvider(fileContent: Promise<Buffer>): FileProvider {
    let zip: Promise<JSZip> | undefined
    return {
        read: async (path: string) => {
            if (!zip) {
                zip = JSZip.loadAsync(fileContent)
            }
            const file = (await zip).file(path)
            if (!file) {
                return {
                    diags: [{
                        message: `File ${path} not found in zip archive`,
                        severity: 'critical',
                    }]
                }
            }

            const content = await file.async('text')

            return { value: content, diags: [] }
        }
    }
}

async function getAllEpubFiles(directoryPath: string): Promise<string[]> {
    const files: string[] = await fs.promises.readdir(directoryPath)
    const epubFiles: string[] = []

    for (const file of files) {
        const filePath = path.join(directoryPath, file)
        const stat = await fs.promises.stat(filePath)

        if (stat.isDirectory()) {
            const subdirectoryEpubFiles = await getAllEpubFiles(filePath)
            epubFiles.push(...subdirectoryEpubFiles)
        } else if (path.extname(filePath) === '.epub') {
            epubFiles.push(filePath)
        }
    }

    return epubFiles
}