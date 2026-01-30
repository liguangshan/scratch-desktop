const fs = require('fs');
const path = require('path');

const OUT_PATH = path.resolve('static', 'fetched');

const fetchAllAssets = function () {
    console.log('Skipping asset fetch due to network issues (Manual Override).');
    
    if (!fs.existsSync(OUT_PATH)) {
        try {
            fs.mkdirSync(OUT_PATH, { recursive: true });
            console.log(`Created directory: ${OUT_PATH}`);
        } catch (err) {
            console.error(`Error creating directory: ${err.message}`);
        }
    }
};

fetchAllAssets();
