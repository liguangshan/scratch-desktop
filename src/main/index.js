import {BrowserWindow, Menu, app, dialog, ipcMain, shell, systemPreferences} from 'electron';
import fs from 'fs-extra';
import path from 'path';
import {URL} from 'url';
import {promisify} from 'util';

import argv from './argv';
import {getFilterForExtension} from './FileFilters';
import telemetry from './ScratchDesktopTelemetry';
import MacOSMenu from './MacOSMenu';
import log from '../common/log.js';
import packageJson from '../../package.json';

// 抑制废弃警告；这将是 Electron 9 的默认行为
// suppress deprecation warning; this will be the default in Electron 9
app.allowRendererProcessReuse = true;

// 记录应用打开的遥测数据
telemetry.appWasOpened();

// const defaultSize = {width: 1096, height: 715}; // minimum
// 默认窗口大小，适合 Mac App Store 截图
// default window size, good for MAS screenshots
const defaultSize = {width: 1280, height: 800};

// 判断是否为开发环境
const isDevelopment = process.env.NODE_ENV !== 'production';

// 定义开发者工具的快捷键配置
// Define the key configuration for opening DevTools
const devToolKey = ((process.platform === 'darwin') ?
    { // macOS: command+option+i
        alt: true, // option
        control: false,
        meta: true, // command
        shift: false,
        code: 'KeyI'
    } : { // Windows / linux: control+shift+i
        alt: false,
        control: true,
        meta: false, // Windows key
        shift: true,
        code: 'KeyI'
    }
);

// 全局窗口引用，防止被垃圾回收
// global window references prevent them from being garbage-collected
const _windows = {};
const PORT = process.env.PORT || 8601;

// 即使没有 DNS/互联网访问也能连接到 Scratch Link
// 必须在 app ready 事件之前调用！
// enable connecting to Scratch Link even if we DNS / Internet access is not available
// this must happen BEFORE the app ready event!
app.commandLine.appendSwitch('host-resolver-rules', 'MAP device-manager.scratch.mit.edu 127.0.0.1');

/**
 * 显示权限被拒绝的警告对话框
 * Show a warning dialog when permission is denied.
 * @param {BrowserWindow} browserWindow - 目标窗口 / the target window
 * @param {string} permissionType - 权限类型 ('camera' 或 'microphone') / the permission type
 */
const displayPermissionDeniedWarning = (browserWindow, permissionType) => {
    let title;
    let message;
    switch (permissionType) {
    case 'camera':
        title = 'Camera Permission Denied'; // 相机权限被拒绝
        message = 'Permission to use the camera has been denied. ' +
            'Scratch will not be able to take a photo or use video sensing blocks.';
        break;
    case 'microphone':
        title = 'Microphone Permission Denied'; // 麦克风权限被拒绝
        message = 'Permission to use the microphone has been denied. ' +
            'Scratch will not be able to record sounds or detect loudness.';
        break;
    default: // shouldn't ever happen...
        title = 'Permission Denied';
        message = 'A permission has been denied.';
    }

    let instructions;
    switch (process.platform) {
    case 'darwin':
        instructions = 'To change Scratch permissions, please check "Security & Privacy" in System Preferences.';
        break;
    default:
        instructions = 'To change Scratch permissions, please check your system settings and restart Scratch.';
        break;
    }
    message = `${message}\n\n${instructions}`;

    dialog.showMessageBox(browserWindow, {type: 'warning', title, message});
};

/**
 * 从相对路径构建绝对 URL，可选添加查询参数。
 * URL 的基础路径取决于应用是否在开发模式下运行。
 * Build an absolute URL from a relative one, optionally adding search query parameters.
 * The base of the URL will depend on whether or not the application is running in development mode.
 * @param {string} url - 相对 URL，如 'index.html' / the relative URL
 * @param {*} search - 可选的查询参数（'?' 之后的部分），如 "route=about" / the optional "search" parameters
 * @returns {string} - 绝对 URL 字符串 / an absolute URL as a string
 */
