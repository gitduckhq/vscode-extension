import * as vscode from 'vscode';
import * as crypto from 'crypto'
import {pingHealthCheck} from './api';
import * as EventEmitter from 'events';
import Timeout = NodeJS.Timeout;

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
    MY_ORGANIZATIONS: 'myOrganizations',
    SELECTED_ORGANIZATION_ID: 'selectedOrganizationId',
};

class Store {
    public installationId: string | undefined;
    private currentUser: object | undefined;
    private authToken: string | undefined;
    private snippets: object[] = [];
    private healthCheckSessionInterval: Timeout;
    private myOrganizations;
    private selectedOrganizationId;
    private eventEmitter: EventEmitter;

    public codingSession = null;
    public readStream = null;
    public uploadPromise = null;
    public isRecording = false;
    public viewURL: string | undefined;
    public startTrackingTimestamp: Date;
    public events = {
        ORGANIZATIONS_CHANGED: 'ORGANIZATIONS_CHANGED',
        USER_LOGGED_IN: 'USER_LOGGED_IN',
        USER_LOGGED_OUT: 'USER_LOGGED_OUT',
        CODING_SESSION_STARTED: 'CODING_SESSION_STARTED',
        CODING_SESSION_ENDED: 'CODING_SESSION_ENDED',
    };

    constructor(private context: vscode.ExtensionContext) {
        this.loadInitialState();
        this.eventEmitter = new EventEmitter();
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
        this.myOrganizations = globalState.get(stateKeys.MY_ORGANIZATIONS);
        this.selectedOrganizationId = globalState.get(stateKeys.SELECTED_ORGANIZATION_ID);
    }

    onOrganizationsChanged(callback) {
        this.eventEmitter.on(this.events.ORGANIZATIONS_CHANGED, callback)
    }

    onUserLoggedIn(callback) {
        this.eventEmitter.on(this.events.USER_LOGGED_IN, callback)
    }

    onUserLoggedOut(callback) {
        this.eventEmitter.on(this.events.USER_LOGGED_OUT, callback)
    }

    emitStartedCodingSession(codingSessionId, createdDateTime) {
        this.eventEmitter.emit(this.events.CODING_SESSION_STARTED, codingSessionId, createdDateTime)
    }

    emitEndedCodingSession(codingSessionId) {
        this.eventEmitter.emit(this.events.CODING_SESSION_ENDED, codingSessionId)
    }

    onCodingSessionStarted(callback) {
        this.eventEmitter.on(this.events.CODING_SESSION_STARTED, callback)
    }

    onCodingSessionEnded(callback) {
        this.eventEmitter.on(this.events.CODING_SESSION_ENDED, callback)
    }

    setAuthToken(token: string) {
        const {globalState} = this.context;
        globalState.update(stateKeys.AUTH_TOKEN, token);
        this.authToken = token;
        this.eventEmitter.emit(this.events.USER_LOGGED_IN);
    }

    getMyOrganizations() {
        return this.myOrganizations;
    }

    setMyOrganizations(organizations) {
        const {globalState} = this.context;
        globalState.update(stateKeys.MY_ORGANIZATIONS, organizations);
        this.myOrganizations = organizations;
        this.eventEmitter.emit(this.events.ORGANIZATIONS_CHANGED, organizations)
    }

    setSelectedOrganizationId(organizationId) {
        const {globalState} = this.context;
        globalState.update(stateKeys.SELECTED_ORGANIZATION_ID, organizationId);
        this.selectedOrganizationId = organizationId;
    }

    getSelectedOrganizationId() {
        return this.selectedOrganizationId;
    }

    getAuthToken() {
        return this.authToken;
    }

    isAuthenticated() {
        return !!this.authToken;
    }

    logout() {
        this.clearAuthToken();
        this.setMyOrganizations(null);
        this.setSelectedOrganizationId(null);
        this.eventEmitter.emit(this.events.USER_LOGGED_OUT);
    }

    clearAuthToken() {
        const {globalState} = this.context;
        globalState.update(stateKeys.AUTH_TOKEN, null);
        this.authToken = undefined;
    }

    setRecordingCodingSession(codingSession: any) {
        this.codingSession = codingSession;
        this.startTrackingTimestamp = new Date();
        if (codingSession.healthCheckURL) {
            this.healthCheckSessionInterval = setInterval(() => {
                pingHealthCheck(codingSession.healthCheckURL)
                    .catch((e) => console.error('Error pinging health check', codingSession, e))
            }, 6000);
        }
    }

    addSnippet(snippet: object) {
        this.snippets.push(snippet);
    }

    getSnippets() {
        return this.snippets;
    }

    cleanupCodingSession() {
        clearInterval(this.healthCheckSessionInterval);
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
