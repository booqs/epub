# booqs-epub

A lightweight TypeScript library for parsing EPUB files with minimal dependencies.

## Motivation

The goal of this library is to provide very lightweight utilities for processing EPUB files. It focuses on parsing and extracting metadata, structure, and content from EPUB files while keeping the footprint small.

**What's included:**
- EPUB structure parsing (manifest, spine, metadata)
- Navigation and table of contents extraction  
- Content loading utilities
- TypeScript definitions for EPUB-compliant file structures

**What's out of scope:**
- EPUB validation (though type definitions help catch structural issues)
- ZIP file handling (library is agnostic to ZIP implementation)

## API Overview

The library provides two main functions:

### `openEpub<Binary>(fileProvider, diags?)`

Returns a lazy-loading EPUB reader that loads content on-demand. Use this when you want to:
- Parse large EPUB files efficiently
- Load only specific parts of the EPUB
- Stream content as needed

### `loadEpub<Binary>(fileProvider, diags?)`

Loads the entire EPUB structure upfront and returns all content. Use this when you want to:
- Load smaller EPUB files completely
- Have immediate access to all manifest items and spine content
- Work with the full EPUB data structure

## Installation

```bash
npm install booqs-epub
```

## Usage

### Basic Example with JSZip

```typescript
import JSZip from 'jszip'
import fs from 'fs'
import { openEpub, loadEpub, FileProvider } from 'booqs-epub'

function createFileProvider(fileContent: Promise<Buffer>): FileProvider {
    const zip = JSZip.loadAsync(fileContent)
    return {
        async readText(path, diags) {
            try {
                const file = (await zip).file(path)
                if (!file) return undefined
                return file.async('text')
            } catch (e) {
                diags?.push(`Error reading text ${path}: ${e}`)
                return undefined
            }
        },
        async readBinary(path, diags) {
            try {
                const file = (await zip).file(path)
                if (!file) return undefined
                return file.async('nodebuffer')
            } catch (e) {
                diags?.push(`Error reading binary ${path}: ${e}`)
                return undefined
            }
        }
    }
}

// Lazy loading approach
async function parseEpubLazy(filePath: string) {
    const fileProvider = createFileProvider(fs.promises.readFile(filePath))
    const epub = openEpub(fileProvider)
    
    // Load content on-demand
    const metadata = await epub.metadata()
    const toc = await epub.toc()
    const spine = await epub.spine()
    
    console.log('Title:', metadata?.title)
    console.log('Spine items:', spine.length)
}

// Eager loading approach
async function parseEpubEager(filePath: string) {
    const fileProvider = createFileProvider(fs.promises.readFile(filePath))
    const epub = await loadEpub(fileProvider)
    
    if (!epub) {
        console.error('Failed to load EPUB')
        return
    }
    
    // All content is immediately available
    console.log('Title:', epub.metadata?.title)
    console.log('Spine items:', epub.spine.length)
    console.log('Manifest items:', epub.manifest.length)
}
```

### Working with Content

```typescript
// Using openEpub for on-demand loading
const epub = openEpub(fileProvider)

// Load a specific spine item
const spine = await epub.spine()
const firstChapter = spine[0]
const chapterContent = await epub.loadItem(firstChapter.manifestItem)

// Load a file by href
const textContent = await epub.loadTextFile('chapter1.xhtml')
const imageData = await epub.loadBinaryFile('images/cover.jpg')

// Get table of contents
const toc = await epub.toc()
toc?.entries.forEach(entry => {
    console.log(entry.title, entry.href)
})
```

### Error Handling and Diagnostics

```typescript
const diagnostics: Diagnoser = []
const epub = openEpub(fileProvider, diagnostics)

const metadata = await epub.metadata()

// Check for any issues during parsing
if (diagnostics.length > 0) {
    diagnostics.forEach(diag => {
        if (typeof diag === 'string') {
            console.warn(diag)
        } else {
            console.warn(diag.message, diag.severity)
        }
    })
}
```

## Integration with Popular ZIP Libraries

### node-stream-zip

```typescript
import StreamZip from 'node-stream-zip'
import { FileProvider } from 'booqs-epub'

function createStreamZipProvider(filePath: string): FileProvider<Buffer> {
    return {
        async readText(path, diags) {
            try {
                const zip = new StreamZip.async({ file: filePath })
                const content = await zip.entryData(path)
                await zip.close()
                return content.toString('utf8')
            } catch (e) {
                diags?.push(`Error reading ${path}: ${e}`)
                return undefined
            }
        },
        async readBinary(path, diags) {
            try {
                const zip = new StreamZip.async({ file: filePath })
                const content = await zip.entryData(path)
                await zip.close()
                return content
            } catch (e) {
                diags?.push(`Error reading ${path}: ${e}`)
                return undefined
            }
        }
    }
}
```

### yauzl

```typescript
import yauzl from 'yauzl'
import { FileProvider } from 'booqs-epub'

function createYauzlProvider(filePath: string): FileProvider<Buffer> {
    return {
        async readText(path, diags) {
            return new Promise((resolve) => {
                yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
                    if (err || !zipfile) {
                        diags?.push(`Error opening zip: ${err}`)
                        resolve(undefined)
                        return
                    }
                    
                    zipfile.readEntry()
                    zipfile.on('entry', (entry) => {
                        if (entry.fileName === path) {
                            zipfile.openReadStream(entry, (err, readStream) => {
                                if (err || !readStream) {
                                    diags?.push(`Error reading ${path}: ${err}`)
                                    resolve(undefined)
                                    return
                                }
                                
                                const chunks: Buffer[] = []
                                readStream.on('data', chunk => chunks.push(chunk))
                                readStream.on('end', () => {
                                    resolve(Buffer.concat(chunks).toString('utf8'))
                                })
                            })
                        } else {
                            zipfile.readEntry()
                        }
                    })
                })
            })
        },
        // Similar implementation for readBinary...
    }
}
```

## TypeScript Support

The library provides comprehensive TypeScript definitions for EPUB structures:

```typescript
import { EpubMetadata, ManifestItem, SpineItem, Navigation } from 'booqs-epub'

// All types are available for type-safe EPUB processing
const processMetadata = (metadata: EpubMetadata) => {
    console.log(metadata.title, metadata.creator)
}
```

## API Reference

### Core Functions

- `openEpub<Binary>(fileProvider, diags?)` - Create lazy-loading EPUB reader
- `loadEpub<Binary>(fileProvider, diags?)` - Load complete EPUB structure

### Types

- `FileProvider<Binary>` - Interface for reading files from ZIP
- `Diagnoser` - Array for collecting parsing diagnostics
- `EpubLoader<Binary>` - Return type of openEpub
- `LoadedEpub<Binary>` - Return type of loadEpub

### EPUB Structure Types

- `EpubMetadata` - EPUB metadata (title, creator, etc.)
- `ManifestItem` - Individual file in EPUB manifest
- `SpineItem` - Reading order item
- `Navigation` - Table of contents entry

## License

ISC