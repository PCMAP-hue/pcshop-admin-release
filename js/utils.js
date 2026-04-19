const { ipcRenderer } = require('electron');
window.ipcRenderer = ipcRenderer;
window.ipc = ipcRenderer; // 전역 객체에 등록하여 다른 모듈에서 사용 가능하게 함

// [UI Helper] Render Standard List Header
window.renderListHeader = (cols, listKey) => {
    let html = `<div class="list-header" data-list-key="${listKey || ''}">`;
    const savedWidths = listKey ? JSON.parse(localStorage.getItem(`columnWidths_${listKey}`) || '{}') : {};
    
    cols.forEach((col, idx) => {
        const alignClass = col.align ? ` t-${col.align}` : '';
        const savedWidth = savedWidths[idx] ? `width: ${savedWidths[idx]}px; flex: none;` : '';
        const styleAttr = (col.style || savedWidth) ? ` style="${col.style || ''} ${savedWidth}"` : '';
        
        html += `<div class="${col.class || ''}${alignClass}"${styleAttr} data-index="${idx}">
            ${col.name}
            ${idx < cols.length - 1 ? `<div class="resizer" data-index="${idx}"></div>` : ''}
        </div>`;
    });
    html += '</div>';
    return html;
};

// [Resizable Table Logic] Initialize Drag & Resize for List Columns
window.initResizableList = (containerId, listKey) => {
    const container = document.getElementById(containerId);
    if (!container || !listKey) return;

    const header = container.querySelector('.list-header');
    if (!header) return;

    const resizers = header.querySelectorAll('.resizer');
    resizers.forEach(resizer => {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault(); // 선택 방지
            e.stopPropagation();
            
            const index = parseInt(resizer.dataset.index);
            const col = header.querySelector(`div[data-index="${index}"]`);
            if (!col) return;

            const startX = e.pageX;
            const startWidth = col.offsetWidth;
            
            document.body.classList.add('resizing');
            resizer.classList.add('dragging');

            const onMouseMove = (moveE) => {
                const newWidth = Math.max(50, startWidth + (moveE.pageX - startX));
                
                // Update header cell
                col.style.width = newWidth + 'px';
                col.style.flex = 'none';
                
                // Synchronously update all row cells in this column
                const rows = container.querySelectorAll('.list-row');
                rows.forEach(row => {
                    const cell = row.children[index];
                    if (cell) {
                        cell.style.width = newWidth + 'px';
                        cell.style.flex = 'none';
                    }
                });
            };

            const onMouseUp = () => {
                document.body.classList.remove('resizing');
                resizer.classList.remove('dragging');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Persistent Save: Store all custom widths for this list
                const widths = JSON.parse(localStorage.getItem(`columnWidths_${listKey}`) || '{}');
                widths[index] = parseInt(col.style.width);
                localStorage.setItem(`columnWidths_${listKey}`, JSON.stringify(widths));
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
};

// [Resizable Table Logic] Re-apply stored widths to rendered DOM
window.applyColumnWidths = (containerId, listKey) => {
    const container = document.getElementById(containerId);
    if (!container || !listKey) return;
    
    const savedWidths = JSON.parse(localStorage.getItem(`columnWidths_${listKey}`) || '{}');
    if (Object.keys(savedWidths).length === 0) return;
    
    const header = container.querySelector('.list-header');
    const rows = container.querySelectorAll('.list-row');
    
    Object.entries(savedWidths).forEach(([index, width]) => {
        const idx = parseInt(index);
        if (header && header.children[idx]) {
            header.children[idx].style.width = width + 'px';
            header.children[idx].style.flex = 'none';
        }
        rows.forEach(row => {
            if (row.children[idx]) {
                row.children[idx].style.width = width + 'px';
                row.children[idx].style.flex = 'none';
            }
        });
    });
};


// Custom Confirm Async Function
window.showConfirm = (msg, okText = '확인', cancelText = '취소') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-msg');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        const btnOk = document.getElementById('btn-confirm-ok');
        if(!modal || !msgEl || !btnCancel || !btnOk) return resolve(confirm(msg));
        
        msgEl.textContent = msg || '진행하시겠습니까?';
        btnOk.textContent = okText;
        btnCancel.textContent = cancelText;
        btnOk.style.backgroundColor = okText === '삭제' ? 'var(--danger-color)' : 'var(--accent)';
        btnOk.style.color = '#ffffff'; 
        btnOk.style.border = 'none';
        modal.style.display = 'flex';
        
        const cleanup = () => {
            modal.style.display = 'none';
            btnCancel.removeEventListener('click', onCancel);
            btnOk.removeEventListener('click', onOk);
        };
        const onCancel = () => { cleanup(); resolve(false); };
        const onOk = () => { cleanup(); resolve(true); };
        btnCancel.addEventListener('click', onCancel);
        btnOk.addEventListener('click', onOk);
    });
};