const makeFullUrl = (url, search = null) => {
    const baseUrl = (isDevelopment ?
        `http://localhost:${PORT}/` :
        `file://${path.join(__dirname, '../renderer')}/`
    );
    const fullUrl = new URL(url, baseUrl);
    if (search) {
        fullUrl.search = search; // automatically percent-encodes anything that needs it
    }
    return fullUrl.toString();
};

/**
 * 以特定于平台的方式请求麦克风或摄像头的访问权限（如果 Electron 支持）。
 * 任何应用级别的检查（例如特定框架或文档是否应该被允许询问）都应该在此函数调用之前完成。
 * 此函数可能返回 Promise！
 * Prompt in a platform-specific way for permission to access the microphone or camera, if Electron supports doing so.
 * Any application-level checks, such as whether or not a particular frame or document should be allowed to ask,
 * should be done before calling this function.
 * This function may return a Promise!
 *
 * @param {string} mediaType - Electron 的媒体类型之一，如 'microphone' 或 'camera'
 * @returns {boolean|Promise.<boolean>} - 如果权限被授予则为 true，否则为 false
 */
const askForMediaAccess = mediaType => {
    if (systemPreferences.askForMediaAccess) {
        // Electron 目前仅在 macOS 上实现了此功能
        // 返回一个 Promise
        // Electron currently only implements this on macOS
        // This returns a Promise
        return systemPreferences.askForMediaAccess(mediaType);
    }
    // 对于其他平台，我们只能假设拥有访问权限。
    // For other platforms we can't reasonably do anything other than assume we have access.
    return true;
};

/**
 * 处理权限请求的回调函数
 * Callback to handle permission requests.
 */
const handlePermissionRequest = async (webContents, permission, callback, details) => {
    if (webContents !== _windows.main.webContents) {
        // 拒绝：请求来自主窗口 web contents 以外的地方
        // deny: request came from somewhere other than the main window's web contents
        return callback(false);
    }
    if (!details.isMainFrame) {
        // 拒绝：请求来自主窗口的子框架，而不是主框架
        // deny: request came from a subframe of the main window, not the main frame
        return callback(false);
    }
    if (permission !== 'media') {
        // 拒绝：请求的是其他类型的访问权限，如通知或 pointerLock
        // deny: request is for some other kind of access like notifications or pointerLock
        return callback(false);
    }
    const requiredBase = makeFullUrl('');
    if (details.requestingUrl.indexOf(requiredBase) !== 0) {
        // 拒绝：请求来自我们“沙盒”之外的 URL
        // deny: request came from a URL outside of our "sandbox"
        return callback(false);
    }
    let askForMicrophone = false;
    let askForCamera = false;
    for (const mediaType of details.mediaTypes) {
        switch (mediaType) {
        case 'audio':
            askForMicrophone = true;
            break;
        case 'video':
            askForCamera = true;
            break;
        default:
            // 拒绝：未处理的媒体类型
            // deny: unhandled media type
            return callback(false);
        }
    }
    const parentWindow = _windows.main; // if we ever allow media in non-main windows we'll also need to change this
    if (askForMicrophone) {
        const microphoneResult = await askForMediaAccess('microphone');
        if (!microphoneResult) {
            displayPermissionDeniedWarning(parentWindow, 'microphone');
            return callback(false);
        }
    }
    if (askForCamera) {
        const cameraResult = await askForMediaAccess('camera');
        if (!cameraResult) {
            displayPermissionDeniedWarning(parentWindow, 'camera');
            return callback(false);
        }
    }
    return callback(true);
};

/**
 * 创建浏览器窗口的通用函数
 * Generic function to create a browser window.
 */
