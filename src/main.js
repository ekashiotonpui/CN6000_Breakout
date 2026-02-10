let currentSceneId = null;
let historyStack = [];
let appData = window.SCENARIO_DATA || null; 

window.onload = async () => {
    console.log("🚀 Simulator starting...");

    if (!appData) {
        try {
            const response = await fetch('/data/scenario.json');
            if (!response.ok) throw new Error("File not found");
            appData = await response.json();
        } catch (e) {
            console.error(e);
            alert("Failed on reading data");
            return;
        }
    }

setupNavigation();
    await populateImageDropdown();

    if (appData && appData.start_scene) {
        loadScene(appData.start_scene, false);
    }
      
    window.addEventListener('keydown', (e) => {
        if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'e') {
            const devTools = document.getElementById('dev-tools');
            if (devTools) {
                devTools.style.display = (devTools.style.display === 'none') ? 'block' : 'none';
                if (!window.devToolsInitialized) {
                    setupDevTools();
                    window.devToolsInitialized = true;
                    console.log("🛠 Edit Mode Initialized");
                }
            }
        }
    });
};

async function populateImageDropdown() {
    const select = document.getElementById('dev-target');
    if (!select || select.tagName !== 'SELECT') return;

    try {
        const res = await fetch('/api/images');
        if (!res.ok) return;
        const images = await res.json();
        images.sort();
        select.innerHTML = '<option value="">(Select image)</option>';
        images.forEach(img => {
            const option = document.createElement('option');
            option.value = img;
            option.textContent = img;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Failed to get image list:", e);
    }
}

function setupNavigation() {
    const btnBack = document.getElementById('btn-back');
    const btnHome = document.getElementById('btn-home');
    
    btnBack.onclick = () => {
        if (historyStack.length > 0) loadScene(historyStack.pop(), true);
    };

    btnHome.onclick = () => {
        const homeSceneId = appData.start_scene || '00_Front_00.webp';
        
        if (currentSceneId === homeSceneId) return;
        
        historyStack = [];
        loadScene(homeSceneId, false);
        console.log("🏠 Home Scene Loaded:", homeSceneId);
    };

	window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
            if (historyStack.length > 0) {
                e.preventDefault();
                loadScene(historyStack.pop(), true);
            }
        }

        if (e.key.toLowerCase() === 'home') {
            const homeSceneId = appData.scenes['00_Front_00.webp'] ? '00_Front_00.webp' : 
                               (appData.scenes['00_Front_00'] ? '00_Front_00' : appData.start_scene);
            
            if (currentSceneId !== homeSceneId) {
                e.preventDefault();
                historyStack = [];
                loadScene(homeSceneId, false);
                console.log("🏠 Key 'Home' pressed: Returning to Home");
            }
        }
    });
}


function loadScene(sceneId, isBack = false) {
    const scene = appData.scenes[sceneId];
    const imgEl = document.getElementById('main-image');
    const wrapper = document.getElementById('image-wrapper');
    
    if (!scene) {
        if (sceneId.match(/\.(jpg|jpeg|png|webp)$/i)) {
             imgEl.src = getAsset(sceneId);
    //         document.getElementById('scene-title').textContent = "Unresigter: " + sceneId;
             updateHistory(sceneId, isBack); 
             currentSceneId = sceneId;
             if(window.clearDevSelection) window.clearDevSelection();
             renderOverlays({ hotspots: [], annotations: [] });
             updateBackButtonState();
             return;
        }
        return alert("Scene not found: " + sceneId);
    }

    updateHistory(sceneId, isBack);
    currentSceneId = sceneId;
 //   document.getElementById('scene-title').textContent = scene.title || scene.image;
    
    imgEl.src = getAsset(scene.image);

    imgEl.onload = () => {
        resizeWrapperToImage();
    };
    
    if(window.clearDevSelection) window.clearDevSelection();
    
    renderOverlays(scene);
    updateBackButtonState();
}

function resizeWrapperToImage() {
    console.log("📏 CSSによる自動追従を適用中");
}

function updateHistory(nextSceneId, isBack) {
    if (!isBack && currentSceneId && currentSceneId !== nextSceneId) {
        historyStack.push(currentSceneId);
    }
}

function updateBackButtonState() {
    const btnBack = document.getElementById('btn-back');
    if (!btnBack) return;
    btnBack.disabled = (historyStack.length === 0);
    btnBack.style.opacity = (historyStack.length === 0) ? "0.5" : "1.0";
    btnBack.style.cursor = (historyStack.length === 0) ? "default" : "pointer";
}

function getAsset(filename) {
    if (window.ASSETS && window.ASSETS[filename]) return window.ASSETS[filename];
    return '/assets/' + filename; 
}


