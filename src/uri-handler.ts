import * as vscode from 'vscode';
import {authenticationCallback} from './auth';

export class ExtensionUriHandler implements vscode.UriHandler {
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
        const { path, query } = uri;
        const parsed = this.parseQuery(query);

        if (path === '/auth/callback') {
            const { token, installationId } = parsed;
            authenticationCallback(token, installationId);
        }
    }

    parseQuery(queryString: string): any {
        // https://stackoverflow.com/a/13419367
        const filtered =
            queryString[0] === '?' ? queryString.substr(1) : queryString;
        const pairs = filtered.split('&');
        const query: { [key: string]: string } = {};

        for (let i = 0; i < pairs.length; i++) {
            let pair = pairs[i].split('=');
            const key: string = decodeURIComponent(pair[0]);
            query[key] = decodeURIComponent(pair[1] || '');
        }

        return query;
    }
}
