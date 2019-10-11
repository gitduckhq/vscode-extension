import * as vscode from 'vscode';
import * as crypto from 'crypto'

let context: vscode.ExtensionContext;
let store: Store;

// @ts-ignore  https://stackoverflow.com/a/2117523
const uuidV4 = (): string => ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16)
);

const stateKeys = {
    AUTH_TOKEN: 'authToken',
    INSTALLATION_ID: 'installationId',
    CURRENT_USER: 'currentUser',
};

class Store {
    public installationId: string | undefined;
    private currentUser: object | undefined;
    private authToken: string | undefined;
    private snippets: object[] = [];

    public codingSession = null;
    public readStream = null;
    public uploadPromise = null;
    public isRecording = false;
    public viewURL: string | undefined;
    public startTrackingTimestamp: Date;

    constructor(private context: vscode.ExtensionContext) {
        this.loadInitialState();
    }

    loadInitialState() {
        const {globalState} = this.context;
        let installationId = globalState.get(stateKeys.INSTALLATION_ID);
        if (!installationId) {
            installationId = uuidV4();
            globalState.update(stateKeys.INSTALLATION_ID, installationId)
        }

        this.installationId = installationId.toString();
        this.authToken = globalState.get(stateKeys.AUTH_TOKEN);
        this.currentUser = globalState.get(stateKeys.CURRENT_USER);
    }

    setAuthToken(token: string) {
        const {globalState} = this.context;
        globalState.update(stateKeys.AUTH_TOKEN, token);
        this.authToken = token;
    }

    getAuthToken() {
        return this.authToken;
    }

    isAuthenticated() {
        return !!this.authToken;
    }

    clearAuthToken() {
        const {globalState} = this.context;
        globalState.update(stateKeys.AUTH_TOKEN, null);
        this.authToken = undefined;
    }

    setRecordingCodingSession(codingSession: any) {
        this.codingSession = codingSession;
        this.startTrackingTimestamp = new Date();
    }

    addSnippet(snippet: object) {
        this.snippets.push(snippet);
    }

    getSnippets() {
        return this.snippets;
    }

    cleanupCodingSession() {
        this.codingSession = null;
        this.readStream = null;
        this.uploadPromise = null;
        this.isRecording = false;
        this.viewURL = undefined;
        this.startTrackingTimestamp = undefined;
        this.snippets = [];
    }
}

export const initStore = (ctx: any) => context = ctx;

export const getStore = () => {
    if (!context) {
        throw new Error('Store not initialized')
    }

    if (!store) {
        store = new Store(context);
    }

    return store;
};