const createWindow = ({search = null, url = 'index.html', ...browserWindowOptions}) => {
    const window = new BrowserWindow({
        useContentSize: true,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
        ...browserWindowOptions
    });
    const webContents = window.webContents;

    // 设置权限请求处理程序
    // Set permission request handler
    webContents.session.setPermissionRequestHandler(handlePermissionRequest);

    // 处理键盘事件以打开开发者工具
    // Handle key events to open DevTools
    webContents.on('before-input-event', (event, input) => {
        if (input.code === devToolKey.code &&
            input.alt === devToolKey.alt &&
            input.control === devToolKey.control &&
            input.meta === devToolKey.meta &&
            input.shift === devToolKey.shift &&
            input.type === 'keyDown' &&
            !input.isAutoRepeat &&
            !input.isComposing) {
            event.preventDefault();
            webContents.openDevTools({mode: 'detach', activate: true});
        }
    });

    // 处理新窗口打开事件（在外部浏览器中打开链接）
    // Handle new window events (open links in external browser)
    webContents.on('new-window', (event, newWindowUrl) => {
        shell.openExternal(newWindowUrl);
        event.preventDefault();
    });

    const fullUrl = makeFullUrl(url, search);
    window.loadURL(fullUrl);
    window.once('ready-to-show', () => {
        webContents.send('ready-to-show');
    });

    return window;
};

// 创建关于窗口
// Create the About window
const createAboutWindow = () => {
    const window = createWindow({
        width: 400,
        height: 400,
        parent: _windows.main,
        search: 'route=about',
        title: `About ${packageJson.productName}`
    });
    return window;
};

// 创建隐私政策窗口
// Create the Privacy Policy window
const createPrivacyWindow = () => {
    const window = createWindow({
        width: _windows.main.width * 0.8,
        height: _windows.main.height * 0.8,
        parent: _windows.main,
        search: 'route=privacy',
        title: `${packageJson.productName} Privacy Policy`
    });
    return window;
};

// 创建 USB 设备连接窗口
// Create the USB device connection window
const createUsbWindow = () => {
    const window = createWindow({
        width: 400,
        height: 300,
        parent: _windows.main,
        search: 'route=usb',
        modal: true,
        frame: false
    });

    // Filters from navigator.usb.requestDevice do not appear to be available here.
    // Hard code to micro:bit since that is the only device that currently uses this api.
    // navigator.usb.requestDevice 的过滤器在此处似乎不可用。
    // 硬编码为 micro:bit，因为目前只有该设备使用此 API。
    const getIsMicroBit = device => device.vendorId === 0x0d28 && device.productId === 0x0204;
    let deviceList = [];
    let selectedDeviceCallback;

    // 监听 USB 设备选择事件
    // Listen for USB device selection events
    _windows.main.webContents.session.on('select-usb-device', (event, details, callback) => {
        deviceList = details.deviceList.filter(getIsMicroBit);
        selectedDeviceCallback = callback;

        window.webContents.send('usb-device-list', deviceList);
        window.show();

        event.preventDefault();
    });

    // 监听 USB 设备添加事件
    // Listen for USB device added events
    _windows.main.webContents.session.on('usb-device-added', (_event, device) => {
        if (!getIsMicroBit(device)) return;
        deviceList.push(device);
        window.webContents.send('usb-device-list', deviceList);
    });

    // 监听 USB 设备移除事件
    // Listen for USB device removed events
    _windows.main.webContents.session.on('usb-device-removed', (_event, device) => {
        if (!getIsMicroBit(device)) return;
        deviceList = deviceList.filter(existing => existing.deviceId !== device.deviceId);
        window.webContents.send('usb-device-list', deviceList);
    });

    // 处理从 USB 窗口选中的设备
    // Handle device selected from USB window
    ipcMain.on('usb-device-selected', (_event, message) => {
        selectedDeviceCallback(message);
        window.hide();
    });

    return window;
};

// 检查下载项是否为项目保存 (.sb3)
// Check if the download item is a project save (.sb3)
const getIsProjectSave = downloadItem => {
    switch (downloadItem.getMimeType()) {
    case 'application/x.scratch.sb3':
        return true;
    }
    return false;
};

