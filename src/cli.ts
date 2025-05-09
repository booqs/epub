import fs from 'fs'
import path from 'path'
import { FullEpub, parseEpub, Unvalidated } from './index'
import util, { inspect } from 'util'
import { Diagnostic, diagnoser } from './diagnostic'
import { validateEpub } from './validate'
import { openEpub } from './open'
import { createFileProvider } from './mock'

main()
function main() {
    const options = parseArgv(process.argv)
    if (options.parallel) {
        logTime('checkAllEpubsParallel', () => checkAllEpubsParallel(options))
    } else {
        logTime('checkAllEpubs', () => checkAllEpubs(options))
    }
}

type Options = {
    inputPath?: string,
    show?: string[],
    stopOnError?: boolean,
    parallel?: boolean,
}
function parseArgv(args: string[]) {
    const options: Options = {}
    const [_, __, ...rest] = args
    for (const arg of rest) {
        if (arg === '--quick-fail') {
            options.stopOnError = true
        } else if (arg === '--parallel') {
            options.parallel = true
        } else if (arg.startsWith('--')) {
            if (options.show === undefined) {
                options.show = []
            }
            options.show.push(arg.substring('--'.length))
        } else {
            options.inputPath = arg
        }
    }
    return options
}

async function logTime(name: string, action: () => Promise<void>) {
    const start = Date.now()
    await action()
    const end = Date.now()
    console.log(`${name} took ${end - start}ms`)
}

export async function checkAllEpubsParallel(options: Options) {
    const filesGenerator = getAllEpubFiles(options.inputPath ?? './epubs')
    let files: string[] = []
    for await (const file of filesGenerator) {
        files.push(file)
    }
    try {
        let count = 0
        const problems: string[] = []
        let promises = files
            .map(processEpub)
            .map(p => p.then(({ diags, epub, epubFilePath }) => {
                if ((++count % 1000) === 0) {
                    console.log(`Checked ${count} files`)
                    if (problems.length > 0) {
                        console.log(`Total problems: ${problems.length}`)
                    }
                }
                if (options.show || diags.length > 0) {
                    console.log(`File: ${epubFilePath}::::::::::`)
                }
                if (diags.length > 0) {
                    problems.push(epubFilePath)
                    printDiagnostics(diags)
                    if (options.stopOnError) {
                        throw new Error('exit')
                    }
                }
                if (options.show) {
                    for (let packages of epub?.packages ?? []) {
                        for (let pkg of packages.document?.package ?? []) {
                            for (let show of options.show) {
                                console.log(`${show}::::::::::`)
                                console.log(inspect((pkg as any)[show], false, null, true))
                            }
                        }
                    }
                }
            }))
        await Promise.all(promises)
        if (problems.length > 0) {
            console.log('Problems::::::::::')
            console.log(problems.join('\n'))
        }
    } catch {
        return
    }
}

export async function checkAllEpubs(options: Options) {
    let diagnostics: Diagnostic[] = []
    const files = getAllEpubFiles(options.inputPath ?? './epubs')
    const problems: string[] = []
    let count = 0
    for await (const file of files) {
        if ((++count % 1000) === 0) {
            console.log(`Checked ${count} files`)
            if (problems.length > 0) {
                console.log(`Total problems: ${problems.length}`)
            }
        }
        const { diags, epub } = await processEpub(file)
        diagnostics.push(...diags)
        if (options.show || diags.length > 0) {
            console.log(`File: ${file}::::::::::`)
        }

        if (diags.length > 0) {
            problems.push(file)
            printDiagnostics(diags)
            if (options.stopOnError) {
                return
            }
        }
        if (options.show) {
            for (let packages of epub?.packages ?? []) {
                for (let pkg of packages.document?.package ?? []) {
                    for (let show of options.show) {
                        console.log(`${show}::::::::::`)
                        console.log(inspect((pkg as any)[show], false, null, true))
                    }
                }
            }
        }
    }
    if (problems.length > 0) {
        console.log('Problems::::::::::')
        console.log(problems.join('\n'))
    }
}

function printDiagnostics(diagnostics: Diagnostic[]) {
    console.log(util.inspect(diagnostics, false, null, true))
}

async function processEpub(epubFilePath: string): Promise<{
    epubFilePath: string,
    epub: Unvalidated<FullEpub> | undefined,
    diags: Diagnostic[],
}> {
    const fileProvider = createFileProvider(fs.promises.readFile(epubFilePath))
    let diags = diagnoser(epubFilePath)
    let value = await parseEpub(fileProvider, diags)
    if (value) {
        validateEpub(value, diags)
    }
    return {
        epubFilePath,
        epub: value,
        diags: diags.all(),
    }
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