function renderOverlays(scene) {
    const container = document.getElementById('overlay-layer');
    if (!container) return;
    container.innerHTML = ''; 

    const createEl = (data, index, type) => {
        const el = document.createElement('div');
        el.className = type; 
        el.style.top = data.rect[0] + '%';
        el.style.left = data.rect[1] + '%';
        
        if (type === 'hotspot') {
            el.style.width = data.rect[2] + '%';
            el.style.height = data.rect[3] + '%';
            const area = data.rect[2] * data.rect[3];
            el.style.zIndex = Math.floor(10000 - area);
        } else {
            el.style.zIndex = 10001;
        }
        
        el.title = data.label || data.text || '';
        el.dataset.index = index;
        el.dataset.type = type;

        el.onclick = (e) => {
            const isEditMode = document.getElementById('dev-mode-toggle').checked;
            if (isEditMode) {
                e.preventDefault();
                e.stopPropagation();
                window.selectForEdit(index, type, data);
            } else {
                if (type === 'hotspot') loadScene(data.target_scene, false);
            }
        };

        el.oncontextmenu = (e) => {
            const isEditMode = document.getElementById('dev-mode-toggle').checked;
            if (isEditMode) {
                e.preventDefault();
                el.style.pointerEvents = 'none';
                el.style.opacity = '0.3';
                setTimeout(() => {
                    el.style.pointerEvents = 'auto';
                    el.style.opacity = '1';
                }, 3000);
            }
        };

        if (type === 'annotation') {
            el.onmouseenter = (e) => showTooltip(e, data.text);
            el.onmouseleave = hideTooltip;
        }
        return el;
    };

    if (scene.hotspots) {
        scene.hotspots.forEach((spot, i) => container.appendChild(createEl(spot, i, 'hotspot')));
    }
    if (scene.annotations) {
        scene.annotations.forEach((note, i) => container.appendChild(createEl(note, i, 'annotation')));
    }
}

let tooltipEl = null;
function showTooltip(e, text) {
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tooltip';
        document.body.appendChild(tooltipEl);
    }
    tooltipEl.textContent = text;
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = (e.pageX + 15) + 'px';
    tooltipEl.style.top = (e.pageY + 15) + 'px';
}

function hideTooltip() { if (tooltipEl) tooltipEl.style.display = 'none'; }


