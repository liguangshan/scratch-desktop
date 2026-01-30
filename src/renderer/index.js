// This file does async imports of the heavy JSX, especially app.jsx, to avoid blocking the first render.
// The main index.html just contains a loading/splash screen which will display while this import loads.
// 该文件对较重的 JSX（特别是 app.jsx）进行异步导入，以避免阻塞首次渲染。
// 主 index.html 仅包含一个加载/启动屏幕，该屏幕将在此导入加载期间显示。

import {ipcRenderer} from 'electron';

import ReactDOM from 'react-dom';
import log from '../common/log.js';

// 监听 'ready-to-show' 事件，当主窗口准备好显示时触发
// Listen for 'ready-to-show' event, triggered when the main window is ready to show
ipcRenderer.on('ready-to-show', () => {
    // Start without any element in focus, otherwise the first link starts with focus and shows an orange box.
    // We shouldn't disable that box or the focus behavior in case someone wants or needs to navigate that way.
    // This seems like a hack... maybe there's some better way to do avoid any element starting with focus?
    
    // 启动时不让任何元素获得焦点，否则第一个链接会获得焦点并显示橙色框。
    // 我们不应该禁用该框或焦点行为，以防有人想要或需要以这种方式导航。
    // 这看起来像是一个临时变通方案... 也许有更好的方法来避免任何元素一开始就获得焦点？
    document.activeElement.blur();
});

// 从 URL 查询参数中获取路由，默认为 'app'
// Get the route from URL search params, defaulting to 'app'
const route = new URLSearchParams(window.location.search).get('route') || 'app';
let routeModulePromise;

// 根据路由动态导入相应的模块
// Dynamically import the corresponding module based on the route
switch (route) {
case 'app':
    routeModulePromise = import('./app.jsx'); // 主应用界面 / Main app interface
    break;
case 'about':
    routeModulePromise = import('./about.jsx'); // 关于界面 / About interface
    break;
case 'privacy':
    routeModulePromise = import('./privacy.jsx'); // 隐私政策界面 / Privacy policy interface
    break;
case 'usb':
    routeModulePromise = import('./usb.jsx'); // USB 设备连接界面 / USB device connection interface
    break;
}

// 当模块加载完成后，将其渲染到页面上
// When the module is loaded, render it to the page
routeModulePromise.then(routeModule => {
    const appTarget = document.getElementById('app');
    const routeElement = routeModule.default;
    ReactDOM.render(routeElement, appTarget);
}).catch(error => log.error('Error rendering app: ', error)); // 捕获并记录渲染错误 / Catch and log rendering errors
