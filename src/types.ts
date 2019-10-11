export type Commit = {
    authorEmail: string,
    authorName: string,
    body: string,
    date: Date,
    videoTimestamp: number,
    hash: string,
    message: string,
    refs: string,
    rawCommit: string,
    rawCommitFull: string,
}

export interface RecorderOptions {
    fps?: number;
    streamKey: string;
    onError?: Function;
}

export enum InputDeviceType {
    Microphone = 'microphone',
    Screen = 'screen'
}
export type InputDevice = {
    index: number,
    id?: string,
    name: string,
    type: InputDeviceType,
}
export type InputScreenDevice = {
    index: number,
    name: string,
    type: InputDeviceType,
    resolution: {
        x: number,
        y: number,
    },
    offset: {
        x: number,
        y: number,
    },
}
export type InputDevices = {
    screen: (InputDevice | InputScreenDevice)[],
    microphone: InputDevice[],
}

export interface IRecorder {
    options?: RecorderOptions;

    start(options: RecorderOptions): Promise<void>;
    pause(): Promise<void>;
    stop(): Promise<void>;
    setInputDevice(device: InputDevice): void;
    getDevices(): Promise<InputDevices>
    isRecording(): boolean;
}