// ==========================================
// 🛠 Developper tool
// ==========================================
function setupDevTools() {
    const toggle = document.getElementById('dev-mode-toggle');
    const panel = document.getElementById('dev-panel');
    const wrapper = document.getElementById('image-wrapper');
    const overlayLayer = document.getElementById('overlay-layer');
    const btnSave = document.getElementById('btn-save-json');
    const btnDelete = document.getElementById('btn-delete-json');
    const btnClear = document.getElementById('btn-clear-selection');
    const statusText = document.getElementById('edit-status-text');
    const containerTarget = document.getElementById('container-target');

    if (!toggle) return;

    let isDrawing = false, startX, startY, tempBox = null, currentRect = null, editingIndex = null, editingType = null;

const updateEditMode = () => {
        const isEdit = toggle.checked;
        const radios_checked = document.querySelector('input[name="dev-type"]:checked');
        const type = radios_checked ? radios_checked.value : 'hotspot';
        
        panel.style.display = isEdit ? 'block' : 'none';
        wrapper.style.cursor = isEdit ? (type === 'annotation' ? 'pointer' : 'crosshair') : 'default';

        overlayLayer.classList.remove('mode-hotspot', 'mode-annotation');
        if (isEdit) overlayLayer.classList.add('mode-' + type);

        if (type === 'annotation') containerTarget.style.display = 'none';
        else containerTarget.style.display = 'block';

        if (!isEdit) clearSelection();
    };

    toggle.onchange = updateEditMode;
    const radios = document.getElementsByName('dev-type');
    for (const r of radios) {
        r.addEventListener('change', () => {
            updateEditMode();
            clearSelection();
        });
    }

    window.selectForEdit = (index, type, data) => {
        editingIndex = index;
        editingType = type;
        const select = document.getElementById('dev-target');
        if (data.target_scene) select.value = data.target_scene;
        else select.selectedIndex = 0;
        document.getElementById('dev-label').value = data.label || data.text || '';
        for(let r of radios) if (r.value === type) r.checked = true;
        updateEditMode();
        currentRect = data.rect;
        statusText.textContent = `📝 Edit Mode (Index: ${index})`;
        statusText.style.color = '#ffaa00';
        btnSave.textContent = '🔄 Renew';
        btnDelete.style.display = 'block';
        btnClear.style.display = 'inline';
        
        document.querySelectorAll('.hotspot, .annotation').forEach(el => {
            if (el.classList.contains('hotspot')) el.style.border = '2px solid rgba(0,255,0,0.5)';
            if (el.classList.contains('annotation')) el.style.border = '2px solid white';
            if(parseInt(el.dataset.index) === index && el.dataset.type === type) {
                el.style.border = '3px solid #ffaa00';
                if (type === 'hotspot') el.style.background = 'rgba(255, 170, 0, 0.3)';
                else el.style.transform = 'translate(-50%, -50%) scale(1.2)';
            }
        });
    };

    window.clearDevSelection = clearSelection;
    function clearSelection() {
        editingIndex = null;
        editingType = null;
        currentRect = null;
        if(tempBox) { tempBox.remove(); tempBox = null; }
        document.getElementById('dev-target').value = '';
        document.getElementById('dev-label').value = '';
        statusText.textContent = '✨ New creation mode';
        statusText.style.color = '#aaa';
        btnSave.textContent = '💾 Save';
        btnDelete.style.display = 'none';
        btnClear.style.display = 'none';
        if(currentSceneId && appData.scenes[currentSceneId]) renderOverlays(appData.scenes[currentSceneId]);
    }
    btnClear.onclick = (e) => { e.preventDefault(); clearSelection(); };

    wrapper.onmousedown = (e) => {
        if (!toggle.checked) return;
        if (e.target !== wrapper && e.target !== document.getElementById('main-image') && e.target !== overlayLayer) return;
        e.preventDefault(); 
        const type = document.querySelector('input[name="dev-type"]:checked').value;
        const rect = wrapper.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        if (type === 'annotation') {
            if (editingIndex !== null) clearSelection();
            currentRect = [Number(mouseY.toFixed(2)), Number(mouseX.toFixed(2)), 0, 0];
            if (tempBox) tempBox.remove();
            tempBox = document.createElement('div');
            tempBox.className = 'annotation';
            tempBox.style.top = mouseY + '%';
            tempBox.style.left = mouseX + '%';
            tempBox.style.pointerEvents = 'none';
            overlayLayer.appendChild(tempBox);
            document.getElementById('dev-label').focus();
            return;
        }

        isDrawing = true;
        if (editingIndex !== null) clearSelection();
        startX = mouseX;
        startY = mouseY;
        if (tempBox) tempBox.remove();
        tempBox = document.createElement('div');
        tempBox.className = 'hotspot';
        tempBox.style.background = 'rgba(255,0,0,0.3)';
        tempBox.style.border = '2px solid red';
        tempBox.style.left = startX + '%';
        tempBox.style.top = startY + '%';
        tempBox.style.pointerEvents = 'none';
        overlayLayer.appendChild(tempBox);
    };

    wrapper.onmousemove = (e) => {
        if (!isDrawing || !toggle.checked) return;
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const currentX = ((e.clientX - rect.left) / rect.width) * 100;
        const currentY = ((e.clientY - rect.top) / rect.height) * 100;
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        tempBox.style.left = left + '%';
        tempBox.style.top = top + '%';
        tempBox.style.width = width + '%';
        tempBox.style.height = height + '%';
    };

    wrapper.onmouseup = (e) => {
        if (!isDrawing || !toggle.checked) return;
        isDrawing = false;
        if (!tempBox || !tempBox.style.width || parseFloat(tempBox.style.width) < 0.5) {
            if(tempBox) tempBox.remove();
            return;
        }
        const t = parseFloat(tempBox.style.top).toFixed(2);
        const l = parseFloat(tempBox.style.left).toFixed(2);
        const w = parseFloat(tempBox.style.width).toFixed(2);
        const h = parseFloat(tempBox.style.height).toFixed(2);
        currentRect = [Number(t), Number(l), Number(w), Number(h)];
        document.getElementById('dev-target').focus();
    };

    btnSave.onclick = () => {
        if (!currentRect && editingIndex === null) return alert("Specify the location");
        const type = document.querySelector('input[name="dev-type"]:checked').value;
        const target = document.getElementById('dev-target').value;
        const label = document.getElementById('dev-label').value;
        if (type === 'hotspot' && !target) return alert("Select destination Image ");
        const itemData = { rect: currentRect, target_scene: target, label: label, type: type };
        const apiEndpoint = (editingIndex === null) ? '/api/add' : '/api/update';
        const payload = { sceneId: currentSceneId, index: editingIndex, item: itemData };
        fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            appData.scenes[currentSceneId] = data.updatedScene;
            loadScene(currentSceneId, true);
            clearSelection();
        })
        .catch(console.error);
    };

    btnDelete.onclick = () => {
        if (editingIndex === null) return;
        if (!confirm("Are you sure to delete？")) return;
        fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneId: currentSceneId, index: editingIndex, type: editingType })
        })
        .then(res => res.json())
        .then(data => {
            appData.scenes[currentSceneId] = data.updatedScene;
            loadScene(currentSceneId, true);
            clearSelection();
        })
        .catch(console.error);
    };
}

window.onresize = () => {
    resizeWrapperToImage();
};