// 创建主窗口
// Create the main window
const createMainWindow = () => {
    const window = createWindow({
        width: defaultSize.width,
        height: defaultSize.height,
        title: `${packageJson.productName} ${packageJson.version}` // something like "Scratch 3.14"
    });
    const webContents = window.webContents;

    // 处理下载事件（主要用于保存项目）
    // Handle download events (mainly for saving projects)
    webContents.session.on('will-download', (willDownloadEvent, downloadItem) => {
        const isProjectSave = getIsProjectSave(downloadItem);
        const itemPath = downloadItem.getFilename();
        const baseName = path.basename(itemPath);
        const extName = path.extname(baseName);
        const options = {
            defaultPath: baseName
        };
        if (extName) {
            const extNameNoDot = extName.replace(/^\./, '');
            options.filters = [getFilterForExtension(extNameNoDot)];
        }
        // 同步显示保存对话框
        // Show save dialog synchronously
        const userChosenPath = dialog.showSaveDialogSync(window, options);
        // this will be falsy if the user canceled the save
        // 如果用户取消保存，此值为 false
        if (userChosenPath) {
            const userBaseName = path.basename(userChosenPath);
            const tempPath = path.join(app.getPath('temp'), userBaseName);

            // WARNING: `setSavePath` on this item is only valid during the `will-download` event. Calling the async
            // version of `showSaveDialog` means the event will finish before we get here, so `setSavePath` will be
            // ignored. For that reason we need to call `showSaveDialogSync` above.
            // 警告：必须在 `will-download` 事件中调用 `setSavePath`。如果使用异步 `showSaveDialog`，
            // 事件会在此之前结束，导致 `setSavePath` 被忽略。因此必须使用 `showSaveDialogSync`。
            downloadItem.setSavePath(tempPath);

            downloadItem.on('done', async (doneEvent, doneState) => {
                try {
                    if (doneState !== 'completed') {
                        // The download was canceled or interrupted. Cancel the telemetry event and delete the file.
                        // 下载被取消或中断。取消遥测事件并删除文件。
                        throw new Error(`save ${doneState}`); // "save cancelled" or "save interrupted"
                    }
                    // 将文件从临时路径移动到用户选择的路径
                    // Move the file from temp path to user chosen path
                    await fs.move(tempPath, userChosenPath, {overwrite: true});
                    if (isProjectSave) {
                        const newProjectTitle = path.basename(userChosenPath, extName);
                        webContents.send('setTitleFromSave', {title: newProjectTitle});

                        // "setTitleFromSave" will set the project title but GUI has already reported the telemetry
                        // event using the old title. This call lets the telemetry client know that the save was
                        // actually completed and the event should be committed to the event queue with this new title.
                        // 更新遥测数据中的项目标题
                        // "setTitleFromSave" 会设置项目标题，但 GUI 已经使用旧标题报告了遥测事件。
                        // 此调用告知遥测客户端保存已实际完成，并且事件应使用此新标题提交到事件队列。
                        telemetry.projectSaveCompleted(newProjectTitle);
                    }
                } catch (e) {
                    if (isProjectSave) {
                        telemetry.projectSaveCanceled();
                    }
                    // don't clean up until after the message box to allow troubleshooting / recovery
                    // 显示错误对话框后再清理，以便进行故障排除/恢复
                    await dialog.showMessageBox(window, {
                        type: 'error',
                        title: 'Failed to save project',
                        message: `Save failed:\n${userChosenPath}`,
                        detail: e.message
                    });
                    fs.exists(tempPath).then(exists => {
                        if (exists) {
                            fs.unlink(tempPath);
                        }
                    });
                }
            });
        } else {
            downloadItem.cancel();
            if (isProjectSave) {
                telemetry.projectSaveCanceled();
            }
        }
    });

    // 防止意外退出（提示用户保存更改）
    // Prevent accidental exit (prompt user to save changes)
    webContents.on('will-prevent-unload', ev => {
        const choice = dialog.showMessageBoxSync(window, {
            title: packageJson.productName,
            type: 'question',
            message: 'Leave Scratch?',
            detail: 'Any unsaved changes will be lost.',
            buttons: ['Stay', 'Leave'],
            cancelId: 0, // closing the dialog means "stay"
            defaultId: 0 // pressing enter or space without explicitly selecting something means "stay"
        });
        const shouldQuit = (choice === 1);
        if (shouldQuit) {
            ev.preventDefault();
        }
    });

    window.once('ready-to-show', () => {
        window.show();
    });

    return window;
};

