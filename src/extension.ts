import * as vscode from 'vscode';
import status from './status';
import {addCommits} from './api';
import config from './config';
import {getStore, initStore} from './store';
import {initCodeLinkingListener, getSessionCommits, cleanupCodeLinkingSession} from './code-linking';
import {ExtensionUriHandler} from './uri-handler';
import {login, logout} from './auth';
import {init as initWebSocket} from './websocket';

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
        store.onCodingSessionStarted(onCodingSessionStart);
        store.onCodingSessionEnded(onCodingSessionEnd);
        initWebSocket();

        async function onCodingSessionStart(codingSessionId, createdDateTime) {
            store.isRecording = true;
            status.loading();
            try {
                // store.setRecordingCodingSession(newCodingSession);
                await initCodeLinkingListener();
                store.startTrackingTimestamp = createdDateTime ? new Date(createdDateTime) : new Date();

                store.viewURL = `${config.websiteHost}/watch/${codingSessionId}`;
                vscode.window.showInformationMessage(
                    `Watching commits for ${store.viewURL}`,
                    'Copy URL'
                ).then(() => {
                    vscode.env.clipboard.writeText(store.viewURL);
                });

                status.start(createdDateTime);
            } catch (error) {
                vscode.window.showErrorMessage('Something went wrong. If you need help please write to help@gitduck.com.');
                console.error(error);
                store.isRecording = false;
                return status.stop();
            }
        }

        async function onCodingSessionEnd(codingSessionId) {
            try {
                status.uploading();

                const commits = getSessionCommits();
                console.log('commmits', commits);
                const snippets = store.getSnippets();
                console.log('snippets', snippets);
                if (commits.length > 0 || snippets.length > 0) {
                    await addCommits({id: codingSessionId, commits, snippets})
                        .catch(error => {
                            console.error(error);
                            vscode.window.showErrorMessage('Error uploading your commits');
                        })
                }

                const {viewURL} = store;

                cleanupCodeLinkingSession();
                store.cleanupCodingSession();

                vscode.window.showInformationMessage(
                    `Uploading commits to ${viewURL}`,
                    'Copy URL'
                ).then(() => {
                    vscode.env.clipboard.writeText(viewURL);
                });
            } catch (error) {
                vscode.window.showErrorMessage('Something went wrong while uploading your code. You can contact us at help@gitduck.com');
                console.error(error);
            }
            store.isRecording = false;
            status.stop();
        }

        async function uploadSnippet() {
            if (!store.isAuthenticated()) {
                return vscode.window.showErrorMessage('Please first login to your GitDuck account.');
            }

            if (!store.isRecording) {
                return vscode.window.showErrorMessage('Please start a coding session from https://gitduck.com');
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

        function newStream() {
            vscode.env.openExternal(vscode.Uri.parse(`${config.websiteHost}/new-video`))
        }

        function stopStream() {
            const {viewURL} = getStore();
            vscode.window.showInformationMessage(`You can stop this video from your browser.`)
        }

        const registerCommand = (id: string, cb: (...args: any) => any) => context.subscriptions.push(
            vscode.commands.registerCommand(id, cb)
        );

        registerCommand('gitduck.login', login);
        registerCommand('gitduck.logout', logout);
        registerCommand('gitduck.uploadSnippet', uploadSnippet);
        registerCommand('gitduck.newStream', newStream);
        registerCommand('gitduck.stopStream', stopStream);

        context.subscriptions.push(status, vscode.window.registerUriHandler(new ExtensionUriHandler()));
    } catch (e) {
        console.error('Error starting GitDuck...', e);
        vscode.window.showErrorMessage('Something went wrong initializing GitDuck');
    }
}

export function deactivate() {
    console.log('Deactivating extension....');
}
