const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const JSON_PATH = path.join(__dirname, 'data', 'scenario.json');
const ASSETS_PATH = path.join(__dirname, 'assets');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('src')); 
app.use('/assets', express.static('assets'));
app.use('/data', express.static('data'));

function updateJson(callback, res) {
    fs.readFile(JSON_PATH, 'utf8', (err, data) => {
        if (err) {
            console.error("Read Error:", err);
            return res.status(500).send('Error reading JSON');
        }
        
        let json;
        try {
            json = JSON.parse(data);
        } catch (e) {
            console.warn("JSON parse error (might be empty), initializing new.");
            json = { start_scene: "00_Front_00.webp", scenes: {} };
        }
        
        try {
            const result = callback(json);
            fs.writeFile(JSON_PATH, JSON.stringify(json, null, 2), (err) => {
                if (err) {
                    console.error("Write Error:", err);
                    return res.status(500).send('Error writing JSON');
                }
                res.send({ status: 'OK', updatedScene: result });
            });
        } catch (e) {
            console.error("Update Logic Error:", e);
            res.status(500).send('Error updating data');
        }
    });
}

app.get('/api/images', (req, res) => {
    fs.readdir(ASSETS_PATH, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading assets directory');
        }
        const images = files.filter(file => file.match(/\.(jpg|jpeg|png|webp|dat)$/i));
        res.json(images);
    });
});

app.post('/api/add', (req, res) => {
    const { sceneId, item } = req.body;
    updateJson((json) => {
        if (!json.scenes[sceneId]) {
            json.scenes[sceneId] = { image: sceneId, title: sceneId, hotspots: [], annotations: [] };
        }
        const list = item.type === 'annotation' ? 'annotations' : 'hotspots';
        if (!json.scenes[sceneId][list]) json.scenes[sceneId][list] = [];
        
        const newItem = { ...item };
        if (item.type === 'annotation') {
            newItem.text = item.label;
            delete newItem.label;
        }
        json.scenes[sceneId][list].push(newItem);
        return json.scenes[sceneId];
    }, res);
});

app.post('/api/update', (req, res) => {
    const { sceneId, index, item } = req.body;
    updateJson((json) => {
        const list = item.type === 'annotation' ? 'annotations' : 'hotspots';
        const newItem = { ...item };
        if (item.type === 'annotation') {
            newItem.text = item.label;
            delete newItem.label;
        }
        json.scenes[sceneId][list][index] = newItem;
        return json.scenes[sceneId];
    }, res);
});

app.post('/api/delete', (req, res) => {
    const { sceneId, index, type } = req.body;
    updateJson((json) => {
        const list = type === 'annotation' ? 'annotations' : 'hotspots';
        json.scenes[sceneId][list].splice(index, 1);
        return json.scenes[sceneId];
    }, res);
});

app.listen(PORT, () => {
    console.log(`\n🚀 Launch Developper Server: http://localhost:${PORT}`);
});