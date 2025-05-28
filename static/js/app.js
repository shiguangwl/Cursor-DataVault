// ===== 全新现代化JavaScript应用 =====

// 全局变量
let currentSelectedKey = null;
let allKeys = [];
let filteredKeys = [];
let jsonEditorInstance = null;
let appConfig = null;
let currentSelectedFile = null;
let currentSearchMode = 'key'; // 'key' 或 'global'
let searchResults = [];
let isGlobalSearching = false;

// 应用初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
async function initializeApp() {
    showLoadingState();
    
    try {
        // 加载配置
        await loadConfig();
        
        // 加载数据
        await loadKeys();
        initializeCodeMirror();
        setupEventListeners();
        setupKeyboardShortcuts();
        showWelcomeScreen();
        
        // 显示加载完成通知
        showNotification('应用加载完成', 'success');
    } catch (error) {
        console.error('应用初始化失败:', error);
        showNotification('应用初始化失败: ' + error.message, 'error');
    }
    
    hideLoadingState();
}

// 加载配置
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        
        appConfig = data.config || {};
        return appConfig;
    } catch (error) {
        console.error('加载配置失败:', error);
        appConfig = {};
        throw error;
    }
}

// 显示加载状态
function showLoadingState() {
    document.body.style.cursor = 'wait';
}

// 隐藏加载状态
function hideLoadingState() {
    document.body.style.cursor = 'default';
}

// 设置事件监听器
function setupEventListeners() {
    const searchInput = document.getElementById('keySearch');
    const searchClear = document.getElementById('searchClear');
    const settingsBtn = document.querySelector('.settings-btn');
    const refreshBtn = document.querySelector('.refresh-btn');
    const keySearchModeBtn = document.getElementById('keySearchMode');
    const globalSearchModeBtn = document.getElementById('globalSearchMode');
    
    // 搜索功能
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keydown', handleSearchKeydown);
    }
    
    // 清除搜索
    if (searchClear) {
        searchClear.addEventListener('click', clearSearch);
    }
    
    // 搜索模式切换
    if (keySearchModeBtn) {
        keySearchModeBtn.addEventListener('click', () => setSearchMode('key'));
    }
    
    if (globalSearchModeBtn) {
        globalSearchModeBtn.addEventListener('click', () => setSearchMode('global'));
    }
    
    // 设置按钮
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showSettingsModal);
    }
    
    // 刷新按钮
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
    
    // 窗口调整大小
    window.addEventListener('resize', handleWindowResize);
}

// 设置键盘快捷键
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K 聚焦搜索
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('keySearch')?.focus();
        }
        
        // Escape 清除搜索或关闭模态框
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
            if (activeModal) {
                closeConfirmModal();
            } else {
                clearSearch();
            }
        }
        
        // Ctrl/Cmd + S 保存当前编辑
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && currentSelectedKey) {
            e.preventDefault();
            saveRecord();
        }
        
        // Ctrl/Cmd + F 格式化JSON
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && currentSelectedKey) {
            e.preventDefault();
            formatJSON();
        }
    });
}

// 初始化CodeMirror编辑器
function initializeCodeMirror() {
    const textarea = document.getElementById('jsonEditor');
    if (!textarea) return;
    
    jsonEditorInstance = CodeMirror.fromTextArea(textarea, {
        mode: 'application/json',
        theme: 'material-darker',
        lineNumbers: true,
        indentUnit: 2,
        smartIndent: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        lineWrapping: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        styleActiveLine: true,
        extraKeys: {
            "Ctrl-Q": function(cm) { cm.foldCode(cm.getCursor()); },
            "Ctrl-Space": "autocomplete",
            // 添加搜索快捷键
            "Ctrl-F": "findPersistent",
            "Cmd-F": "findPersistent",
            "Ctrl-G": "findNext",
            "Cmd-G": "findNext",
            "Shift-Ctrl-G": "findPrev",
            "Shift-Cmd-G": "findPrev",
            "Shift-Ctrl-F": "replace",
            "Shift-Cmd-F": "replace",
            "Shift-Ctrl-R": "replaceAll",
            "Shift-Cmd-R": "replaceAll"
        }
    });
    
    // 监听编辑器内容变化
    jsonEditorInstance.on('change', function() {
        updateEditorStatus();
    });
    
    // 窗口大小调整时刷新编辑器
    window.addEventListener('resize', () => {
        setTimeout(() => {
            if (jsonEditorInstance) {
                jsonEditorInstance.refresh();
            }
        }, 100);
    });
}

