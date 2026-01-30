import {app, ipcMain} from 'electron';
import defaultsDeep from 'lodash.defaultsdeep';
import packageJson from '../../package.json';

import TelemetryClient from './telemetry/TelemetryClient';

// 定义遥测事件的基本模板，包含版本、项目名称、语言和统计元数据
// Define the basic template for telemetry events, including version, project name, language, and statistical metadata
const EVENT_TEMPLATE = {
    version: packageJson.version, // 应用版本
    projectName: '', // 项目名称
    language: '', // 语言设置
    metadata: {
        scriptCount: -1, // 脚本数量
        spriteCount: -1, // 角色数量
        variablesCount: -1, // 变量数量
        blocksCount: -1, // 积木块数量
        costumesCount: -1, // 造型数量
        listsCount: -1, // 列表数量
        soundsCount: -1 // 声音数量
    }
};

const APP_ID = 'scratch-desktop';
const APP_VERSION = app.getVersion();
// 定义应用信息，不可修改
// Define app info, immutable
const APP_INFO = Object.freeze({
    projectName: `${APP_ID} ${APP_VERSION}`
});

/**
 * Scratch Desktop 遥测管理类
 * 负责收集和发送应用的使用数据
 * Scratch Desktop Telemetry Manager Class
 * Responsible for collecting and sending application usage data
 */
class ScratchDesktopTelemetry {
    constructor () {
        this._telemetryClient = new TelemetryClient();
    }

    /**
     * 获取用户是否同意加入遥测计划
     * Get whether the user has opted in to the telemetry program
     */
    get didOptIn () {
        return this._telemetryClient.didOptIn;
    }
    
    /**
     * 设置用户是否同意加入遥测计划
     * Set whether the user has opted in to the telemetry program
     */
    set didOptIn (value) {
        this._telemetryClient.didOptIn = value;
    }

    /**
     * 记录应用打开事件
     * Record app open event
     */
    appWasOpened () {
        this._telemetryClient.addEvent('app::open', {...EVENT_TEMPLATE, ...APP_INFO});
    }

    /**
     * 记录应用关闭事件
     * Record app close event
     */
    appWillClose () {
        this._telemetryClient.addEvent('app::close', {...EVENT_TEMPLATE, ...APP_INFO});
    }

    /**
     * 记录项目加载完成事件
     * Record project load completed event
     * @param {object} metadata - 项目元数据 / Project metadata
     */
    projectDidLoad (metadata = {}) {
        this._telemetryClient.addEvent('project::load', this._buildMetadata(metadata));
    }

    /**
     * 记录项目保存触发事件（暂存元数据）
     * Record project save triggered event (stage metadata)
     * @param {object} metadata - 项目元数据 / Project metadata
     */
    projectDidSave (metadata = {}) {
        // Since the save dialog appears on the main process the GUI does not wait for the actual save to complete.
        // That means the GUI sends this event before we know the file name used for the save, which is where the new
        // project title comes from. Instead, just hold on to this metadata pending a `projectSaveCompleted` event
        // from the save code on the main process. If the user cancels the save this data will be cleared.
        
        // 由于保存对话框出现在主进程中，GUI 不会等待实际保存完成。
        // 这意味着 GUI 在我们知道用于保存的文件名（新项目标题的来源）之前就发送了这个事件。
        // 因此，我们只需暂存此元数据，等待主进程保存代码发出的 `projectSaveCompleted` 事件。
        // 如果用户取消保存，此数据将被清除。
        this._pendingProjectSave = metadata;
    }

    /**
     * 记录项目保存完成事件
     * Record project save completed event
     * @param {string} newProjectTitle - 新的项目标题 / New project title
     */
    projectSaveCompleted (newProjectTitle) {
        const metadata = this._pendingProjectSave;
        this._pendingProjectSave = null;

        metadata.projectName = newProjectTitle;
        this._telemetryClient.addEvent('project::save', this._buildMetadata(metadata));
    }

    /**
     * 处理项目保存取消事件
     * Handle project save canceled event
     */
    projectSaveCanceled () {
        this._pendingProjectSave = null;
    }

    /**
     * 记录新项目创建事件
     * Record new project created event
     * @param {object} metadata - 项目元数据 / Project metadata
     */
    projectWasCreated (metadata = {}) {
        this._telemetryClient.addEvent('project::create', this._buildMetadata(metadata));
    }

    /**
     * 记录项目上传事件
     * Record project uploaded event
     * @param {object} metadata - 项目元数据 / Project metadata
     */
    projectWasUploaded (metadata = {}) {
        this._telemetryClient.addEvent('project::upload', this._buildMetadata(metadata));
    }

    /**
     * 构建完整的元数据对象
     * Build complete metadata object
     * @param {object} metadata - 原始元数据 / Raw metadata
     * @returns {object} - 合并后的元数据 / Merged metadata
     */
    _buildMetadata (metadata) {
        const {projectName, language, ...codeMetadata} = metadata;
        return defaultsDeep({
            projectName,
            language,
            metadata: codeMetadata
        }, EVENT_TEMPLATE);
    }
}

// make a singleton so it's easy to share across both Electron processes
// 创建单例，以便在两个 Electron 进程之间轻松共享
const scratchDesktopTelemetrySingleton = new ScratchDesktopTelemetry();

// IPC 监听器设置，用于处理渲染进程发来的消息
// IPC listener setup for handling messages from the renderer process

// `handle` works with `invoke` (异步调用)
// `handle` 配合 `invoke` 使用
ipcMain.handle('getTelemetryDidOptIn', () =>
    scratchDesktopTelemetrySingleton.didOptIn
);

// `on` works with `sendSync` (and `send`) (同步/异步发送)
// `on` 配合 `sendSync`（和 `send`）使用
ipcMain.on('getTelemetryDidOptIn', event => {
    event.returnValue = scratchDesktopTelemetrySingleton.didOptIn;
});
ipcMain.on('setTelemetryDidOptIn', (event, arg) => {
    scratchDesktopTelemetrySingleton.didOptIn = arg;
});
ipcMain.on('projectDidLoad', (event, arg) => {
    scratchDesktopTelemetrySingleton.projectDidLoad(arg);
});
ipcMain.on('projectDidSave', (event, arg) => {
    scratchDesktopTelemetrySingleton.projectDidSave(arg);
});
ipcMain.on('projectWasCreated', (event, arg) => {
    scratchDesktopTelemetrySingleton.projectWasCreated(arg);
});
ipcMain.on('projectWasUploaded', (event, arg) => {
    scratchDesktopTelemetrySingleton.projectWasUploaded(arg);
});

export default scratchDesktopTelemetrySingleton;
