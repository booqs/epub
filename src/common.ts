import { Diagnoser } from './diagnostic'

export type FileProvider = {
    readText(path: string, diags: Diagnoser): Promise<string | undefined>,
    readBinary(path: string, diags: Diagnoser): Promise<unknown | undefined>,
}