// 加载所有Keys
async function loadKeys() {
    try {
        const response = await fetch('/api/keys');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        
        allKeys = data.keys || [];
        filteredKeys = [...allKeys];
        
        updateKeysList();
        updateKeyCount();
        
    } catch (error) {
        console.error('加载Keys失败:', error);
        throw error;
    }
}

// 更新Keys列表显示
function updateKeysList() {
    const keysList = document.getElementById('keysList');
    const emptyState = document.getElementById('emptyState');
    
    if (!keysList) return;
    
    keysList.innerHTML = '';
    
    if (filteredKeys.length === 0) {
        keysList.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    keysList.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';
    
    filteredKeys.forEach((key) => {
        const keyItem = createKeyElement(key);
        keysList.appendChild(keyItem);
    });
}

// 创建Key元素
function createKeyElement(key) {
    const keyItem = document.createElement('div');
    keyItem.className = 'key-item';
    keyItem.dataset.key = key;
    keyItem.onclick = () => selectKey(key);
    
    // 添加选中状态
    if (currentSelectedKey === key) {
        keyItem.classList.add('selected');
    }
    
    // 安全处理key
    const safeKey = escapeHtml(key);
    
    keyItem.innerHTML = `
        <div class="key-content">
            <div class="key-icon">
                <i class="fas fa-key"></i>
            </div>
            <div class="key-info">
                <span class="key-name" title="${safeKey}">${safeKey}</span>
                <span class="key-type">String</span>
            </div>
        </div>
    `;
    
    return keyItem;
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 更新Key计数
function updateKeyCount() {
    const totalKeysElement = document.getElementById('totalKeys');
    if (totalKeysElement) {
        totalKeysElement.textContent = filteredKeys.length;
        
        // 添加动画效果
        totalKeysElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            totalKeysElement.style.transform = 'scale(1)';
        }, 200);
    }
}

// 处理搜索输入
async function handleSearchInput(event) {
    const searchTerm = event.target.value.trim();
    const searchClear = document.getElementById('searchClear');
    
    // 显示/隐藏清除按钮
    if (searchClear) {
        searchClear.style.display = event.target.value ? 'flex' : 'none';
    }
    
    if (currentSearchMode === 'key') {
        // 原有的Key搜索逻辑
        if (searchTerm === '') {
            clearSearch();
        } else {
            filterKeys();
        }
    } else if (currentSearchMode === 'global') {
        // 全局搜索逻辑
        if (searchTerm === '') {
            clearSearch();
        } else {
            await performGlobalSearch(searchTerm);
        }
    }
}

// 处理搜索键盘事件
function handleSearchKeydown(event) {
    if (event.key === 'Escape') {
        clearSearch();
    }
}

// 清除搜索
function clearSearch() {
    const searchInput = document.getElementById('keySearch');
    const searchClear = document.getElementById('searchClear');
    
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (searchClear) {
        searchClear.style.display = 'none';
    }
    
    // 根据当前搜索模式清除不同的状态
    if (currentSearchMode === 'key') {
        // Key搜索模式：显示所有key
        filterKeys();
    } else if (currentSearchMode === 'global') {
        // 全局搜索模式：清除搜索结果，显示所有key
        searchResults = [];
        filterKeys(); // 显示所有key
    }
    
    hideEmptyState();
}

// 过滤Keys
function filterKeys() {
    const searchInput = document.getElementById('keySearch');
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();
    
    let keysToFilter = allKeys;
    
    // 根据搜索词过滤
    if (searchTerm) {
        filteredKeys = keysToFilter.filter(key => 
            key.toLowerCase().includes(searchTerm)
        );
    } else {
        filteredKeys = [...keysToFilter];
    }
    
    updateKeysList();
    updateKeyCount();
}

