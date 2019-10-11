import * as vscode from 'vscode';
import {getStore} from './store';
import config from './config';
import status from './status';
import * as copyPaste from "clipboardy";

export const authenticationCallback = (token: string, installationId: string) => {
    const store = getStore();
    if (installationId !== store.installationId) {
        vscode.window.showErrorMessage('Error authenticating. Try again or contact support.');
        return;
    }

    store.setAuthToken(token);
    status.stop();
    vscode.window.showInformationMessage('Successfully authenticated');
};

export const login = () => {
    const store = getStore();
    const URL = `${config.websiteHost}/auth/vscode?installationId=${store.installationId}`;

    vscode.window.showInformationMessage(
        `Please open this url in your browser so the extension can connect to your GitDuck account: ${URL}`,
        'Copy URL'
    ).then(() => {
        copyPaste.writeSync(URL);
    });
    vscode.env.openExternal(vscode.Uri.parse(URL));
};

export const logout = () => {
    const store = getStore();
    store.clearAuthToken();
    vscode.window.showInformationMessage('Logged out');
    status.login();
};
