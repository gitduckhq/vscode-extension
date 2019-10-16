import * as vscode from 'vscode';
import recorder from './recorder';
import status from './status';
import {createCodingSession, completeSession, addCommits} from './api';
import config from './config';
import {getStore, initStore} from './store';
import {initCodeLinkingListener, getSessionCommits, cleanupCodeLinkingSession} from './code-linking';
import {ExtensionUriHandler} from './uri-handler';
import {login, logout} from './auth';
import {initTreeView} from './tree-view';

export function activate(context: vscode.ExtensionContext) {
    try {
        initStore(context);
        const store = getStore();

        if (store.isAuthenticated()) {
            status.stop();
        } else {
            status.login();
        }
        status.show();
        initTreeView(recorder);

        async function onError() {
            await gdStop().catch(console.error);

            if (recorder) {
                recorder.stop();
            }
            cleanupCodeLinkingSession();
            store.cleanupCodingSession();
            vscode.window.showErrorMessage('Something went wrong and the stream was stopped. If this persists, please contact help@gitduck.com.');
        }

        async function gdRecord() {
            if (!store.isAuthenticated()) {
                return vscode.window.showErrorMessage('Please first login to your GitDuck account.');
            }

            store.isRecording = true;
            status.loading();
            try {
                store.setRecordingCodingSession(await createCodingSession());
                await initCodeLinkingListener();

                console.log('Coding session', store.codingSession);
                await recorder.start({
                    streamKey: store.codingSession.streamKey,
                    onError: onError,
                });

                store.viewURL = `${config.websiteHost}/watch/${store.codingSession._id}`;
                vscode.window.showInformationMessage(
                    `Live coding session created: ${store.viewURL}`,
                    'Copy URL'
                ).then(() => {
                    vscode.env.clipboard.writeText(store.viewURL);
                });

                return status.start();
            } catch (error) {
                vscode.window.showErrorMessage('Something went wrong. If you need help please write to help@gitduck.com.');
                console.error(error);
                store.isRecording = false;
                return status.stop();
            }
        }

        async function gdStop() {
            let localFilePath;
            try {
                await new Promise(resolve => setTimeout(resolve, 125)); // Allows for click to be handled properly
                status.loading();
                localFilePath = await recorder.stop().catch(console.error);
                status.stop();
                status.uploading();
                const completeSessionPromise = completeSession({
                    id: store.codingSession._id,
                });

                const commits = getSessionCommits();
                const snippets = store.getSnippets();
                if (commits.length > 0 || snippets.length > 0) {
                    await addCommits({id: store.codingSession._id, commits, snippets})
                        .catch(error => {
                            console.error(error);
                            vscode.window.showErrorMessage('Error uploading your commits');
                        })
                }

                const {viewURL} = store;

                cleanupCodeLinkingSession();
                store.cleanupCodingSession();
                await completeSessionPromise;


                vscode.window.showInformationMessage(
                    `Uploading coding session to ${viewURL}`,
                    'Copy URL'
                ).then(() => {
                    vscode.env.clipboard.writeText(viewURL);
                });

                status.stop();
            } catch (error) {
                vscode.window.showErrorMessage('Something went wrong while uploading your stream. You can contact us at help@gitduck.com');
                console.error(error);
                console.error('File should be at', localFilePath);
            }
            store.isRecording = false;
            status.stop();
        }

        async function uploadSnippet() {
            if (!store.isAuthenticated()) {
                return vscode.window.showErrorMessage('Please first login to your GitDuck account.');
            }

            if (!store.isRecording) {
                await gdRecord();
            }

            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                return vscode.window.showErrorMessage('There is no selected text');
            }

            const selection = editor.selection;
            const relativePath = vscode.workspace.asRelativePath(editor.document.fileName, true);
            const selectedText = editor.document.getText(selection);

            if (!selectedText) {
                return vscode.window.showErrorMessage('There is no selected text');
            }

            const now = new Date();

            const snippet = {
                code: selectedText,
                fromLine: selection.start.line + 1,
                toLine: selection.end.line + 1,
                path: relativePath,
                timestamp: now,
                videoTimestamp: Math.floor((Number(now) - store.startTrackingTimestamp.getTime()) / 1000),
            };

            store.addSnippet(snippet);
        }

        const registerCommand = (id: string, cb: (...args: any) => any) => context.subscriptions.push(
            vscode.commands.registerCommand(id, cb)
        );

        registerCommand('gitduck.record', gdRecord);
        registerCommand('gitduck.stop', gdStop);
        registerCommand('gitduck.login', login);
        registerCommand('gitduck.logout', logout);
        registerCommand('gitduck.uploadSnippet', uploadSnippet);

        context.subscriptions.push(status, vscode.window.registerUriHandler(new ExtensionUriHandler()));
    } catch (e) {
        console.error('Error starting GitDuck...', e);
        vscode.window.showErrorMessage('Something went wrong initializing GitDuck');
    }
}

export function deactivate() {
    console.log('Deactivating extension....');
    if (recorder) {
        return recorder.stop().catch(console.error);
    }
}
