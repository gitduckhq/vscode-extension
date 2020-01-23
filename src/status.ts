import * as vscode from 'vscode';

const workbenchConfig = vscode.workspace.getConfiguration('workbench');

function clean(x: number) {
    let res = `${Math.trunc(x)}`;
    if (res.length < 2) {
        res = `0${res}`;
    }
    return res;
}

class StatusBar {

    private item: vscode.StatusBarItem;
    timeout: NodeJS.Timer | null = null;
    counting = false;
    userColorCustomizations: any;
    gitDuckColorCustomizations: any;

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.userColorCustomizations = workbenchConfig.get('colorCustomizations');
        const statusBarFGColor = '#802525';
        const statusBarBGColor = '#F85246';
        this.gitDuckColorCustomizations = {
            'statusBar.background': statusBarBGColor,
            'statusBar.foreground': statusBarFGColor,
            'statusBar.debuggingForeground': statusBarFGColor,
            'statusBar.debuggingBackground': statusBarBGColor,
            'statusBar.noFolderForeground': statusBarFGColor,
            'statusBar.noFolderBackground': statusBarBGColor,
        };
    }

    show() {
        this.item.show();
    }

    dispose() {
        this.recordingStopped();
        this.item.dispose();
    }

    loading() {
        this.item.text = 'Loading...';
        this.item.command = undefined;
    }

    uploading() {
        this.item.text = 'Uploading...';
        this.item.command = undefined;
    }

    stop() {
        workbenchConfig.update('colorCustomizations', this.userColorCustomizations, true);
        this.item.command = 'gitduck.newStream';
        this.recordingStopped();
        this.item.text = '$(circle-outline) Record new video';
        this.item.color = 'white';
        this.counting = false;
    }

    login() {
        this.recordingStopped();
        this.item.command = 'gitduck.login';
        this.item.text = 'Login to GitDuck';
        this.item.color = 'white';
        this.counting = false;
    }

    stopping() {
        this.recordingStopped();
        this.counting = false;
        this.item.text = '$(pulse) GitDuck Stopping...';
        this.item.color = '#000000';
    }

    recordingStopped() {
        if (this.timeout) {
            clearInterval(this.timeout);
        }
    }

    start(createdDateTime) {
        this.userColorCustomizations = workbenchConfig.get('colorCustomizations');
        const colorCustomizations = {...this.userColorCustomizations, ...this.gitDuckColorCustomizations};
        workbenchConfig.update('colorCustomizations', colorCustomizations, true);
        this.item.command = 'gitduck.stopStream';
        this.item.text = '$(circle-filled) GitDuck recording';
        this.item.color = '#000000';

        const start = createdDateTime || Date.now();
        const og = this.item.text;
        const sec = 1000;
        const min = sec * 60;
        const hour = min * 60;

        const update = () => {
            const time = Date.now() - start;
            let timeStr = `${clean((time / min) % 60)}:${clean((time / sec) % 60)}`;
            if (time > hour) {
                timeStr = `${Math.trunc(time / hour)}:${timeStr}`;
            }
            this.item.text = `${og} : ${timeStr}`;
        };

        clearTimeout(this.timeout);
        this.timeout = setInterval(update, 1000);

        update();
    }
}

export default new StatusBar();
