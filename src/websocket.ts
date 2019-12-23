import * as WebSocket from 'ws'
import config from './config'
import {getStore} from './store'


/*
TODO: Handle reconnection
TODO: Handle health-check
*/

let wsConnection;

enum WsReadyStatus {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
}


export function init() {
    const store = getStore();

    store.onUserLoggedIn(onUserLoggedIn);
    store.onUserLoggedOut(onUserLoggedOut);

    if (store.isAuthenticated()) {
        onUserLoggedIn().catch(console.error);
    }
}

async function onUserLoggedIn() {
    const authToken = getStore().getAuthToken();
    await authenticate(authToken);

    await send({type: 'subscribe_created_or_stopped_sessions'});
    const ws = await getConnection();

    ws.on('message', msg => {
        const {type, codingSessionId, createdDateTime} = JSON.parse(msg);

        if (type === 'coding_session_created') {
            getStore().emitStartedCodingSession(codingSessionId, createdDateTime)
        } else if (type === 'coding_session_ended') {
            getStore().emitEndedCodingSession(codingSessionId)
        }
    })
}

async function onUserLoggedOut() {
    await disconnect();
}


export async function send(msg) {
    const ws = await getConnection();
    ws.send(JSON.stringify(msg))
}

export async function disconnect() {
    if (wsConnection && wsConnection.readyStatus === WsReadyStatus.CLOSED) {
        wsConnection = null;
        return;
    }

    wsConnection.terminate();
    wsConnection = null;
}

export async function getConnection() {
    // TODO: Check if host is down or can't open connection

    // if no wsConnection or wsConnection is CLOSING or CLOSED create new Connection
    if (!wsConnection || [WsReadyStatus.CLOSING, WsReadyStatus.CLOSED].includes(wsConnection.readyState)) {
        wsConnection = new WebSocket(config.apiHost.replace('http', 'ws') + '/websocket');
        return new Promise(resolve => {
            wsConnection.on('open', function onOpen() {
                wsConnection.off('open', onOpen);
                resolve(wsConnection);
            });
        })
    }

    if (wsConnection.readyState === WsReadyStatus.CONNECTING) {
        return new Promise(resolve => {
            wsConnection.on('open', function onOpen() {
                wsConnection.off('open', onOpen);
                resolve(wsConnection);
            });
        })
    }

    return wsConnection;
}

export async function authenticate(token) {
    return new Promise(async (resolve, reject) => {
        const ws = await getConnection();
        await send({type: 'authenticate', authToken: token});
        ws.on('message', function onMsg(msg) {
            const {type} = JSON.parse(msg);
            if (type === 'authentication_ok') {
                ws.off('message', onMsg);
                return resolve()
            } else if (type === 'error') {
                ws.off('message', onMsg);
                return reject()
            }
        })
    })
}

