// 定义文件保存过滤器，用于文件保存对话框
// Define file save filters, used for file save dialogs
const saveFilters = {
    JPEG: {
        name: 'JPEG Image',
        extensions: ['jpg', 'jpeg']
    },
    MP3: {
        name: 'MP3 Sound',
        extensions: ['mp3']
    },
    PNG: {
        name: 'PNG Image',
        extensions: ['png']
    },
    SB: {
        name: 'Scratch 1 Project', // Scratch 1.x 项目文件
        extensions: ['sb']
    },
    SB2: {
        name: 'Scratch 2 Project', // Scratch 2.0 项目文件
        extensions: ['sb2']
    },
    SB3: {
        name: 'Scratch 3 Project', // Scratch 3.0 项目文件
        extensions: ['sb3']
    },
    Sprite2: {
        name: 'Scratch 2 Sprite', // Scratch 2.0 角色文件
        extensions: ['sprite2']
    },
    Sprite3: {
        name: 'Scratch 3 Sprite', // Scratch 3.0 角色文件
        extensions: ['sprite3']
    },
    SVG: {
        name: 'SVG Image',
        extensions: ['svg']
    },
    WAV: {
        name: 'WAV Sound',
        extensions: ['wav']
    }
};

// 定义文件加载过滤器，用于文件打开对话框
// 包含基本的保存过滤器，并增加了一些聚合过滤器
// Define file load filters, used for file open dialogs
// Includes basic save filters and adds some aggregated filters
const loadFilters = {
    ...saveFilters,
    AllBitmaps: {
        name: 'All Bitmaps', // 所有位图图像
        extensions: [
            ...saveFilters.JPEG.extensions,
            ...saveFilters.PNG.extensions
        ]
    },
    AllImages: {
        name: 'All Images', // 所有图像（位图和矢量图）
        extensions: [
            ...saveFilters.JPEG.extensions,
            ...saveFilters.PNG.extensions,
            ...saveFilters.SVG.extensions
        ]
    },
    AllProjects: {
        name: 'All Scratch Projects', // 所有版本的 Scratch 项目
        extensions: [
            ...saveFilters.SB3.extensions,
            ...saveFilters.SB2.extensions,
            ...saveFilters.SB.extensions
        ]
    },
    AllSounds: {
        name: 'All Sounds', // 所有音频文件
        extensions: [
            ...saveFilters.MP3.extensions,
            ...saveFilters.WAV.extensions
        ]
    },
    AllSprites: {
        name: 'All Sprites', // 所有版本的 Scratch 角色
        extensions: [
            ...saveFilters.Sprite3.extensions,
            ...saveFilters.Sprite2.extensions
        ]
    }
};

// 构建一个从扩展名到过滤器对象的映射，用于快速查找
// Build a map from extension to filter object for quick lookup
const filtersByExtension = Object.values(saveFilters).reduce((result, filter) => {
    for (const extension of filter.extensions) {
        result[extension] = filter;
    }
    return result;
}, {});

/**
 * 根据文件扩展名获取对应的过滤器对象
 * 如果找不到匹配的过滤器，则返回一个通用的过滤器对象
 * Get the filter object corresponding to the file extension
 * If no matching filter is found, return a generic filter object
 *
 * @param {string} extNameNoDot - 不带点的文件扩展名 / file extension without dot
 * @returns {object} - 过滤器对象 / filter object
 */
const getFilterForExtension = extNameNoDot =>
    filtersByExtension[extNameNoDot] || {
        name: `${extNameNoDot.toUpperCase()} Files`,
        extensions: [extNameNoDot]
    };

export {
    saveFilters,
    loadFilters,
    getFilterForExtension
};
