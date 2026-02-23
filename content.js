const serverUrl = 'http://127.0.0.1:3000';
let userQuestion = '';
let isAnalyzing = false;
let allScrapedData = []; // 存储所有抓取的原始数据

// 注入“生成调研报告”按钮
function injectReportButton() {
    if (document.querySelector('.xhs-gpt-report-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'xhs-gpt-report-btn';
    btn.textContent = '生成深度调研报告';
    btn.onclick = startAnalysis;
    document.body.appendChild(btn);
}

// 获取搜索关键词
function getSearchKeyword() {
    let keyword = '';

    // 1. 优先从搜索框获取（最准确，反映用户当前输入）
    // 小红书搜索框常见的类名包括 .search-input, #search-input, 以及一些混淆类名
    const searchInput = document.querySelector('input.search-input') || 
                        document.querySelector('.search-input input') ||
                        document.querySelector('#search-input');
    
    if (searchInput && searchInput.value.trim()) {
        keyword = searchInput.value.trim();
    }
    
    // 2. 如果搜索框没拿到，尝试从 URL 获取并解码
    if (!keyword) {
        const urlParams = new URLSearchParams(window.location.search);
        const rawKeyword = urlParams.get('keyword') || urlParams.get('q');
        if (rawKeyword) {
            try {
                keyword = decodeURIComponent(rawKeyword);
            } catch (e) {
                keyword = rawKeyword;
            }
        }
    }
    
    // 3. 如果还是没有，使用页面标题（通常包含搜索词）
    if (!keyword) {
        const title = document.title.split(' - ')[0];
        if (title && title !== '小红书' && title !== 'Red') {
            keyword = title;
        }
    }

    // 最终兜底：如果还是空的，或者包含未解码字符，尝试强制解码一次
    try {
        return decodeURIComponent(keyword || '未知主题');
    } catch (e) {
        return keyword || '未知主题';
    }
}

// 开始分析流程
async function startAnalysis() {
    if (isAnalyzing) return;
    isAnalyzing = true;
    allScrapedData = [];
    
    const btn = document.querySelector('.xhs-gpt-report-btn');
    btn.disabled = true;
    btn.textContent = '正在调研中...';

    userQuestion = getSearchKeyword();
    showInitialModal();

    try {
        // 1. 获取前 6 个帖子链接
        const noteLinks = Array.from(document.querySelectorAll('a.cover.ld.mask')).slice(0, 6);

        // 严格顺序执行，确保 1-6 依次输出
        for (let i = 0; i < noteLinks.length; i++) {
            try {
                updateModalStatus(`正在抓取并分析第 ${i + 1}/${noteLinks.length} 篇笔记...`);
                // 自动切换到当前正在处理的页面，让用户看到进度
                switchPage(i);
                
                const noteData = await scrapeNoteDetail(noteLinks[i].href);
                
                if (noteData) {
                    allScrapedData[i] = noteData;
                    const summary = await callAnalyzeNote(noteData);
                    // 无论分析是否成功，都必须调用 addSummaryCard 更新 UI，防止页面卡在“等待抓取”
                    addSummaryCard(noteData, summary || "分析失败，请检查后端连接或重试。", i);
                } else {
                    // 抓取超时或失败
                    allScrapedData[i] = { title: '抓取超时或失败', url: noteLinks[i].href, author: '未知' };
                    addSummaryCard(allScrapedData[i], "该笔记内容抓取超时或失败，请检查网络或手动查看。", i);
                }
            } catch (innerError) {
                console.error(`处理第 ${i+1} 篇笔记出错:`, innerError);
                const fallbackData = { title: '处理出错', url: noteLinks[i]?.href || '#', author: '未知' };
                addSummaryCard(fallbackData, "处理该笔记时发生意外错误。", i);
            }
            
            // 适当延时，给用户阅读时间
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 2. 所有摘要生成完毕
        showFinalStepUI();
    } catch (error) {
        console.error('调研出错:', error);
        alert('调研过程中发生错误，请检查后端服务是否启动。');
    } finally {
        isAnalyzing = false;
        btn.disabled = false;
        btn.textContent = '生成深度调研报告';
    }
}

// 抓取笔记详情（正文 + 评论）
async function scrapeNoteDetail(url) {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);

        // 增加 15 秒强制超时保护，防止 iframe 加载卡死整个流程
        const timeout = setTimeout(() => {
            console.warn(`抓取 ${url} 超时`);
            if (iframe.parentNode) document.body.removeChild(iframe);
            resolve(null);
        }, 15000);

        iframe.onload = async () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                // 等待动态内容加载，视频帖可能需要更久
                await new Promise(r => setTimeout(r, 3000));

                // 增强型选择器，兼容图文和视频帖
                const title = doc.querySelector('.title')?.textContent || 
                              doc.querySelector('.note-content .title')?.textContent || '';
                const author = doc.querySelector('.name')?.textContent || 
                               doc.querySelector('.nickname')?.textContent || 
                               doc.querySelector('.user-name')?.textContent || '';
                const content = doc.querySelector('.desc')?.textContent || 
                                doc.querySelector('.note-content .desc')?.textContent || 
                                doc.querySelector('.video-desc')?.textContent || '';
                
                // 抓取评论（兼容多种可能的评论结构）
                const commentNodes = doc.querySelectorAll('.comment-item .content, .comment-content, .comment-text');
                const comments = Array.from(commentNodes).map(n => n.textContent.trim()).filter(t => t).join('\n');

                clearTimeout(timeout);
                if (iframe.parentNode) document.body.removeChild(iframe);
                resolve({ title, author, content, comments_text: comments, url });
            } catch (e) {
                console.error('抓取详情失败:', e);
                clearTimeout(timeout);
                if (iframe.parentNode) document.body.removeChild(iframe);
                resolve(null);
            }
        };

        iframe.onerror = () => {
            clearTimeout(timeout);
            if (iframe.parentNode) document.body.removeChild(iframe);
            resolve(null);
        };
    });
}

