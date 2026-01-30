const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const cacheDir = path.resolve(__dirname, '..', 'cache');
const winCodeSignDir = path.join(cacheDir, 'winCodeSign');
// electron-builder expects the versioned folder inside winCodeSign
const targetDir = path.join(winCodeSignDir, 'winCodeSign-2.6.0');
const sevenZipPath = path.resolve(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
const downloadUrl = 'https://npmmirror.com/mirrors/electron-builder-binaries/winCodeSign-2.6.0/winCodeSign-2.6.0.7z';
const archivePath = path.join(winCodeSignDir, 'winCodeSign-2.6.0.7z');

if (fs.existsSync(targetDir)) {
    console.log('winCodeSign-2.6.0 already exists. Skipping.');
    process.exit(0);
}

if (!fs.existsSync(winCodeSignDir)) {
    fs.mkdirSync(winCodeSignDir, { recursive: true });
}

console.log(`Downloading winCodeSign from ${downloadUrl}...`);
const file = fs.createWriteStream(archivePath);

function download(url) {
    https.get(url, function(response) {
        if (response.statusCode === 302 || response.statusCode === 301) {
            console.log(`Redirecting to ${response.headers.location}...`);
            download(response.headers.location);
            return;
        }
        if (response.statusCode !== 200) {
            console.error(`Download failed with status code: ${response.statusCode}`);
            process.exit(1);
        }
        response.pipe(file);
        file.on('finish', function() {
            file.close(() => {
                console.log('Download completed.');
                console.log('Extracting (excluding darwin files)...');
                try {
                    // 7z extraction command
                    // x: extract with full paths
                    // -o: output directory
                    // -xr!darwin: exclude darwin directory recursively
                    // -y: assume yes
                    const cmd = `"${sevenZipPath}" x "${archivePath}" -o"${targetDir}" -xr!darwin -y`;
                    console.log(`Executing: ${cmd}`);
                    execSync(cmd, { stdio: 'inherit' });
                    console.log('Extraction completed successfully.');
                    
                    // Cleanup archive
                    try {
                        fs.unlinkSync(archivePath);
                    } catch (e) {
                        console.warn('Failed to delete archive:', e.message);
                    }
                } catch (e) {
                    console.error('Extraction failed:', e);
                    process.exit(1);
                }
            });
        });
    }).on('error', function(err) {
        fs.unlink(archivePath, () => {});
        console.error('Download error:', err.message);
        process.exit(1);
    });
}

download(downloadUrl);
