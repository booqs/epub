import { Diagnoser } from './diagnostic'

export type FileProvider<Binary = unknown> = {
    readText(path: string, diags: Diagnoser): Promise<string | undefined>,
    readBinary(path: string, diags: Diagnoser): Promise<Binary | undefined>,
}
