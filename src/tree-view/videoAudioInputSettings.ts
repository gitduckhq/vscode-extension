import * as vscode from "vscode";
import {InputDeviceType, InputDevice, InputDevices, IRecorder} from '../types'

const titles = {
    videoInput: 'Video input',
    audioInput: 'Audio input',
};

export class VideoAudioInputSettingsTreeProvider implements vscode.TreeDataProvider<InputDeviceTypeItem | InputDeviceItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
    readonly onDidChangeTreeData: vscode.Event<undefined> = this._onDidChangeTreeData.event;
    private recorder: IRecorder;
    private devices: InputDevices | undefined;

    private selectedVideoDeviceIndex: number;
    private selectedAudioDeviceIndex: number;

    private isSelectedAudioDevice = (device: InputDevice) => device.index === this.selectedAudioDeviceIndex;
    private isSelectedVideoDevice = (device: InputDevice) => device.index === this.selectedVideoDeviceIndex;

    constructor(recorder: IRecorder, selectedVideoDeviceIndex = 1, selectedAudioDeviceIndex = 0) {
        this.recorder = recorder;
        this.selectedVideoDeviceIndex = selectedVideoDeviceIndex;
        this.selectedAudioDeviceIndex = selectedAudioDeviceIndex;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setInputDevice(device: InputDevice) {
        if (device.type === InputDeviceType.Screen) {
            this.selectedVideoDeviceIndex = device.index;
        } else if (device.type === InputDeviceType.Microphone) {
            this.selectedAudioDeviceIndex = device.index;
        } else {
            console.error('Input device of invalid type', device)
        }
        this.refresh();
    }

    getTreeItem(element: any): vscode.TreeItem {
        return element;
    }

    async getChildren(element: InputDeviceTypeItem | InputDeviceItem) {
        if (!this.devices) {
            this.devices = await this.recorder.getDevices();
        }

        if (element) {
            if (element.label === titles.videoInput) {
                return this.devices.screen
                    .map(device => new InputDeviceItem(device, this.isSelectedVideoDevice(device)))
            }
            if (element.label === titles.audioInput) {
                return this.devices.microphone
                    .map(device => new InputDeviceItem(device, this.isSelectedAudioDevice(device)))
            }
            return []
        } else {
            this.devices = await this.recorder.getDevices();

            const selectedVideoDevice = this.devices.screen.find(this.isSelectedVideoDevice);
            const selectedAudioDevice = this.devices.microphone.find(this.isSelectedAudioDevice);

            return [
                new InputDeviceTypeItem(titles.videoInput, selectedVideoDevice && selectedVideoDevice.name),
                new InputDeviceTypeItem(titles.audioInput, selectedAudioDevice && selectedAudioDevice.name),
            ]
        }
    }
}

export class InputDeviceTypeItem extends vscode.TreeItem {
    private readonly selectedDeviceLabel: string | undefined;

    constructor(label: string, selectedDeviceLabel: string | undefined) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.selectedDeviceLabel = selectedDeviceLabel;
    }

    get description(): string {
        return this.selectedDeviceLabel || '';
    }
}

export class InputDeviceItem extends vscode.TreeItem {
    private readonly isSelected: boolean;

    constructor(device: InputDevice, selected: boolean) {
        const emoji = selected ? '☑️' : '';
        super(`${emoji} ${device.name}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = device.type;
        this.isSelected = selected;
        this.command = {
            command: 'gitduck.setInputDevice',
            title: '',
            arguments: [device]
        };
    }

    get tooltip(): string {
        return 'Click to select input source';
    }

    get description(): string {
        if (this.isSelected) {
            return 'Selected';
        }
        return ''
    }
}
