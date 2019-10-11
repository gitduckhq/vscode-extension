import * as vscode from 'vscode';
import {VideoAudioInputSettingsTreeProvider} from './videoAudioInputSettings'
import {IRecorder, InputDevice} from '../types';

export function initTreeView(recorder: IRecorder) {
    const setInputDevice = (device: InputDevice) => {
        if (!device) {
            return console.error('Trying to set a', device, 'device');
        }
        inputViewProvider.setInputDevice(device);
        recorder.setInputDevice(device);
    };
    vscode.commands.registerCommand(
        'gitduck.setInputDevice',
        (device) => {
            if (recorder.isRecording()) {
                return vscode.window.showErrorMessage('You can\'t change input settings while recording.')
            }
            setInputDevice(device);
        }
    );
    vscode.commands.registerCommand(
        'gitduck.refreshInputDevices',
        () => inputViewProvider.refresh()
    );

    const inputViewProvider = new VideoAudioInputSettingsTreeProvider(recorder);
    recorder.getDevices().then(devices => {
        setInputDevice(devices.screen[0]);
        setInputDevice(devices.microphone[0]);
    });
    vscode.window.registerTreeDataProvider('inputSettings', inputViewProvider);

}