// 调用后端分析单篇笔记
async function callAnalyzeNote(noteData) {
    try {
        const response = await fetch(`${serverUrl}/analyze_note`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note_data: noteData, user_question: userQuestion })
        });
        const data = await response.json();
        return data.result;
    } catch (e) {
        return "分析失败，请检查后端连接。";
    }
}

// UI 相关：初始化模态框
function showInitialModal() {
    let overlay = document.querySelector('.xhs-gpt-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'xhs-gpt-overlay';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="xhs-gpt-modal">
            <div class="xhs-gpt-modal-header">
                <div class="xhs-gpt-header-top">
                    <span class="xhs-gpt-modal-title">深度调研助手 - 关键词：${userQuestion}</span>
                    <button class="xhs-gpt-close-btn">&times;</button>
                </div>
                <div class="xhs-gpt-tabs" id="xhs-gpt-tabs">
                    ${Array.from({length: 6}, (_, i) => `<div class="xhs-gpt-tab" data-page="${i}">摘要 ${i+1}</div>`).join('')}
                    <div class="xhs-gpt-tab" data-page="6">汇总报告</div>
                </div>
            </div>
            <div class="xhs-gpt-modal-body" id="xhs-gpt-modal-body">
                <div class="xhs-gpt-loading" id="xhs-gpt-initial-loading">
                    <div class="xhs-gpt-spinner"></div>
                    <div class="xhs-gpt-status">正在初始化...</div>
                </div>
                <div id="xhs-gpt-pages-container"></div>
            </div>
        </div>
    `;

    // 初始化页面容器
    const pagesContainer = document.getElementById('xhs-gpt-pages-container');
    for (let i = 0; i <= 6; i++) {
        const page = document.createElement('div');
        page.className = `xhs-gpt-summary-page ${i === 0 ? 'active' : ''}`;
        page.id = `xhs-gpt-page-${i}`;
        if (i < 6) {
            page.innerHTML = `<div class="xhs-gpt-loading"><div class="xhs-gpt-spinner"></div><p>等待抓取中...</p></div>`;
        } else {
            page.innerHTML = `
                <div class="xhs-gpt-final-report-section">
                    <h3>最终汇总报告</h3>
                    <p id="xhs-gpt-selection-summary">请先在前面的摘要页中勾选感兴趣的笔记。</p>
                    <button class="xhs-gpt-generate-final-btn" id="xhs-gpt-generate-final-btn" disabled>生成最终汇总报告</button>
                    <div id="xhs-gpt-final-report-content" class="xhs-gpt-report-content" style="margin-top: 20px;"></div>
                </div>
            `;
        }
        pagesContainer.appendChild(page);
    }

    // 绑定 Tab 点击事件
    const tabs = overlay.querySelectorAll('.xhs-gpt-tab');
    tabs.forEach(tab => {
        tab.onclick = () => switchPage(parseInt(tab.getAttribute('data-page')));
    });

    overlay.querySelector('.xhs-gpt-close-btn').onclick = () => {
        document.body.removeChild(overlay);
    };

    switchPage(0);
}

function switchPage(pageIndex) {
    // 更新 Tab 状态
    document.querySelectorAll('.xhs-gpt-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === pageIndex);
    });
    // 更新页面展示
    document.querySelectorAll('.xhs-gpt-summary-page').forEach((page, i) => {
        page.classList.toggle('active', i === pageIndex);
    });

    if (pageIndex === 6) {
        updateSelectionSummary();
    }
}

function updateModalStatus(status) {
    const statusDiv = document.querySelector('.xhs-gpt-status');
    if (statusDiv) statusDiv.textContent = status;
}

// 添加单篇摘要卡片
function addSummaryCard(noteData, summary, index) {
    const page = document.getElementById(`xhs-gpt-page-${index}`);
    const tab = document.querySelector(`.xhs-gpt-tab[data-page="${index}"]`);
    
    const loading = document.getElementById('xhs-gpt-initial-loading');
    if (loading) loading.style.display = 'none';

    tab.classList.add('has-content');

    // 默认勾选
    page.innerHTML = `
        <div class="xhs-gpt-summary-card selected" id="xhs-gpt-card-${index}">
            <div class="xhs-gpt-selection-badge">已加入汇总</div>
            <div class="xhs-gpt-card-header">
                <div class="xhs-gpt-card-title">${noteData.title}</div>
                <input type="checkbox" class="xhs-gpt-card-checkbox" data-index="${index}" checked>
            </div>
            <div class="xhs-gpt-card-content">${formatMarkdown(summary)}</div>
            <div class="xhs-gpt-card-footer">
                作者：${noteData.author} | <a href="${noteData.url}" target="_blank">查看原帖</a>
            </div>
        </div>
    `;

    // 绑定复选框事件
    const checkbox = page.querySelector('.xhs-gpt-card-checkbox');
    const card = page.querySelector('.xhs-gpt-summary-card');
    
    const toggleSelection = (checked) => {
        checkbox.checked = checked;
        if (checked) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
        updateSelectionSummary();
    };

    checkbox.onchange = (e) => {
        e.stopPropagation();
        toggleSelection(e.target.checked);
    };

    // 点击卡片也能切换选中状态（排除点击链接的情况）
    card.onclick = (e) => {
        if (e.target.tagName !== 'A' && e.target !== checkbox) {
            toggleSelection(!checkbox.checked);
        }
    };
}

function updateSelectionSummary() {
    const selectedIndexes = Array.from(document.querySelectorAll('.xhs-gpt-card-checkbox:checked'))
        .map(cb => parseInt(cb.getAttribute('data-index')));
    
    const summaryText = document.getElementById('xhs-gpt-selection-summary');
    const btn = document.getElementById('xhs-gpt-generate-final-btn');

    if (selectedIndexes.length > 0) {
        summaryText.textContent = `已选中 ${selectedIndexes.length} 篇笔记，准备好生成最终报告。`;
        btn.disabled = false;
        btn.onclick = generateFinalReport;
    } else {
        summaryText.textContent = `请先在前面的摘要页中勾选感兴趣的笔记。`;
        btn.disabled = true;
    }
}

// 显示最终生成报告的 UI
function showFinalStepUI() {
    const tab = document.querySelector('.xhs-gpt-tab[data-page="6"]');
    tab.classList.add('has-content');
}

// 生成最终汇总报告
async function generateFinalReport() {
    const btn = document.getElementById('xhs-gpt-generate-final-btn');
    const reportContainer = document.getElementById('xhs-gpt-final-report-content');
    
    const selectedIndexes = Array.from(document.querySelectorAll('.xhs-gpt-card-checkbox:checked'))
        .map(cb => parseInt(cb.getAttribute('data-index')));

    if (selectedIndexes.length === 0) {
        alert('请至少选择一篇笔记！');
        return;
    }

    btn.disabled = true;
    btn.textContent = '正在生成最终报告...';
    reportContainer.innerHTML = '<div class="xhs-gpt-spinner"></div>';

    const selectedData = selectedIndexes.map(idx => allScrapedData[idx]);

    try {
        const response = await fetch(`${serverUrl}/generate_report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selected_data: selectedData, user_question: userQuestion })
        });
        const data = await response.json();
        reportContainer.innerHTML = `<hr><h2>最终调研报告</h2>${formatMarkdown(data.report)}`;
        reportContainer.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        reportContainer.innerHTML = '生成报告失败，请检查后端连接。';
    } finally {
        btn.disabled = false;
        btn.textContent = '重新生成最终汇总报告';
    }
}

// 简单的 Markdown 格式化
function formatMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
}

// 初始化
injectReportButton();

// 监听 URL 变化
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(injectReportButton, 2000);
    }
}).observe(document, { subtree: true, childList: true });
