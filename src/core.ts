export type MediaType = string
export type Epub = {
    container: Container,
}
export type Container = {
    rootFiles: RootFile[],
}
export type RootFile = {
    path: string,
    mediaType: MediaType,
}

export type FileProvider = {
    read: (path: string) => AsyncResult<string>,
}

export type Diagnostic = string | {
    message: string,
    data?: any,
}
export type Success<T> = {
    value: T,
    diags: Diagnostic[],
}
export type Failure = {
    value?: undefined,
    diags: Diagnostic[],
}
export type Result<T> = Success<T> | Failure
export type AsyncResult<T> = Promise<Result<T>>