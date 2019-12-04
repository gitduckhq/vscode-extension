# GitDuck Change Log

## [Version 0.0.33]

- Improve FFmpeg process termination. ([5d36cf0](https://github.com/gitduckhq/vscode-extension/commit/5d36cf0a03fca5030c8a1469d910aff6490e4e00))

## [Version 0.0.32]

- Add reconnection attempts to server if something goes wrong with the server.

## [Version 0.0.31]

- Add: team selector, to record videos for a GitDuck team. [GitDuck video](https://gitduck.com/watch/5dc00122d10ecc2f59d2ac09)
- Fix: small audio bug in some scenarios

## [Version 0.0.30]

- Fix: extension was removing custom color scheme. [#2](https://github.com/gitduckhq/vscode-extension/issues/2)
- Fix: bug with `Copy to clipboard` button. [#3](https://github.com/gitduckhq/vscode-extension/issues/4)
- Reliability improvement: send healthecks to the live server while recording. Stream will be stopped if no healthchecks are not received within a certain interval.
- Fix: Windows bug, video was cropped if user had a different dispaly scale than 100%. [#6](https://github.com/gitduckhq/vscode-extension/issues/6) 

## [Version 0.0.29]

- Change emojis for selecting screen/microphone.
- Add popup when logging in to show authentication URL in case browser doesn't open.

## [Version 0.0.28]

- Fix: code-linking was not working due to a broken dependency.
- Add: emojis in the screen/microphone devices selector.
- Fix: bug allowing non-authenticated users to stream.

## [Version 0.0.27]

- Fix bug when uploading code snippets.

## [Version 0.0.26]

- Fixing small bugs when uploading snippets without authentication
- Enhanced performance
- Reduce extension size

## [Version 0.0.25]

- Fixing extension bug when using in Linux.
- Fix bug with clipboard

## [Version 0.0.24]

- Add new feature: right click on a selected code to attach a code snippet to a video. [Watch development on GitDuck](https://gitduck.com/watch/5d8b3775914a9c23a6e98b6d)
- Other small minor fixes and improvements.

## [Version 0.0.23]

- Fix bug that wasn't allowing to start streaming.

## [Version 0.0.22]

- Improve README
- Handle no device selected in Windows.

## [Version 0.0.21]

- Initial release
