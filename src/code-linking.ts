import * as vscode from "vscode";
import {FileSystemWatcher, FileType, Uri, workspace} from 'vscode';
import * as fs from 'fs';
import * as nodePath from 'path';
import * as nodeUtil from 'util';
import * as simpleGit from 'simple-git/promise';
import {ListLogSummary} from 'simple-git/typings/response';
import {Commit} from './types';
import {getStore} from './store';

let gitFileListeners: { [path: string]: FileSystemWatcher } = {};
let commitsInSession: { [hash: string]: Commit } = {};
let gdRepoPath: string = '';
let onDidChangeWorkspaceFoldersEmitters: vscode.Disposable;

async function gitExec({gitRepo, args = [], useGDRepo = false}: { gitRepo: string, args: string[], useGDRepo?: boolean }) {
    const git = simpleGit(gitRepo);
    if (useGDRepo) {
        git.env('GIT_DIR', gdRepoPath);
        git.env('GIT_WORK_TREE', gitRepo);
    }
    return git.raw(args);
}

async function getGitRootPath(path: string) {
    //@ts-ignore
    const stats = await workspace.fs.stat(Uri.file(path));

    if (stats.type !== FileType.Directory) {
        const newPath = path.split('/');
        newPath.pop();
        path = newPath.join('/');
    }

    return gitExec({
        gitRepo: path,
        args: [
            'rev-parse',
            '--show-toplevel'
        ]
    }).then(res => res && res.trim());
}

async function gitLog({gitRepo, args = [], useGDRepo = false}: { gitRepo: string, args?: string[], useGDRepo?: boolean }): Promise<ListLogSummary> {
    const git = simpleGit(gitRepo);
    if (useGDRepo) {
        git.env('GIT_DIR', gdRepoPath);
        git.env('GIT_WORK_TREE', gitRepo);
    }
    return git.log(args);
}

async function gitShow({gitRepo, commitHash}: { gitRepo: string, commitHash: string }) {
    return simpleGit(gitRepo)
        .show([commitHash]);
}

async function diffCommit({gitRepo, commitHash, full = false}: { gitRepo: string, commitHash: string, full?: boolean }) {
    return simpleGit(gitRepo)
        .diff([
            `${commitHash}^!`,
            ...(full ? ['-U5000'] : [])
        ]);
}

async function getCommitsDuringSession(gitRepo: string) {
    const args = [
        '--branches',
        '--not',
        '--remotes',
        '--date=iso',
    ];

    const {startTrackingTimestamp} = getStore();
    if (startTrackingTimestamp) {
        args.push(`--since="${startTrackingTimestamp.toISOString()}"`);
    }

    return gitLog({
        gitRepo,
        args,
    });
}

async function watchGitCommits() {
    console.log('Discovering and watching .git folders');
    const {workspaceFolders} = vscode.workspace;

    if (!workspaceFolders) {
        return;
    }

    const results = (await Promise.all(
        workspaceFolders.map(async workspaceFolder => {
            const workspacePath = workspaceFolder.uri.path;
            const rootRepoPath = await getGitRootPath(workspacePath);
            const gitPath = nodePath.join(rootRepoPath, '.git', 'logs/HEAD');

            if (gitFileListeners[gitPath]) {
                console.log('Git path', gitPath, 'already tracked.');
                return;
            }

            const accessFile = nodeUtil.promisify(fs.access);
            await accessFile(gitPath, fs.constants.R_OK);

            console.log('Tracking ', gitPath);

            gitFileListeners[gitPath] = vscode.workspace.createFileSystemWatcher(
                gitPath, false, false, false
            );

            const watcher = gitFileListeners[gitPath];

            watcher.onDidChange(async e => {
                const commitsDone = await getCommitsDuringSession(workspacePath);

                await Promise.all(
                    commitsDone.all.map(async commit => {
                        if (!commitsInSession[commit.hash]) {
                            console.log(`Captured commit ${commit.hash}`);
                            const gitRepo = workspacePath;
                            const commitHash = commit.hash;
                            const rawCommitFull = diffCommit({gitRepo, commitHash, full: true});
                            const rawCommit = diffCommit({gitRepo, commitHash});

                            commitsInSession[commit.hash] = {
                                authorEmail: commit.author_email,
                                authorName: commit.author_name,
                                body: commit.body,
                                date: new Date(commit.date),
                                videoTimestamp: Math.floor((Date.now() - getStore().startTrackingTimestamp.getTime()) / 1000),
                                hash: commit.hash,
                                message: commit.message,
                                refs: commit.refs,
                                rawCommit: await rawCommit,
                                rawCommitFull: await rawCommitFull,
                            };
                        }
                    }).map(p => p.catch(console.error))
                );

                console.log('Commits done in this session so far', commitsInSession);
            });
        })
            .map(p => p.catch(e => e))
    )).filter(p => {
        if (p instanceof Error) {
            console.error(p);
            return false;
        }

        return true;
    });
}

function cleanWatchers() {
    Object.entries(gitFileListeners).forEach(([key, watcher]) => {
        console.log('Removing listener for ', key);
        watcher.dispose();
    });
}

async function initCodeLinkingListener() {
    gitFileListeners = {};
    commitsInSession = {};

    watchGitCommits().catch(console.error);
    onDidChangeWorkspaceFoldersEmitters = vscode.workspace.onDidChangeWorkspaceFolders(watchGitCommits);
}

function getSessionCommits(): Array<Commit> {
    return Object.values(commitsInSession);
}

function cleanupCodeLinkingSession() {
    console.log('Cleaning up code-linking session');
    cleanWatchers();
    commitsInSession = {};
    gitFileListeners = {};
    if (onDidChangeWorkspaceFoldersEmitters) {
        onDidChangeWorkspaceFoldersEmitters.dispose();
    }

    console.log('Cleaned up code-linking session');

}

export {
    initCodeLinkingListener,
    getSessionCommits,
    cleanupCodeLinkingSession,
};


