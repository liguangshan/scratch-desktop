import minimist from 'minimist';

// inspired by yargs' process-argv
// 灵感来自 yargs 的 process-argv

/**
 * 判断是否为 Electron 应用
 * Check if the application is running in Electron
 */
export const isElectronApp = () => !!process.versions.electron;

/**
 * 判断是否为打包后的 Electron 应用
 * Check if the application is running as a bundled Electron app
 */
export const isElectronBundledApp = () => isElectronApp() && !process.defaultApp;

/**
 * 解析并修剪命令行参数
 * Parse and trim command line arguments
 * @param {string[]} argv - 原始命令行参数数组 / raw command line arguments
 * @returns {object} - 解析后的参数对象 / parsed arguments object
 */
export const parseAndTrimArgs = argv => {
    // bundled Electron app: ignore 1 from "my-app arg1 arg2"
    // unbundled Electron app: ignore 2 from "electron main/index.js arg1 arg2"
    // node.js app: ignore 2 from "node src/index.js arg1 arg2"
    
    // 打包后的 Electron 应用：忽略 1 个参数，例如 "my-app arg1 arg2"（忽略 my-app）
    // 未打包的 Electron 应用：忽略 2 个参数，例如 "electron main/index.js arg1 arg2"（忽略 electron 和 main/index.js）
    // node.js 应用：忽略 2 个参数，例如 "node src/index.js arg1 arg2"
    const ignoreCount = isElectronBundledApp() ? 1 : 2;

    const parsed = minimist(argv);

    // ignore arguments AFTER parsing to handle cases like "electron --inspect=42 my.js arg1 arg2"
    // 解析后忽略参数，以处理像 "electron --inspect=42 my.js arg1 arg2" 这样的情况
    parsed._ = parsed._.slice(ignoreCount);

    return parsed;
};

// 解析当前进程的命令行参数
// Parse command line arguments for the current process
const argv = parseAndTrimArgs(process.argv);

export default argv;
