import { mkdir as nodeMkdir, rename as nodeRename, writeFile as nodeWriteFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { MediaIndex } from '../drive/types.js'

type WriteIndexDependencies = {
  mkdir?: (path: string, options: { recursive: true }) => Promise<unknown>
  writeFile?: (path: string, contents: string, encoding: 'utf8') => Promise<unknown> | unknown
  rename?: (from: string, to: string) => Promise<unknown> | unknown
}

export async function writeIndex(outputPath: string, index: MediaIndex, dependencies: WriteIndexDependencies = {}): Promise<void> {
  const mkdir = dependencies.mkdir ?? nodeMkdir
  const writeFile = dependencies.writeFile ?? nodeWriteFile
  const rename = dependencies.rename ?? nodeRename
  const tempPath = `${outputPath}.tmp`

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  await rename(tempPath, outputPath)
}
