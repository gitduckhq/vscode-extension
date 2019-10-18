import {InputDevices, InputDevice, InputScreenDevice, InputDeviceType, IRecorder, RecorderOptions} from '../types';
import * as tempy from 'tempy';
import {spawn, exec as callbackExec} from 'child_process'
import config from '../config'
import * as vscode from 'vscode';
import * as path from 'path'
import {promisify} from 'util';

const exec = promisify(callbackExec);

const ffmpegPath = path.join(__dirname, './bin/linux/ffmpeg');

const execFfmpegCommand = (args: string) => {
    return exec(`${ffmpegPath} ${args}`)
        .catch(({stderr}) => {
            return stderr
        })
};

class LinuxRecorder implements IRecorder {
    options?: RecorderOptions;
    ffmpegChild: any;
    private recording: boolean = false;

    private selectedScreenDevice?: InputScreenDevice;
    private selectedAudioDeviceIndex = 0;

    constructor(options?: RecorderOptions) {
        if (options) {
            this.options = options;
        }
    }

    private static async getScreens(): Promise<InputScreenDevice[]> {
        const {stdout} = await exec('xrandr --listmonitors');
        const regExp = /(\d+):.* (\d+)\/\d+x(\d+).*\+(\d+)\+(\d+)/g;

        if (!regExp.flags.includes('g')) {
            console.error('Invalid RegExp, will cause infinite loop.');
            return []
        }

        const screens = [];
        let match;
        while ((match = regExp.exec(stdout))) {
            const [, index, resX, resY, offsetX, offsetY] = match;
            screens.push({
                index: Number(index),
                type: InputDeviceType.Screen,
                resolution: {
                    x: Number(resX),
                    y: Number(resY),
                },
                offset: {
                    x: Number(offsetX),
                    y: Number(offsetY),
                }
            })
        }

        return screens.map((screen, i) => ({
            ...screen,
            name: (i === 0 ? 'Main Screen' : `Screen ${i+1}`) + ` (${screen.resolution.x}x${screen.resolution.y})`
        }))
    }

    private static async getMicrophones(): Promise<InputDevice[]> {
        return [];
    }

    async getDevices(): Promise<InputDevices> {
        return {
            screen: await LinuxRecorder.getScreens(),
            microphone: await LinuxRecorder.getMicrophones(),
        }
    }

    setInputDevice(device) {
        if (device.type === InputDeviceType.Screen) {
            this.selectedScreenDevice = device;
        } else if (device.type === InputDeviceType.Microphone) {
            this.selectedAudioDeviceIndex = device.index;
        }
    }

    async start(options: RecorderOptions) {
        const destinationPath = tempy.file({extension: 'mkv'});

        const isLowQuality = vscode.workspace.getConfiguration().get('gitduck.video-quality') === 'low';
        const {resolution, offset} = this.selectedScreenDevice;

        const rtmpURL = `rtmp://${config.liveHost}/app/${options.streamKey}?useHealthCheck=true`;

        let args = [
            '-hide_banner -loglevel info -f x11grab -video_size',
            `${resolution.x}x${resolution.y} -i ":0.0+${offset.x},${offset.y}" -f alsa`,
            `-ac 2 -i "default" -c:a aac -c:v libx264 -preset ultrafast -threads 0`,
            '-vf "scale=-2:1080,format=yuv420p" -tune zerolatency',
            '-framerate 20 -g 40 -f flv -pix_fmt yuv420p -b:a 128k -r 20',
            rtmpURL,
        ].join(' ');

        if (isLowQuality) {
            // -f alsa -ac 2 -i "default"
            args = [
                `-hide_banner -loglevel info -f x11grab -video_size ${resolution.x}x${resolution.y} -i ":0.0+${offset.x},${offset.y}"`,
                `-c:a aac -c:v libx264 -threads 0`,
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

        this.ffmpegChild.on('error', err => {
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

export default LinuxRecorder;
