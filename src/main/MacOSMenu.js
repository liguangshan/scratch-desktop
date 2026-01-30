// Include the standard keyboard shortcuts in the edit menu
// so they can be used within the app. Only needed on Mac.
// 在编辑菜单中包含标准键盘快捷键，以便它们可以在应用程序中使用。
// 仅在 Mac 上需要（Windows/Linux 通常由系统或 Electron 默认处理）。
export default app => ([
    {
        label: 'App', // Always overridden by app name / 总是被应用名称覆盖（例如 "Scratch 3"）
        submenu: [{
            label: 'Quit', // 退出
            accelerator: 'CmdOrCtrl+Q',
            click: () => app.quit()
        }]
    },
    {
        label: 'Edit', // 编辑
        submenu: [
            {
                label: 'Undo', // 撤销
                accelerator: 'CmdOrCtrl+Z',
                role: 'undo' // 使用 Electron 内置的撤销行为
            },
            {
                label: 'Redo', // 重做
                accelerator: 'Shift+CmdOrCtrl+Z',
                role: 'redo' // 使用 Electron 内置的重做行为
            },
            {
                type: 'separator' // 分隔线
            },
            {
                label: 'Cut', // 剪切
                accelerator: 'CmdOrCtrl+X',
                role: 'cut' // 使用 Electron 内置的剪切行为
            },
            {
                label: 'Copy', // 复制
                accelerator: 'CmdOrCtrl+C',
                role: 'copy' // 使用 Electron 内置的复制行为
            },
            {
                label: 'Paste', // 粘贴
                accelerator: 'CmdOrCtrl+V',
                role: 'paste' // 使用 Electron 内置的粘贴行为
            },
            {
                label: 'Select All', // 全选
                accelerator: 'CmdOrCtrl+A',
                role: 'selectall' // 使用 Electron 内置的全选行为
            }
        ]
    }
]);
