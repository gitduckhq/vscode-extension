import {InputDevices, InputDeviceType, InputDevice, IRecorder, RecorderOptions} from '../types';
import * as tempy from 'tempy';
import {spawn, exec as callbackExec} from 'child_process'
import config from '../config'
import * as vscode from 'vscode';
import * as path from 'path'
import {promisify} from 'util';

const exec = promisify(callbackExec);

const ffmpegPath = path.join(__dirname, './bin/mac/ffmpeg');

const execFfmpegCommand = (args: string) => {
    return exec(`${ffmpegPath} ${args}`)
        .catch(({stderr}) => {
            return stderr
        })
};

class MacOSRecorder implements IRecorder {
    options?: RecorderOptions;
    ffmpegChild: any;
    private recording: boolean = false;

    private selectedVideoDeviceIndex = 1;
    private selectedAudioDeviceIndex = 0;

    constructor(options?: RecorderOptions) {
        if (options) {
            this.options = options;
        }
    }

    private getDevicesFromFFmpegOutput(output: string): InputDevices {
        const video: InputDevice[] = [];
        const audio: InputDevice[] = [];
        let deviceType: InputDeviceType.Screen | InputDeviceType.Microphone;
        output.split('\n').forEach(x => {
            if (x.includes('video')) {
                deviceType = InputDeviceType.Screen
            } else if (x.includes('audio')) {
                deviceType = InputDeviceType.Microphone
            } else if (x.includes('] [')) {
                const regexResult = /\[(\d+)] (.*)/.exec(x);
                if (!regexResult)
                    return;

                const [, index, name] = regexResult;
                const devices = deviceType === InputDeviceType.Screen ? video : audio;
                devices.push({index: parseInt(index), name, type: deviceType});
            }
        });

        return {
            screen: video
                .filter(({name}) => name.includes('Capture screen'))
                .map(({name, ...rest}, i) => ({name: i === 0 ? 'Main screen' : 'Screen ' + i, ...rest})),
            microphone: audio,
        }
    }

    async getDevices(): Promise<InputDevices> {
        const ffmpegArgs = '-hide_banner -f avfoundation -list_devices true -i ""';
        const ffmpegOutput = await execFfmpegCommand(ffmpegArgs);
        return this.getDevicesFromFFmpegOutput(ffmpegOutput)
    }

    setInputDevice(device: InputDevice) {
        if (device.type === InputDeviceType.Screen) {
            this.selectedVideoDeviceIndex = device.index;
        } else if (device.type === InputDeviceType.Microphone) {
            this.selectedAudioDeviceIndex = device.index;
        }
    }

    async start(options: RecorderOptions) {
        const destinationPath = tempy.file({extension: 'mkv'});

        const lowQuality = vscode.workspace.getConfiguration().get('gitduck.video-quality') === 'low';

        const rtmpURL = `rtmp://${config.liveHost}/app/${options.streamKey}?useHealthCheck=true`;

        let args = [
            '-hide_banner -loglevel info -f avfoundation',
            `-capture_cursor 1 -i "${this.selectedVideoDeviceIndex}" -f avfoundation`,
            `-ac 2 -i ":${this.selectedAudioDeviceIndex}" -c:a aac -c:v libx264 -preset ultrafast -threads 0`,
            '-vf "scale=-2:1080,format=yuv420p" -tune zerolatency',
            '-framerate 20 -g 40 -f flv -pix_fmt yuv420p -b:a 128k -r 20',
            rtmpURL,
        ].join(' ');

        if (lowQuality) {
            args = [
                `-hide_banner -loglevel info -f avfoundation -capture_cursor 1 -i "${this.selectedVideoDeviceIndex}"`,
                `-f avfoundation -ac 2 -i ":${this.selectedAudioDeviceIndex}" -c:a aac -c:v libx264 -threads 0`,
                '-x264-params "nal-hrd=cbr" -preset ultrafast',
                '-vf "scale=-2:720,format=yuv420p" -tune zerolatency -framerate 30',
                '-g 60 -b:a 128k -pix_fmt yuv420p -crf 30 -b:v 600k',
                `-r 15 -f flv`,
                rtmpURL,
            ].join(' ')
        }

        console.log(`Running ${ffmpegPath} ${args}`);

        this.ffmpegChild = spawn(
            ffmpegPath,
            args.split(' '),
            {shell: true, detached: true}
        );
        this.recording = true;
        this.ffmpegChild.unref();

        console.log('Deataching and unreffing ffmpeg process....');

        this.ffmpegChild.on('close', (code: number, signal: string) => {
            this.recording = false;
            console.debug('FFMPEG Close event. GOT A CODE', code, '+SIGNAL:', signal);
        });

        this.ffmpegChild.on('disconnect', () => {
            console.debug('FFMPEG Disconnect event');
        });

        this.ffmpegChild.on('error', (err: Error) => {
            console.debug('FFMPEG Error event. GOT AN ERROR', err);
            if (options.onError) {
                options.onError()
            }
            throw new Error('Error in ffmpeg')
        });

        this.ffmpegChild.on('exit', (code: number, signal: string) => {
            this.recording = false;
            console.debug('FFMPEG Exit event. GOT A CODE', code, '\n+SIGNAL:', signal);
            if ((code > 0 && code !== 255) || signal === 'SIGABRT') {
                if (options.onError) {
                    options.onError()
                }
                throw new Error('Error in ffmpeg')
            }
        });

        this.ffmpegChild.stdout.on('data', (data: Buffer) => {
            console.debug('[FFMPEG STDOUT]:', data.toString());
        });

        this.ffmpegChild.stderr.on('data', (data: Buffer) => {
            console.debug('[FFMPEG STDERR]:', data.toString());
        });
    }

    async pause() {

    }

    isRecording() {
        return !!this.recording;
    }

    async stop() {
        this.recording = false;
        return this.ffmpegChild.kill();
    }
}

export default MacOSRecorder;
