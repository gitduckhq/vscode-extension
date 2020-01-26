import * as WebSocket from 'ws'
import config from './config'
import {getStore} from './store'

let wsConnection;
let pingTimeout;

const heartbeat = () => {
    console.debug('WS heartbeat');
    clearTimeout(pingTimeout);

    const timeLimit = (30 + 1) * 1000;
    pingTimeout = setTimeout(() => {
        console.debug('Terminating WS connection because failed the heartbeat');
        return disconnect()
    }, timeLimit)
};

enum WsReadyStatus {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
}

function connectIfLoggedIn() {
    const store = getStore();
    if (store.isAuthenticated()) {
        onUserLoggedIn().catch(console.error);
    }
}


export function init() {
    console.debug('Initiating WS library');
    const store = getStore();

    store.onUserLoggedIn(onUserLoggedIn);
    store.onUserLoggedOut(onUserLoggedOut);

    connectIfLoggedIn()
}

async function onUserLoggedIn() {
    const authToken = getStore().getAuthToken();
    console.debug('Authenticating WS server');
    await authenticate(authToken);
    console.debug('WS server authentication ok');

    await send({type: 'subscribe_created_or_stopped_sessions'});
    const ws = await getConnection();

    ws.on('close', async () => {
        if (wsConnection && wsConnection.off) {
            wsConnection.off()
        }
        setTimeout(connectIfLoggedIn, 1000)
    });

    ws.on('message', msg => {
        const {type, codingSessionId, createdDateTime} = JSON.parse(msg);

        if (type === 'coding_session_created') {
            getStore().emitStartedCodingSession(codingSessionId, createdDateTime && new Date(createdDateTime))
        } else if (type === 'coding_session_ended') {
            getStore().emitEndedCodingSession(codingSessionId)
        }
    })
}

async function onUserLoggedOut() {
    await disconnect();
}


export async function send(msg) {
    console.debug('Sending WS msg', JSON.stringify(msg));
    const ws = await getConnection();
    ws.send(JSON.stringify(msg))
}

export async function disconnect() {
    if (wsConnection && wsConnection.readyStatus === WsReadyStatus.CLOSED) {
        wsConnection.off();
        wsConnection = null;
        return;
    }

    wsConnection.off();
    wsConnection.terminate();
    wsConnection = null;
}

export async function getConnection() {
    try {
        // if no wsConnection or wsConnection is CLOSING or CLOSED create new Connection
        if (!wsConnection || [WsReadyStatus.CLOSING, WsReadyStatus.CLOSED].includes(wsConnection.readyState)) {
            wsConnection = new WebSocket(config.apiHost.replace('http', 'ws') + '/websocket');

            wsConnection.on('open', heartbeat);
            wsConnection.on('ping', heartbeat);
            wsConnection.on('close', () => clearTimeout(pingTimeout));

            return await new Promise((resolve, reject) => {
                wsConnection.on('open', function onOpen() {
                    wsConnection.off('open', onOpen);
                    resolve(wsConnection);
                });
                wsConnection.on('error', function onError(error) {
                    wsConnection.off('error', onError);
                    reject(error)
                })
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
    } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000 + (1000 * Math.random())));
        console.error('Error getting connection, retrying', error);
        return getConnection();
    }
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
                return reject('Error authenticating over web sockets')
            }
        })
    })
}

