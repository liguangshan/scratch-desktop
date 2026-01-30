import React from 'react';
import {compose} from 'redux';
import GUI, {AppStateHOC} from '@scratch/scratch-gui';

import ScratchDesktopAppStateHOC from './ScratchDesktopAppStateHOC.jsx';
import ScratchDesktopGUIHOC from './ScratchDesktopGUIHOC.jsx';
import styles from './app.css';

// 获取应用挂载的 DOM 元素
// Get the DOM element where the app will be mounted
const appTarget = document.getElementById('app');
// 设置应用容器的类名，用于应用样式
// Set the class name for the app container to apply styles
appTarget.className = styles.app || 'app';

// 设置 GUI 的应用元素，通常用于模态框等组件定位
// Set the app element for GUI, usually used for positioning modals and other components
GUI.setAppElement(appTarget);

// note that redux's 'compose' function is just being used as a general utility to make
// the hierarchy of HOC constructor calls clearer here; it has nothing to do with redux's
// ability to compose reducers.
// 注意，这里使用 redux 的 'compose' 函数仅仅是作为一个通用工具，
// 为了让 HOC（高阶组件）构造函数的调用层级更清晰；
// 它与 redux 组合 reducer 的能力无关。

// 使用 compose 将多个高阶组件 (HOC) 组合在一起包裹 GUI 组件
// Use compose to wrap the GUI component with multiple Higher-Order Components (HOCs)
// 执行顺序是从右到左（从下到上）：
// Execution order is right-to-left (bottom-to-top):
// 1. ScratchDesktopGUIHOC(GUI)
// 2. AppStateHOC(...)
// 3. ScratchDesktopAppStateHOC(...)
const WrappedGui = compose(
    ScratchDesktopAppStateHOC, // 处理 Scratch Desktop 特有的应用状态 / Handles Scratch Desktop specific app state
    AppStateHOC,               // 处理通用的 Scratch GUI 状态 / Handles general Scratch GUI state
    ScratchDesktopGUIHOC       // 处理 Scratch Desktop 特有的 GUI 逻辑 / Handles Scratch Desktop specific GUI logic
)(GUI);

// 导出封装后的组件
// Export the wrapped component
export default <WrappedGui />;
