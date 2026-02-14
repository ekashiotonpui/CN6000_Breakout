const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CONFIG = {
    assetsDir: './assets',
    srcDir: './src',
    outputFile: './index.html',
    imageQuality: 75,
    resizeWidth: 1280 // 軽量化のため幅を1280pxにリサイズ
};

(async () => {
    console.log('🚀 ビルド開始...');

    // 1. 画像処理
    const files = fs.readdirSync(CONFIG.assetsDir);
    const assetsData = {};
    console.log(`📦 画像処理中 (${files.length}枚)...`);

    for (const file of files) {
        if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
            const filePath = path.join(CONFIG.assetsDir, file);
            // リサイズ + WebP変換 + Base64化
            const buffer = await sharp(filePath)
                .resize({ width: CONFIG.resizeWidth, withoutEnlargement: true })
                .webp({ quality: CONFIG.imageQuality })
                .toBuffer();
            assetsData[file] = `data:image/webp;base64,${buffer.toString('base64')}`;
        }
    }

    // 2. ソース読み込み
    let html = fs.readFileSync(path.join(CONFIG.srcDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(CONFIG.srcDir, 'style.css'), 'utf8');
    const js = fs.readFileSync(path.join(CONFIG.srcDir, 'main.js'), 'utf8');
    const scenario = fs.readFileSync('./data/scenario.json', 'utf8');

    // 3. 埋め込み処理
    const injectionScript = `
    <script>
        window.ASSETS = ${JSON.stringify(assetsData)};
        window.SCENARIO_DATA = ${scenario};
    </script>
    `;

    // CSS埋め込み
    html = html.replace('</head>', `<style>${css}</style></head>`);
    
    // JSとデータの埋め込み (bodyの閉じタグ直前)
    html = html.replace('</body>', `${injectionScript}<script>${js}</script></body>`);

    // 外部ファイル参照の削除 (<link>や<script src=>)
    html = html.replace(/<link rel="stylesheet".*?>/g, '');
    html = html.replace(/<script src=".*?".*?><\/script>/g, '');

    fs.writeFileSync(CONFIG.outputFile, html);
    
    const sizeMB = (fs.statSync(CONFIG.outputFile).size / 1024 / 1024).toFixed(2);
    console.log(`✅ ビルド完了！ 出力ファイル: ${CONFIG.outputFile}`);
    console.log(`📊 ファイルサイズ: ${sizeMB} MB`);
})();