// Custom Alert Async Function
window.showAlert = (msg) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('alert-modal');
        const msgEl = document.getElementById('alert-msg');
        const btnOk = document.getElementById('btn-alert-ok');
        if(!modal || !msgEl || !btnOk) { alert(msg); return resolve(); }
        
        msgEl.textContent = msg || '알림';
        modal.style.display = 'flex';
        const onOk = () => {
            modal.style.display = 'none';
            btnOk.removeEventListener('click', onOk);
            resolve();
        };
        btnOk.addEventListener('click', onOk);
    });
};

// Global Loading UI Utility
window.showLoading = (msg = '요청을 처리중입니다...') => {
    const loader = document.getElementById('global-loading-modal');
    const textEl = document.getElementById('global-loading-msg');
    if (loader && textEl) {
        textEl.textContent = msg;
        loader.style.display = 'flex';
    }
};

window.hideLoading = () => {
    const loader = document.getElementById('global-loading-modal');
    if (loader) loader.style.display = 'none';
};

// Helper: Safe Init for Background Tasks
window.safeInit = (fn, name) => {
    try { fn(); } catch(e) { console.error(`SafeInit [${name}] failed:`, e); }
};

// Global Picker Utility (Shared for Vendor/Customer Search)
window.openGeneralPicker = ({ title, placeholder, data, filterFn, renderFn, onSelect, showAllOnEmpty = false }) => {
    const modal = document.getElementById('modal-ledger-target-search');
    const input = document.getElementById('ledger-target-search-input');
    const results = document.getElementById('ledger-target-search-results');
    const titleEl = document.getElementById('ledger-target-search-title');
    const btnClose = document.getElementById('btn-close-modal-ledger-target-search');

    if(!modal || !results) return;

    titleEl.textContent = title || '항목 선택';
    input.value = '';
    input.placeholder = placeholder || '검색어 입력...';
    
    // [UI Style] 약 5~6개 보이고 나머지는 스크롤되도록 설정
    results.style.maxHeight = '320px';
    results.style.overflowY = 'auto';
    
    const render = (q = '') => {
        const lowQ = q.trim().toLowerCase();
        
        // [Fixed/Rollback] showAllOnEmpty 옵션이 없고 검색어가 비어있으면 안내 문구 표시 (타 서비스 사이드 이펙트 방지)
        if(!showAllOnEmpty && !lowQ) {
            results.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted); font-size:13px;">검색어를 입력하여 조회해 주세요.</div>';
            return;
        }

        const filtered = lowQ 
            ? data.filter(item => filterFn(item, lowQ)).slice(0, 30)
            : data.slice(0, 30);
        
        results.innerHTML = '';
        if(filtered.length === 0) {
            results.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted); font-size:13px;">${lowQ ? '검색 결과가 없습니다.' : '표시할 내역이 없습니다.'}</div>`;
        } else {
            results.innerHTML = filtered.map((item, idx) => `
                <div class="search-result-item" data-idx="${idx}" style="padding:12px 16px; border-bottom:1px solid var(--border-color); cursor:pointer;">
                    ${renderFn(item)}
                </div>
            `).join('');

            results.querySelectorAll('.search-result-item').forEach(el => {
                el.onclick = () => {
                    const idx = el.dataset.idx;
                    onSelect(filtered[idx]);
                    modal.style.display = 'none';
                };
            });
        }
    };

    input.oninput = (e) => render(e.target.value);
    if(btnClose) btnClose.onclick = () => modal.style.display = 'none';
    
    render();
    modal.style.display = 'flex';
    input.focus();
};

// [Trendy UI] Global Toast Notification
window.showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if(!container) return;

    const toast = document.createElement('div');
    toast.className = `apple-toast ${type}`;
    
    let iconName = 'info';
    if(type === 'success') iconName = 'check-circle';
    if(type === 'error') iconName = 'alert-circle';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    
    // Create icons for the new toast
    if(window.lucide) lucide.createIcons({
        attrs: { class: 'lucide' },
        nameAttr: 'data-lucide',
        icons: undefined
    });

    // Remove toast after animation
    setTimeout(() => {
        if(toast.parentElement) toast.remove();
    }, 3200);
};
