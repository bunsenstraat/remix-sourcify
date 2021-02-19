export type Source = {
    path: string,
    name: string,
    content: string
}

export type FetchResult = {
    metadata: any,
    sources: Source[]
}

export type FetchData = {
    address: string,
    network: string | number,
}

export type VerificationResult = [{
    address: string,
    status: string,
    message: string
}]

export type VerifyData = {
    address: string,
    chain: string | number,
    files: Record<string, any>
}
