const fs = require('fs');
const path = require('path');

const paths = process.argv.slice(2);

paths.forEach(p => {
    const fullPath = path.resolve(process.cwd(), p);
    try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`Deleted ${p}`);
    } catch (err) {
        console.error(`Error deleting ${p}:`, err);
        process.exit(1);
    }
});