// 选择Key
async function selectKey(key) {
    if (currentSelectedKey === key) return;
    
    try {
        // 更新选中状态
        const previousKey = currentSelectedKey;
        currentSelectedKey = key;
        
        // 更新UI选中状态
        document.querySelectorAll('.key-item').forEach(item => {
            if (item.dataset.key === key) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // 显示编辑器面板
        showEditorPanel();
        
        // 更新编辑器信息
        updateEditorInfo(key);
        
        // 加载记录
        await loadRecord(key);
    } catch (error) {
        console.error('选择Key失败:', error);
        showNotification('加载数据失败: ' + error.message, 'error');
    }
}

// 显示编辑器面板
function showEditorPanel() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const editorPanel = document.getElementById('editorPanel');
    
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (editorPanel) editorPanel.style.display = 'flex';
    
    // 刷新编辑器
    setTimeout(() => {
        if (jsonEditorInstance) {
            jsonEditorInstance.refresh();
        }
    }, 100);
}

// 显示欢迎屏幕
function showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const editorPanel = document.getElementById('editorPanel');
    
    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    if (editorPanel) editorPanel.style.display = 'none';
    
    currentSelectedKey = null;
    
    // 清除选中状态
    document.querySelectorAll('.key-item').forEach(item => {
        item.classList.remove('active');
    });
}

// 更新编辑器信息
function updateEditorInfo(key) {
    const currentKeyName = document.getElementById('currentKeyName');
    const keyTypeBadge = document.getElementById('keyTypeBadge');
    const keySize = document.getElementById('keySize');
    
    if (currentKeyName) {
        currentKeyName.textContent = key;
    }
    
    if (keyTypeBadge) {
        keyTypeBadge.textContent = 'String'; // 可以根据实际类型更新
    }
    
    if (keySize && jsonEditorInstance) {
        const content = jsonEditorInstance.getValue();
        const bytes = new Blob([content]).size;
        keySize.textContent = formatBytes(bytes);
    }
}

// 格式化字节数
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 加载记录数据
async function loadRecord(key) {
    try {
        updateEditorStatus('正在加载...');
        
        const response = await fetch(`/api/record/${encodeURIComponent(key)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || '加载失败');
        }
        
        displayRecord(result.data);
        updateEditorStatus('就绪');
        
    } catch (error) {
        console.error('加载记录失败:', error);
        showNotification('加载记录失败: ' + error.message, 'error');
        updateEditorStatus('加载失败');
    }
}

// 显示记录数据
function displayRecord(data) {
    if (!jsonEditorInstance) return;
    
    let jsonContent = '';
    
    if (data && data.value !== undefined && data.value !== null) {
        try {
            if (data.is_json && typeof data.value === 'object') {
                // 如果是JSON对象，格式化显示
                jsonContent = JSON.stringify(data.value, null, 2);
            } else if (data.is_json && typeof data.value === 'string') {
                // 如果是JSON字符串，尝试解析并格式化
                try {
                    const parsedValue = JSON.parse(data.value);
                    jsonContent = JSON.stringify(parsedValue, null, 2);
                } catch (e) {
                    jsonContent = data.value;
                }
            } else {
                // 如果不是JSON，直接显示原始值
                jsonContent = typeof data.value === 'string' ? data.value : JSON.stringify(data.value, null, 2);
            }
        } catch (e) {
            // 如果有任何错误，显示原始值
            jsonContent = data.raw_value || data.value?.toString() || '';
        }
    } else {
        jsonContent = '';
    }
    
    jsonEditorInstance.setValue(jsonContent);
    jsonEditorInstance.clearHistory();
    
    // 更新大小信息
    updateEditorInfo(currentSelectedKey);
}

// 更新编辑器状态
function updateEditorStatus(status = '就绪') {
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
        const icon = statusIndicator.querySelector('i');
        const text = statusIndicator.querySelector('i').nextSibling;
        
        if (status === '就绪') {
            icon.style.color = '#10b981';
            icon.className = 'fas fa-circle';
        } else if (status.includes('失败') || status.includes('错误')) {
            icon.style.color = '#ef4444';
            icon.className = 'fas fa-exclamation-circle';
        } else {
            icon.style.color = '#f59e0b';
            icon.className = 'fas fa-circle';
        }
        
        text.textContent = ' ' + status;
    }
}

// 格式化JSON
function formatJSON() {
    if (!jsonEditorInstance || !currentSelectedKey) {
        showNotification('请先选择一个Key', 'warning');
        return;
    }
    
    try {
        const content = jsonEditorInstance.getValue();
        const parsed = JSON.parse(content);
        const formatted = JSON.stringify(parsed, null, 2);
        
        jsonEditorInstance.setValue(formatted);
        showNotification('JSON格式化完成', 'success');
        updateEditorStatus('已格式化');
        
    } catch (error) {
        showNotification('JSON格式错误: ' + error.message, 'error');
        updateEditorStatus('格式错误');
    }
}

// 验证JSON
function validateJSON() {
    if (!jsonEditorInstance || !currentSelectedKey) {
        showNotification('请先选择一个Key', 'warning');
        return;
    }
    
    try {
        const content = jsonEditorInstance.getValue();
        JSON.parse(content);
        showNotification('JSON格式有效', 'success');
        updateEditorStatus('格式有效');
    } catch (error) {
        showNotification('JSON格式错误: ' + error.message, 'error');
        updateEditorStatus('格式错误');
    }
}

// 复制到剪贴板
async function copyToClipboard() {
    if (!jsonEditorInstance || !currentSelectedKey) {
        showNotification('请先选择一个Key', 'warning');
        return;
    }
    
    try {
        const content = jsonEditorInstance.getValue();
        await navigator.clipboard.writeText(content);
        showNotification('已复制到剪贴板', 'success');
    } catch (error) {
        console.error('复制失败:', error);
        showNotification('复制失败', 'error');
    }
}

// 保存记录
async function saveRecord() {
    if (!currentSelectedKey) {
        showNotification('请先选择一个Key', 'warning');
        return;
    }
    
    try {
        updateEditorStatus('正在保存...');
        
        const content = jsonEditorInstance.getValue();
        
        // 验证JSON（如果不为空）
        if (content.trim()) {
            try {
                JSON.parse(content);
            } catch (e) {
                // 如果不是有效JSON，询问用户是否继续
                if (!confirm('内容不是有效的JSON格式，是否作为普通文本保存？')) {
                    updateEditorStatus('保存取消');
                    return;
                }
            }
        }
        
        const response = await fetch(`/api/record/${encodeURIComponent(currentSelectedKey)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value: content })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || result.message || '保存失败');
        }
        
        showNotification('保存成功', 'success');
        updateEditorStatus('已保存');
        
        // 更新大小信息
        updateEditorInfo(currentSelectedKey);
        
    } catch (error) {
        console.error('保存失败:', error);
        showNotification('保存失败: ' + error.message, 'error');
        updateEditorStatus('保存失败');
    }
}

