export type Commit = {
    authorEmail: string,
    authorName: string,
    body: string,
    date: Date,
    videoTimestamp: number,
    hash: string,
    message: string,
    refs: string,
    rawCommit: string,
    rawCommitFull: string,
}
