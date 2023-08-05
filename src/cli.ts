import fs from 'fs'
import path from 'path'
import { parseEpub } from './index'
import util from 'util'
import { Diagnostic } from './diagnostic'
import { validateEpub } from './validate'
import { openEpub } from './open'
import { createFileProvider } from './mock'

main()
function main() {
    const inputPath = process.argv[2] ?? './epubs'
    logTime('checkAllEpubs', () => checkAllEpubs(inputPath))
}

async function logTime(name: string, action: () => Promise<void>) {
    const start = Date.now()
    await action()
    const end = Date.now()
    console.log(`${name} took ${end - start}ms`)
}

export async function checkAllEpubsParallel(inputPath: string) {
    const filesGenerator = getAllEpubFiles(inputPath)
    let files: string[] = []
    for await (const file of filesGenerator) {
        files.push(file)
    }
    let promises = files.map(getEpubDiagnostic)
    let results = await Promise.all(promises)
    for (let diags of results) {
        if (diags.length > 0) {
            printDiagnostics(diags)
        }
    }
}

export async function checkAllEpubs(inputPath: string) {
    let diagnostics: Diagnostic[] = []
    const files = getAllEpubFiles(inputPath)
    const problems: string[] = []
    let count = 0
    for await (const file of files) {
        if (++count % 1000 == 0) {
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
    const fileProvider = createFileProvider(fs.promises.readFile(epubFilePath))
    let { diagnostics, value } = await parseEpub(fileProvider)
    if (value) {
        let { diagnostics: validationDiags } = validateEpub(value)
        diagnostics.push(...validationDiags)
    }
    return diagnostics
}

async function getEpubDiagnostic2(epubFilePath: string): Promise<Diagnostic[]> {
    const fileProvider = createFileProvider(fs.promises.readFile(epubFilePath))
    let iterator = openEpub(fileProvider)
    for await (let pkg of iterator.packages()) {
        for (let item of pkg.items()) {
            item.load()
        }
        for (let item of pkg.spine()) {
            item.item
        }
    }
    return iterator.diagnostics()
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