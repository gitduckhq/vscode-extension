import * as vscode from 'vscode';
import {VideoAudioInputSettingsTreeProvider} from './videoAudioInputSettings'
import {SelectOrganizationTreeProvider} from './selectOrganization'
import {IRecorder, InputDevice} from '../types';
import {getStore} from '../store';
import {fetchMyOrganizations} from '../api';

function createInputViewProvider(recorder) {
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
    recorder.getDevices().then(devices => {
        setInputDevice(devices.screen[0]);
        setInputDevice(devices.microphone[0]);
    });
    const inputViewProvider = new VideoAudioInputSettingsTreeProvider(recorder);
    return inputViewProvider;
}

function createTeamSelectorProvider() {
    vscode.commands.registerCommand(
        'gitduck.setActiveTeam',
        organizationId => {
            teamSelectorProvider.setOrganizationId(organizationId);
            getStore().setSelectedOrganizationId(organizationId);
        }
    );

    const store = getStore();
    const organizations = store.getMyOrganizations();
    const selectedOrgId = store.getSelectedOrganizationId();

    const teamSelectorProvider = new SelectOrganizationTreeProvider(organizations || [], selectedOrgId);

    if (!organizations) {
        fetchMyOrganizations()
            .then(organizations => {
                teamSelectorProvider.setOrganizations(organizations);
                store.setMyOrganizations(organizations);
            })
    }

    return teamSelectorProvider
}

export function initTreeView(recorder: IRecorder) {
    const inputViewProvider = createInputViewProvider(recorder);
    const teamSelectorProvider = createTeamSelectorProvider();

    vscode.window.registerTreeDataProvider('inputSettings', inputViewProvider);
    vscode.window.registerTreeDataProvider('teamSelector', teamSelectorProvider)
}