// 设置 macOS 菜单
// Set up macOS menu
if (process.platform === 'darwin') {
    const osxMenu = Menu.buildFromTemplate(MacOSMenu(app));
    Menu.setApplicationMenu(osxMenu);
} else {
    // disable menu for other platforms
    // 其他平台禁用菜单
    Menu.setApplicationMenu(null);
}

// quit application when all windows are closed
// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
    app.quit();
});

app.on('will-quit', () => {
    telemetry.appWillClose();
});

// work around https://github.com/MarshallOfSound/electron-devtools-installer/issues/122
// which seems to be a result of https://github.com/electron/electron/issues/19468
// Windows 平台 DevTools 扩展的临时修复
if (process.platform === 'win32') {
    const appUserDataPath = app.getPath('userData');
    const devToolsExtensionsPath = path.join(appUserDataPath, 'DevTools Extensions');
    try {
        fs.unlinkSync(devToolsExtensionsPath);
    } catch (_) {
        // don't complain if the file doesn't exist
    }
}

// create main BrowserWindow when electron is ready
// 当 Electron 准备就绪时创建主窗口
app.on('ready', () => {
    if (isDevelopment) {
        // 开发模式下安装 DevTools 扩展
        // Install DevTools extensions in development mode
        import('electron-devtools-installer').then(importedModule => {
            const {default: installExtension, ...devToolsExtensions} = importedModule;
            const extensionsToInstall = [
                devToolsExtensions.REACT_DEVELOPER_TOOLS,
                devToolsExtensions.REDUX_DEVTOOLS
            ];
            for (const extension of extensionsToInstall) {
                // WARNING: depending on a lot of things including the version of Electron `installExtension` might
                // return a promise that never resolves, especially if the extension is already installed.
                // 警告：取决于包括 Electron 版本在内的许多因素，`installExtension` 可能会
                // 返回一个永远不会 resolve 的 promise，特别是如果扩展已经安装。
                installExtension(extension).then(
                    extensionName => log(`Installed dev extension: ${extensionName}`),
                    errorMessage => log.error(`Error installing dev extension: ${errorMessage}`)
                );
            }
        });
    }

    _windows.main = createMainWindow();
    _windows.main.on('closed', () => {
        delete _windows.main;
    });
    _windows.about = createAboutWindow();
    _windows.about.on('close', event => {
        event.preventDefault();
        _windows.about.hide();
    });
    _windows.privacy = createPrivacyWindow();
    _windows.privacy.on('close', event => {
        event.preventDefault();
        _windows.privacy.hide();
    });

    _windows.usb = createUsbWindow();
});

// IPC 监听：打开关于窗口
// IPC listener: Open About window
ipcMain.on('open-about-window', () => {
    _windows.about.show();
});

// IPC 监听：打开隐私政策窗口
// IPC listener: Open Privacy Policy window
ipcMain.on('open-privacy-policy-window', () => {
    _windows.privacy.show();
});

// start loading initial project data before the GUI needs it so the load seems faster
// 在 GUI 需要之前开始加载初始项目数据，使加载看起来更快
const initialProjectDataPromise = (async () => {
    if (argv._.length === 0) {
        // no command line argument means no initial project data
        // 没有命令行参数意味着没有初始项目数据
        return;
    }
    if (argv._.length > 1) {
        log.warn(`Expected 1 command line argument but received ${argv._.length}.`);
    }
    const projectPath = argv._[argv._.length - 1];
    try {
        const projectData = await promisify(fs.readFile)(projectPath, null);
        return projectData;
    } catch (e) {
        log.error(`Error loading project data: ${e}`);
        dialog.showMessageBox(_windows.main, {
            type: 'error',
            title: 'Failed to load project',
            message: `Could not load project from file:\n${projectPath}`,
            detail: e.message
        });
    }
    // load failed: initial project data undefined
    // 加载失败：initial project data 为 undefined
})(); // IIFE

// 处理获取初始项目数据的请求
// Handle request to get initial project data
ipcMain.handle('get-initial-project-data', () => initialProjectDataPromise);
