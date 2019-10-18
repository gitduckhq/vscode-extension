import {InputDevices, InputDeviceType, InputScreenDevice, InputDevice, IRecorder, RecorderOptions} from '../types';
import * as tempy from 'tempy';
import {spawn, exec as callbackExec} from 'child_process'
import config from '../config'
import * as vscode from 'vscode';
import * as path from 'path'
import {promisify} from 'util';
import * as systemInfo from 'systeminformation';

const exec = promisify(callbackExec);

const ffmpegPath = path.join(__dirname, './bin/windows/ffmpeg');

let execFfmpegCommand = (args: string) => {
    return exec(`${ffmpegPath} ${args}`)
        .catch(({stderr}) => {
            return stderr
        })
};

class WindowsRecorder implements IRecorder {
    options?: RecorderOptions;
    ffmpegChild: any;
    private recording: boolean = false;

    private selectedVideoDevice: InputScreenDevice | undefined;
    private selectedAudioDevice: InputDevice | undefined;

    constructor(options?: RecorderOptions) {
        if (options) {
            this.options = options;
        }
    }

    static async getScreens(): Promise<InputScreenDevice[]> {
        const {displays} = await systemInfo.graphics();
        console.log('Fetching Windows screens', displays);

        return displays.map((display, i) => {
            return {
                index: i,
                name: display.main ? 'Main screen' : 'Screen ' + i,
                type: InputDeviceType.Screen,
                resolution: {
                    x: Number(display.resolutionx),
                    y: Number(display.resolutiony),
                },
                offset: {
                    x: Number(display.positionX),
                    y: Number(display.positionY),
                }
            }
        });
    }

    static async getMicrophones(): Promise<InputDevice[]> {
        const ffmpegOutput = await execFfmpegCommand('-hide_banner -list_devices true -f dshow -i dummy');
        console.log('Fetching Windows microphones...', ffmpegOutput);
        const audioDevicesIndex = ffmpegOutput.indexOf('DirectShow audio devices');
        const audioDevicesOutput = ffmpegOutput.substring(audioDevicesIndex);

        const regExp = /"(.*)"\r\n.*Alternative name "(.*)"/g;
        if (!regExp.flags.includes('g')) {
            console.error('Invalid RegExp, will cause infinite loop.');
            return []
        }

        const microphones = [];
        let match;
        let i = 0;
        while ((match = regExp.exec(audioDevicesOutput))) {
            const [, name, id] = match;
            microphones.push({
                index: i,
                type: InputDeviceType.Microphone,
                id: id,
                name: name,
            });
            ++i;
        }

        return microphones;
    }

    async getDevices(): Promise<InputDevices> {
        const screen = WindowsRecorder.getScreens();
        const microphone = WindowsRecorder.getMicrophones();
        return {
            screen: await screen,
            microphone: await microphone,
        }
    }

    setInputDevice(device) {
        if (device.type === InputDeviceType.Screen) {
            this.selectedVideoDevice = device;
        } else if (device.type === InputDeviceType.Microphone) {
            this.selectedAudioDevice = device;
        }
    }

    async start(options: RecorderOptions) {
        const lowQuality = vscode.workspace.getConfiguration().get('gitduck.video-quality') === 'low';

        if (!this.selectedVideoDevice) {
            vscode.window.showErrorMessage('No video device selected');
            return
        }
        if (!this.selectedAudioDevice) {
            vscode.window.showErrorMessage('No audio device selected');
            return
        }

        const rtmpURL = `rtmp://${config.liveHost}/app/${options.streamKey}?useHealthCheck=true`;

        const {resolution, offset} = this.selectedVideoDevice;
        const resolutionStr = resolution.x + 'x' + resolution.y;
        let args = [
            '-hide_banner -loglevel info -f gdigrab',
            `-video_size ${resolutionStr} -offset_x ${offset.x} -offset_y ${offset.y} -i desktop`,
            `-f dshow -ac 2 -i audio="${this.selectedAudioDevice.id}" -c:a aac -c:v libx264 -preset ultrafast -threads 0`,
            '-vf "scale=-2:1080,format=yuv420p" -tune zerolatency',
            '-framerate 20 -g 40 -f flv -pix_fmt yuv420p -b:a 128k -r 20',
            rtmpURL,
        ].join(' ');

        if (lowQuality) {
            args = [
                `-hide_banner -loglevel info -f gdigrab`,
                `-video_size ${resolutionStr} -offset_x ${offset.x} -offset_y ${offset.y} -i desktop`,
                `-f dshow -ac 2 -i audio="${this.selectedAudioDevice.id}" -c:a aac -c:v libx264 -threads 0`,
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
            {shell: true, detached: false, windowsHide: true}
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
            if ((code > 1 && code !== 255) || signal === 'SIGABRT') {
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
        await exec('taskkill ' + ['/pid', this.ffmpegChild.pid, '/f', '/t'].join(' '));
    }
}

export default WindowsRecorder;
