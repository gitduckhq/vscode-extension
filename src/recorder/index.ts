import * as os from 'os';
import * as vscode from "vscode";
import MacOSRecorder from './macos';
import WindowsRecorder from './windows'
import {IRecorder} from '../types';
// import LinuxRecorder from './linux'

enum OS {OSX, macOS, Linux, Windows}

function getCurrentOS() : OS | null {
    const platform = os.platform();
    const release = os.release();

    if (platform === 'darwin') {
        return release
            ? (Number(release.split('.')[0]) > 15 ? OS.macOS : OS.OSX)
            : OS.macOS;
    } else if (platform === 'linux') {
        return OS.Linux;
    } else if (platform === 'win32') {
        return OS.Windows;
    }

    return null;
}


function createRecorder() : IRecorder{
    const currentOS = getCurrentOS();


    if (currentOS === OS.Linux) {
        const errorMsg = 'Linux support is coming soon. Stay tuned at help@gitduck.com';
        vscode.window.showErrorMessage(errorMsg);
        throw new Error(errorMsg);
        // recorder = new LinuxRecorder();
    }

    if (currentOS === OS.macOS || currentOS === OS.OSX) {
        return new MacOSRecorder();
    }

    if (OS.Windows) {
        return new WindowsRecorder();
    }

    throw new Error(`Unsupported OS: ${os.platform()} ${os.release()}`);
}

const recorder = createRecorder();

export default recorder;