// 删除记录
function deleteRecord() {
    if (!currentSelectedKey) {
        showNotification('请先选择一个Key', 'warning');
        return;
    }
    
    showConfirmModal(
        '确认删除',
        `您确定要删除Key "${currentSelectedKey}" 吗？此操作无法撤销。`,
        async () => {
            try {
                const response = await fetch(`/api/record/${encodeURIComponent(currentSelectedKey)}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || result.message || '删除失败');
                }
                
                showNotification('删除成功', 'success');
                
                // 从各种列表中移除
                allKeys = allKeys.filter(key => key !== currentSelectedKey);
                filteredKeys = filteredKeys.filter(key => key !== currentSelectedKey);
                
                // 更新本地存储
                localStorage.setItem('favorites', JSON.stringify(favorites));
                localStorage.setItem('recentKeys', JSON.stringify(recentKeys));
                
                // 更新显示
                updateKeysList();
                updateKeyCount();
                showWelcomeScreen();
                
            } catch (error) {
                console.error('删除失败:', error);
                showNotification('删除失败: ' + error.message, 'error');
            }
        }
    );
}

// 显示确认模态框
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleElement = document.getElementById('confirmTitle');
    const messageElement = document.getElementById('confirmMessage');
    const confirmButton = document.getElementById('confirmButton');
    
    if (!modal) return;
    
    titleElement.textContent = title;
    messageElement.textContent = message;
    
    modal.style.display = 'flex';
    
    // 存储确认回调
    confirmButton.onclick = () => {
        onConfirm();
        closeConfirmModal();
    };
}

// 关闭确认模态框
function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 确认操作
function confirmAction() {
    // 这个函数会被confirmButton.onclick覆盖
}

// 显示通知
function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = getNotificationIcon(type);
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="${icon}" style="flex-shrink: 0;"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
    
    container.appendChild(notification);
    
    // 自动移除
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// 获取通知图标
function getNotificationIcon(type) {
    const icons = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-circle',
        'warning': 'fas fa-exclamation-triangle',
        'info': 'fas fa-info-circle'
    };
    return icons[type] || icons.info;
}

// 处理窗口大小调整
function handleWindowResize() {
    if (jsonEditorInstance) {
        setTimeout(() => jsonEditorInstance.refresh(), 100);
    }
}

// 兼容旧函数名
function refreshKeys() {
    refreshData();
}

function updateRecord() {
    saveRecord();
}

function formatJson() {
    formatJSON();
}

// 刷新数据
async function refreshData() {
    try {
        showLoadingState();
        
        // 显示刷新动画
        const refreshBtn = document.querySelector('.refresh-btn i');
        if (refreshBtn) {
            refreshBtn.classList.add('fa-spin');
        }
        
        // 重新加载数据
        await loadKeys();
        
        // 如果当前有选中的key，重新加载它
        if (currentSelectedKey) {
            await selectKey(currentSelectedKey);
        }
        
        showNotification('数据已刷新', 'success');
    } catch (error) {
        console.error('刷新数据失败:', error);
        showNotification('刷新数据失败: ' + error.message, 'error');
    } finally {
        // 停止刷新动画
        const refreshBtn = document.querySelector('.refresh-btn i');
        if (refreshBtn) {
            refreshBtn.classList.remove('fa-spin');
        }
        
        hideLoadingState();
    }
}

// 显示设置模态窗口
function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const dbPathInput = document.getElementById('dbPath');
    
    if (!modal || !dbPathInput) return;
    
    // 填充当前配置
    dbPathInput.value = appConfig.db_path || '';
    
    modal.style.display = 'flex';
}

// 关闭设置模态窗口
function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 保存设置
async function saveSettings() {
    const dbPathInput = document.getElementById('dbPath');
    if (!dbPathInput) return;
    
    const dbPath = dbPathInput.value.trim();
    if (!dbPath) {
        showNotification('请输入数据库路径', 'warning');
        return;
    }
    
    try {
        showLoadingState();
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ db_path: dbPath })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || result.message || '保存配置失败');
        }
        
        // 更新配置
        appConfig = result.config;
        
        showNotification('配置已保存', 'success');
        closeSettingsModal();
        
        // 刷新数据
        await refreshData();
    } catch (error) {
        console.error('保存配置失败:', error);
        showNotification('保存配置失败: ' + error.message, 'error');
    } finally {
        hideLoadingState();
    }
}

// 浏览数据库文件
function browseDbFile() {
    // 打开文件浏览器模态窗口
    showFileBrowserModal();
}

// 显示文件浏览器模态窗口
function showFileBrowserModal() {
    const modal = document.getElementById('fileBrowserModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // 加载初始目录（使用用户主目录）
    loadDirectory('/Users');
}

// 关闭文件浏览器模态窗口
function closeFileBrowserModal() {
    const modal = document.getElementById('fileBrowserModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 加载目录内容
async function loadDirectory(directory) {
    const content = document.getElementById('fileBrowserContent');
    const pathDisplay = document.getElementById('currentPath');
    const selectFileBtn = document.getElementById('selectFileBtn');
    
    if (!content || !pathDisplay) return;
    
    // 重置选中状态
    currentSelectedFile = null;
    if (selectFileBtn) {
        selectFileBtn.disabled = true;
    }
    
    // 显示加载状态
    content.innerHTML = `
        <div class="file-browser-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>加载中...</span>
        </div>
    `;
    
    // 更新路径显示
    pathDisplay.textContent = directory;
    
    try {
        // 发送请求获取目录内容
        const response = await fetch(`/api/browse?directory=${encodeURIComponent(directory)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || '加载目录失败');
        }
        
        // 清空内容
        content.innerHTML = '';
        
        // 如果目录为空
        if (data.items.length === 0) {
            content.innerHTML = `
                <div class="file-browser-empty">
                    <i class="fas fa-folder-open"></i>
                    <p>此文件夹为空</p>
                </div>
            `;
            return;
        }
        
        // 显示目录内容
        data.items.forEach(item => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.path = item.path;
            fileItem.dataset.type = item.type;
            
            const icon = item.type === 'directory' ? 'fa-folder' : 'fa-database';
            
            fileItem.innerHTML = `
                <div class="file-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="file-name">${escapeHtml(item.name)}</div>
            `;
            
            // 添加点击事件
            fileItem.addEventListener('click', () => {
                if (item.type === 'directory') {
                    // 如果是目录，进入该目录
                    loadDirectory(item.path);
                } else {
                    // 如果是文件，选中该文件
                    selectFile(fileItem, item.path);
                }
            });
            
            // 添加双击事件
            fileItem.addEventListener('dblclick', () => {
                if (item.type === 'directory') {
                    // 如果是目录，进入该目录
                    loadDirectory(item.path);
                } else {
                    // 如果是文件，选中并确认
                    selectFile(fileItem, item.path);
                    selectCurrentFile();
                }
            });
            
            content.appendChild(fileItem);
        });
        
    } catch (error) {
        console.error('加载目录失败:', error);
        content.innerHTML = `
            <div class="file-browser-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// 选择文件
function selectFile(element, filePath) {
    // 移除之前的选中状态
    const selectedItems = document.querySelectorAll('.file-item.selected');
    selectedItems.forEach(item => item.classList.remove('selected'));
    
    // 添加选中状态
    element.classList.add('selected');
    
    // 更新当前选中的文件
    currentSelectedFile = filePath;
    
    // 启用选择按钮
    const selectFileBtn = document.getElementById('selectFileBtn');
    if (selectFileBtn) {
        selectFileBtn.disabled = false;
    }
}

// 确认选择文件
function selectCurrentFile() {
    if (!currentSelectedFile) return;
    
    // 更新数据库路径输入框
    const dbPathInput = document.getElementById('dbPath');
    if (dbPathInput) {
        dbPathInput.value = currentSelectedFile;
    }
    
    // 关闭文件浏览器
    closeFileBrowserModal();
}

// 导航到父目录
function navigateToParent() {
    const currentPath = document.getElementById('currentPath');
    if (!currentPath) return;
    
    const directory = currentPath.textContent;
    const parentDir = directory.split('/').slice(0, -1).join('/') || '/';
    
    loadDirectory(parentDir);
}

// 暴露全局函数供HTML调用
window.selectKey = selectKey;
window.clearSearch = clearSearch;
window.formatJSON = formatJSON;
window.validateJSON = validateJSON;
window.copyToClipboard = copyToClipboard;
window.saveRecord = saveRecord;
window.deleteRecord = deleteRecord;
window.refreshData = refreshData;
window.showSettingsModal = showSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.browseDbFile = browseDbFile;
window.closeFileBrowserModal = closeFileBrowserModal;
window.selectCurrentFile = selectCurrentFile;
window.navigateToParent = navigateToParent;
window.setSearchMode = setSearchMode;

// 设置搜索模式
function setSearchMode(mode) {
    console.log('setSearchMode called with mode:', mode);
    currentSearchMode = mode;
    
    // 更新按钮状态
    const keySearchBtn = document.getElementById('keySearchMode');
    const globalSearchBtn = document.getElementById('globalSearchMode');
    const searchInput = document.getElementById('keySearch');
    
    console.log('Elements found:', {
        keySearchBtn: !!keySearchBtn,
        globalSearchBtn: !!globalSearchBtn,
        searchInput: !!searchInput
    });
    
    if (keySearchBtn && globalSearchBtn) {
        keySearchBtn.classList.toggle('active', mode === 'key');
        globalSearchBtn.classList.toggle('active', mode === 'global');
    }
    
    // 更新搜索框占位符
    if (searchInput) {
        if (mode === 'key') {
            searchInput.placeholder = '搜索 Keys...';
        } else {
            searchInput.placeholder = '全局搜索内容...';
        }
    }
    
    // 清除当前搜索并重新处理
    const currentSearchTerm = searchInput?.value.trim() || '';
    clearSearch();
    
    if (currentSearchTerm) {
        searchInput.value = currentSearchTerm;
        handleSearchInput({ target: searchInput });
    }
}

// 执行全局搜索
async function performGlobalSearch(searchTerm) {
    if (isGlobalSearching) return;
    
    isGlobalSearching = true;
    showSearchingState();
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || '搜索失败');
        }
        
        searchResults = data.results || [];
        displayGlobalSearchResults(searchResults, searchTerm);
        
    } catch (error) {
        console.error('全局搜索失败:', error);
        showNotification('搜索失败: ' + error.message, 'error');
        showEmptySearchResults();
    } finally {
        isGlobalSearching = false;
        hideSearchingState();
    }
}

// 显示全局搜索结果
function displayGlobalSearchResults(results, searchTerm) {
    const keysList = document.getElementById('keysList');
    if (!keysList) return;
    
    keysList.innerHTML = '';
    
    if (results.length === 0) {
        showEmptySearchResults();
        return;
    }
    
    // 添加搜索摘要
    const summaryElement = createSearchSummary(results.length, searchTerm);
    keysList.appendChild(summaryElement);
    
    // 添加搜索结果
    results.forEach(result => {
        const resultElement = createSearchResultElement(result, searchTerm);
        keysList.appendChild(resultElement);
    });
    
    hideEmptyState();
}

// 创建搜索摘要元素
function createSearchSummary(totalResults, searchTerm) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'search-summary';
    summaryDiv.innerHTML = `
        找到 <strong>${totalResults}</strong> 个匹配项，搜索词：<strong>"${escapeHtml(searchTerm)}"</strong>
    `;
    return summaryDiv;
}

// 创建搜索结果元素
function createSearchResultElement(result, searchTerm) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'search-result-item';
    resultDiv.setAttribute('data-key', result.key);
    resultDiv.onclick = () => selectSearchResult(result.key);
    
    // 高亮搜索词
    const highlightedKey = highlightSearchTerm(result.key, searchTerm);
    const highlightedPreview = highlightSearchTerm(result.preview, searchTerm);
    
    // 创建匹配标签
    const matchBadges = [];
    if (result.match_in_key) {
        matchBadges.push('<span class="match-badge key-match">Key匹配</span>');
    }
    if (result.match_in_value) {
        matchBadges.push('<span class="match-badge value-match">内容匹配</span>');
    }
    
    resultDiv.innerHTML = `
        <div class="search-result-content">
            <div class="search-result-icon">
                <i class="fas fa-search"></i>
            </div>
            <div class="search-result-info">
                <div class="search-result-key">${highlightedKey}</div>
                <div class="search-result-preview">${highlightedPreview}</div>
                <div class="search-result-matches">
                    ${matchBadges.join('')}
                </div>
            </div>
        </div>
    `;
    
    return resultDiv;
}

// 高亮搜索词
function highlightSearchTerm(text, searchTerm) {
    if (!text || !searchTerm) return escapeHtml(text || '');
    
    const escapedText = escapeHtml(text);
    const escapedSearchTerm = escapeHtml(searchTerm);
    const regex = new RegExp(`(${escapedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    return escapedText.replace(regex, '<mark style="background-color: #ffc107; color: #000; padding: 1px 3px; border-radius: 2px;">$1</mark>');
}

// 选择搜索结果
async function selectSearchResult(key) {
    // 清除其他选中状态
    document.querySelectorAll('.search-result-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 设置当前选中状态
    const selectedItem = document.querySelector(`.search-result-item[data-key="${CSS.escape(key)}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // 加载并显示记录
    await selectKey(key);
}

// 显示搜索中状态
function showSearchingState() {
    const keysList = document.getElementById('keysList');
    if (keysList) {
        keysList.innerHTML = `
            <div class="search-loading" style="padding: 20px; text-align: center; color: var(--text-muted);">
                <i class="fas fa-spinner fa-spin" style="font-size: 1.2em; margin-bottom: 8px;"></i>
                <div>正在搜索...</div>
            </div>
        `;
    }
}

// 隐藏搜索中状态
function hideSearchingState() {
    // 这个函数在搜索完成后会被displayGlobalSearchResults覆盖
}

// 显示空搜索结果
function showEmptySearchResults() {
    const keysList = document.getElementById('keysList');
    const emptyState = document.getElementById('emptyState');
    
    if (keysList) {
        keysList.innerHTML = '';
    }
    
    if (emptyState) {
        emptyState.style.display = 'flex';
    }
}

// 隐藏空状态
function hideEmptyState() {
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
} 