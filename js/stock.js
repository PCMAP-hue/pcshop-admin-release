// [Stock Management Module]
(function() {
    window.stockDataList = [];
    window.stockHistoryList = [];

    window.loadStockData = () => {
        try {
            const savedData = window.DB.get('PC_StockData');
            const savedHistory = window.DB.get('PC_StockHistory');
            window.stockDataList = savedData ? JSON.parse(savedData) : [];
            window.stockHistoryList = savedHistory ? JSON.parse(savedHistory) : [];
        } catch (e) {
            console.error('Failed to load stock data:', e);
        }
    };

    window.saveStockData = () => {
        window.DB.set('PC_StockData', JSON.stringify(window.stockDataList));
        window.DB.set('PC_StockHistory', JSON.stringify(window.stockHistoryList));
    };

    window.renderStockList = () => {
        const query = document.getElementById('search-input-stock')?.value.toLowerCase() || '';
        const categoryFilter = document.getElementById('stock-filter-category')?.value || 'all';
        const conditionFilter = document.getElementById('stock-filter-condition')?.value || 'all';
        const container = document.getElementById('stock-list-container');
        
        if(!container) return;

        const filtered = window.stockDataList.filter(item => {
            const matchesSearch = !query || 
                item.name.toLowerCase().includes(query) || 
                item.spec.toLowerCase().includes(query) || 
                (item.barcode && item.barcode.toLowerCase().includes(query));
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            const matchesCondition = conditionFilter === 'all' || item.condition === conditionFilter;
            return matchesSearch && matchesCategory && matchesCondition;
        });

        const header = renderListHeader([
            { name: '카테고리', class: 'col-s' },
            { name: '부품명 및 상세 사양', class: 'col-flex' },
            { name: '상태', class: 'col-s' },
            { name: '현재고', class: 'col-s', align: 'right' },
            { name: '단가', class: 'col-m', align: 'right' },
            { name: '재고관리', class: 'col-action', align: 'center' }
        ], 'stock-list');

        let html = header;
        filtered.forEach(item => {
            const isLow = item.qty <= (item.safeQty || 3);
            const avgPrice = parseInt(item.avgPurchasePrice || item.purchasePrice || 0);
            const lastPrice = parseInt(item.lastPurchasePrice || item.purchasePrice || 0);

            html += `
                <div class="list-row ${isLow ? 'row-warning' : ''}" onclick="handleEditStock('${item.id}')">
                    <div class="col-s"><span class="category-chip">${item.category}</span></div>
                    <div class="col-flex">
                        <div class="v-bold">${item.name}</div>
                        ${item.isLinked ? '<div style="font-size:10px; color:var(--success-color); margin-top:2px;">(연동된 부품)</div>' : ''}
                    </div>
                    <div class="col-s"><span class="status-badge ${item.condition === 'used' ? 'status-pending' : 'status-completed'}" style="font-size:11px;">${item.condition === 'used' ? '중고' : '신품'}</span></div>
                    
                    <!-- Qty Area: Click to see Outbound History -->
                    <div class="col-s t-right v-bold ${isLow ? 'c-danger' : ''}" onclick="handleStockHistory('${item.id}', 'history-out', event)" title="재고 수량 (클릭 시 출고 내역)">
                        <div class="cell-hover-effect">
                            ${item.qty}개
                            ${isLow ? '<div class="status-badge" style="background:var(--danger-color); color:white; font-size:10px; padding:2px 4px; margin-top:2px; border:none;">재고부족</div>' : ''}
                        </div>
                    </div>

                    <!-- Price Area: Click to see Inbound History -->
                    <div class="col-m t-right" onclick="handleStockHistory('${item.id}', 'history-in', event)" title="판매 단가 (클릭 시 입고 내역)">
                        <div class="cell-hover-effect">
                            <div class="v-bold c-accent" style="display:flex; flex-direction:column; align-items:flex-end;">
                                <span style="font-size:10px; font-weight:normal; opacity:0.8; margin-bottom:2px;">판매가</span>
                                ${item.price > 0 ? (item.price).toLocaleString() + '원' : '<span style="font-size:12px; color:var(--text-muted); font-weight:normal;">미설정</span>'}
                            </div>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">평균: ${avgPrice.toLocaleString()}원</div>
                            <div style="font-size:10px; color:var(--text-muted);">최근: ${lastPrice.toLocaleString()}원</div>
                        </div>
                    </div>

                    <div class="col-action t-center" style="display:flex; justify-content:center; gap:9px;">
                        <button class="btn-stock-adjust" onclick="handleOpenStockAdjust('${item.id}', 'in', event)" title="재고 조절">
                            <i data-lucide="refresh-cw" style="width:16px;height:16px;"></i>
                        </button>
                        <button class="btn-delete" onclick="handleDeleteStock('${item.id}', event)" title="삭제">
                            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
        applyColumnWidths('stock-list-container', 'stock-list');
        initResizableList('stock-list-container', 'stock-list');

        lucide.createIcons();
    };

    window.handleDeleteStock = async (id, e) => {
        if(e) e.stopPropagation();
        if(await showConfirm('해당 부품 정보를 영구히 삭제하시겠습니까? 관련 입출고 기록도 삭제됩니다.')) {
            window.stockDataList = window.stockDataList.filter(x => x.id !== id);
            window.stockHistoryList = window.stockHistoryList.filter(x => x.partId !== id);
            window.saveStockData();
            window.renderStockList();
            window.updateDashboardWidgets();
        }
    };

    window.handleEditStock = (id) => {
        const item = window.stockDataList.find(x => x.id === id);
        if(!item) return;

        document.getElementById('modal-stock-title').textContent = '부품 상세 및 수정';
        document.getElementById('stock-category').value = item.category;
        document.getElementById('stock-name').value = item.name;
        document.getElementById('stock-spec').value = item.spec || '';
        document.getElementById('stock-barcode').value = item.barcode || '';
        document.getElementById('stock-qty').value = item.qty;
        document.getElementById('stock-safe-qty').value = item.safeQty || 1;
        document.getElementById('stock-purchase-price').value = item.purchasePrice || 0;
        document.getElementById('stock-price').value = item.price || 0;
        document.getElementById('stock-vendor-name').value = item.vendorName || '';
        document.getElementById('stock-vendor-id').value = item.vendorId || '';
        
        document.querySelectorAll('input[name="stock-condition"]').forEach(radio => {
            radio.checked = radio.value === item.condition;
        });

        const btnSave = document.getElementById('btn-save-stock');
        btnSave.textContent = '수정 내용 저장';
        btnSave.dataset.targetId = id;
        document.getElementById('modal-stock').style.display = 'flex';
    };

    window.handleStockHistory = (itemId, type, event) => {
        if(event) event.stopPropagation();
        window.openStockHistoryModal(itemId, type || 'history-in');
    };

    window.openStockHistoryModal = (itemId, tab) => {
        const item = window.stockDataList.find(x => x.id === itemId);
        if(!item) return;

        document.getElementById('history-item-name').textContent = item.name;
        document.getElementById('history-current-realtime-qty').textContent = item.qty;
        
        // Tab switching
        const tabs = document.querySelectorAll('#modal-stock-history .as-tab-btn');
        tabs.forEach(t => {
            if(t.dataset.tab === tab) t.classList.add('active');
            else t.classList.remove('active');
        });

        const allContent = document.getElementById('history-tab-all');
        const inContent = document.getElementById('history-tab-in');
        const outContent = document.getElementById('history-tab-out');
        const emptyState = document.getElementById('history-empty-state');
        
        // Default hide all content
        if(allContent) allContent.style.display = 'none';
        if(inContent) inContent.style.display = 'none';
        if(outContent) outContent.style.display = 'none';

        if(tab === 'history-all') {
            if(allContent) allContent.style.display = 'block';
            renderAllHistory(item);
        } else if(tab === 'history-in') {
            if(inContent) inContent.style.display = 'block';
            renderPurchaseHistory(item);
        } else if(tab === 'history-out') {
            if(outContent) outContent.style.display = 'block';
            renderOutHistory(item);
        }

        document.getElementById('modal-stock-history').style.display = 'flex';
        lucide.createIcons();
    };

    function formatHistoryDate(isoString) {
        if(!isoString) return '-';
        const d = new Date(isoString);
        if(isNaN(d.getTime())) return isoString; // fallback
        const pad = (n) => n.toString().padStart(2, '0');
        const datePart = `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`;
        const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return `${datePart}<br><span style="font-size:11px; opacity:0.7;">${timePart}</span>`;
    }

    function renderAllHistory(item) {
        const tbody = document.getElementById('total-history-tbody');
        const empty = document.getElementById('history-empty-state');
        if(!tbody) return;

        const inHistory = (item.purchaseHistory || []).map(h => ({ ...h, type: 'in' }));
        const outHistory = (item.outHistory || []).map(h => ({ ...h, type: 'out' }));
        const combined = [...inHistory, ...outHistory].sort((a,b) => new Date(b.date) - new Date(a.date));

        if(combined.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            tbody.innerHTML = combined.map(h => {
                const isOut = h.type === 'out';
                const typeText = isOut ? '출고' : '입고';
                const typeColor = isOut ? 'var(--danger-color)' : 'var(--success-color)';
                const reasonText = isOut ? (h.reason || '-') : (h.vendorName || '입고 기록');
                const qtyPrefix = isOut ? '-' : '+';
                const qtyColor = isOut ? 'var(--danger-color)' : 'var(--accent)';

                return `
                    <tr>
                        <td style="padding:10px 12px; font-size:12px; color:var(--text-muted);">${formatHistoryDate(h.date)}</td>
                        <td style="padding:10px 12px; text-align:center;"><span style="font-size:10px; padding:2px 6px; border-radius:4px; background:${typeColor}15; color:${typeColor}; font-weight:600;">${typeText}</span></td>
                        <td style="padding:10px 12px; font-size:12px;">${reasonText}</td>
                        <td style="padding:10px 12px; text-align:right; font-weight:700; color:${qtyColor}; white-space:nowrap;">${qtyPrefix}${h.qty}개</td>
                        <td style="padding:10px 12px; text-align:right; font-weight:600; color:var(--text-color); white-space:nowrap;">${h.balance || '-'}개</td>
                    </tr>
                `;
            }).join('');
        }
    }

    function renderPurchaseHistory(item) {
        const tbody = document.getElementById('purchase-history-tbody');
        const empty = document.getElementById('history-empty-state');
        if(!tbody) return;
        
        const history = item.purchaseHistory || [];
        if(history.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            tbody.innerHTML = [...history].sort((a,b) => new Date(b.date) - new Date(a.date)).map(h => {
                return `
                <tr>
                    <td style="padding:10px 16px;">${formatHistoryDate(h.date)}</td>
                    <td style="padding:10px 16px;">${h.vendorName || '-'}</td>
                    <td style="padding:10px 16px; text-align:right; white-space:nowrap;">${(h.price || 0).toLocaleString()}원</td>
                    <td style="padding:10px 16px; text-align:right; font-weight:700; color:var(--accent); white-space:nowrap;">${h.qty}개</td>
                    <td style="padding:10px 16px; text-align:right; opacity:0.8; white-space:nowrap;">${h.balance || '-'}개</td>
                </tr>
            `}).join('');
        }
    }

    function renderOutHistory(item) {
        const tbody = document.getElementById('outbound-history-tbody');
        const empty = document.getElementById('history-empty-state');
        if(!tbody) return;
        
        const history = item.outHistory || [];
        if(history.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            tbody.innerHTML = [...history].sort((a,b) => new Date(b.date) - new Date(a.date)).map(h => {
                return `
                <tr>
                    <td style="padding:10px 12px;">${formatHistoryDate(h.date)}</td>
                    <td style="padding:10px 12px; font-size:12px; color:var(--text-muted);">${h.reason || '-'}</td>
                    <td style="padding:10px 12px; text-align:center; font-weight:700; color:var(--danger-color); white-space:nowrap;">${h.qty}개</td>
                    <td style="padding:10px 12px; text-align:right; font-weight:600; color:var(--text-color); white-space:nowrap;">${h.balance || '-'}개</td>
                </tr>
            `}).join('');
        }
    }

    window.handleOpenStockAdjust = (id, type, e) => {
        if(e) e.stopPropagation();
        const item = window.stockDataList.find(x => x.id === id);
        if(!item) return;

        document.getElementById('adjust-part-name').textContent = item.name;
        document.getElementById('adjust-current-qty').textContent = item.qty;
        document.getElementById('adjust-qty').value = 1;
        
        const typeRadios = document.querySelectorAll('input[name="adjust-type"]');
        typeRadios.forEach(r => r.checked = r.value === type);
        
        // Trigger UI update for purchase details
        updateAdjustUI(type);

        const btnApply = document.getElementById('btn-apply-adjust');
        btnApply.dataset.targetId = id;
        document.getElementById('modal-stock-adjust').style.display = 'flex';
    };

    function updateAdjustUI(type) {
        const detailSec = document.getElementById('adjust-purchase-details');
        const reasonSel = document.getElementById('adjust-reason');
        if(detailSec) detailSec.style.display = type === 'in' ? 'block' : 'none';
        
        if(reasonSel) {
            reasonSel.value = type === 'in' ? '매입/입고' : '판매/출고';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const btnSaveStock = document.getElementById('btn-save-stock');
        const btnOpenStock = document.getElementById('btn-open-stock');
        const modalStock = document.getElementById('modal-stock');
        const btnCloseModalStock = document.getElementById('btn-close-modal-stock');

        if(btnOpenStock) {
            btnOpenStock.addEventListener('click', () => {
                document.getElementById('modal-stock-title').textContent = '신규 부품 재고 등록';
                document.getElementById('stock-category').value = 'CPU';
                document.getElementById('stock-name').value = '';
                document.getElementById('stock-spec').value = '';
                document.getElementById('stock-barcode').value = '';
                document.getElementById('stock-qty').value = 0;
                document.getElementById('stock-safe-qty').value = 3;
                document.getElementById('stock-purchase-price').value = 0;
                document.getElementById('stock-price').value = 0;
                document.getElementById('stock-vendor-name').value = '';
                document.getElementById('stock-vendor-id').value = '';
                document.querySelectorAll('input[name="stock-condition"]').forEach(radio => radio.checked = (radio.value === 'new'));
                if(btnSaveStock) {
                    btnSaveStock.textContent = '부품 등록하기';
                    delete btnSaveStock.dataset.targetId;
                }
                modalStock.style.display = 'flex';
            });
        }

        if(btnSaveStock) {
            btnSaveStock.addEventListener('click', () => {
                const category = document.getElementById('stock-category').value;
                const name = document.getElementById('stock-name');
                const spec = document.getElementById('stock-spec').value;
                const barcode = document.getElementById('stock-barcode').value;
                const qty = parseInt(document.getElementById('stock-qty').value) || 0;
                const safeQty = parseInt(document.getElementById('stock-safe-qty').value) || 0;
                const purchasePrice = parseInt(document.getElementById('stock-purchase-price').value) || 0;
                const price = parseInt(document.getElementById('stock-price').value) || 0;
                const condition = document.querySelector('input[name="stock-condition"]:checked').value;
                const vendorName = document.getElementById('stock-vendor-name').value;
                const vendorId = document.getElementById('stock-vendor-id').value;

                if(!name.value.trim()) {
                    name.classList.add('shake', 'input-error');
                    setTimeout(() => name.classList.remove('shake', 'input-error'), 800);
                    return;
                }

                const targetId = btnSaveStock.dataset.targetId;
                if(targetId) {
                    const item = window.stockDataList.find(x => x.id === targetId);
                    if(item) {
                        const oldQty = item.qty || 0;
                        const oldAvg = parseInt(item.avgPurchasePrice || item.purchasePrice || 0);
                        
                        if (qty > oldQty) {
                            const addedQty = qty - oldQty;
                            const newAvg = Math.round(((oldQty * oldAvg) + (addedQty * purchasePrice)) / qty);
                            item.avgPurchasePrice = newAvg;
                            item.lastPurchasePrice = purchasePrice;
                            if(!item.purchaseHistory) item.purchaseHistory = [];
                            item.purchaseHistory.push({
                                date: new Date().toISOString(),
                                vendorName: vendorName || '직접 수정',
                                price: purchasePrice,
                                qty: addedQty,
                                balance: qty
                            });
                            if(item.purchaseHistory.length > 20) item.purchaseHistory.shift();
                        } else {
                            item.lastPurchasePrice = purchasePrice;
                            if (!item.avgPurchasePrice) item.avgPurchasePrice = purchasePrice;
                        }

                        item.category = category;
                        item.name = name.value.trim();
                        item.spec = spec;
                        item.barcode = barcode;
                        item.qty = qty;
                        item.safeQty = safeQty;
                        item.purchasePrice = purchasePrice;
                        item.price = price;
                        item.condition = condition;
                        item.vendorName = vendorName;
                        item.vendorId = vendorId;
                    }
                } else {
                    const newItem = {
                        id: 'STK-' + new Date().getTime().toString().slice(-6),
                        category, name: name.value.trim(), spec, barcode, qty, safeQty, purchasePrice, price, condition, vendorName, vendorId,
                        avgPurchasePrice: purchasePrice,
                        lastPurchasePrice: purchasePrice,
                        purchaseHistory: qty > 0 ? [{
                            date: new Date().toISOString(),
                            vendorName: vendorName || '초기 입고',
                            price: purchasePrice,
                            qty: qty,
                            balance: qty
                        }] : []
                    };
                    window.stockDataList.unshift(newItem);
                }

                window.saveStockData();
                modalStock.style.display = 'none';
                window.renderStockList();
                window.updateDashboardWidgets();
            });
        }

        if(btnCloseModalStock) btnCloseModalStock.addEventListener('click', () => modalStock.style.display = 'none');

        // Vendor Search Picker Bindings
        const btnSearchVendorStock = document.getElementById('btn-search-vendor-stock');
        if(btnSearchVendorStock) {
            btnSearchVendorStock.addEventListener('click', () => {
                window.openGeneralPicker({
                    title: '매입처 검색 및 선택',
                    placeholder: '매입처 상호명 또는 연락처 입력...',
                    data: window.vendorDataList,
                    filterFn: (v, q) => v.name.toLowerCase().includes(q) || (v.phone && v.phone.includes(q)),
                    renderFn: (v) => `
                        <div style="font-weight:700; font-size:14px; color:var(--text-color);">${v.name}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${v.phone || '-'} | ${v.owner || '-'}</div>
                    `,
                    onSelect: (vendor) => {
                        document.getElementById('stock-vendor-name').value = vendor.name;
                        document.getElementById('stock-vendor-id').value = vendor.id;
                    }
                });
            });
        }

        const btnSearchVendorAdjust = document.getElementById('btn-search-vendor-adjust');
        if(btnSearchVendorAdjust) {
            btnSearchVendorAdjust.addEventListener('click', () => {
                window.openGeneralPicker({
                    title: '매입처 검색 및 선택',
                    placeholder: '매입처 상호명 또는 연락처 입력...',
                    data: window.vendorDataList,
                    filterFn: (v, q) => v.name.toLowerCase().includes(q) || (v.phone && v.phone.includes(q)),
                    renderFn: (v) => `
                        <div style="font-weight:700; font-size:14px; color:var(--text-color);">${v.name}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${v.phone || '-'} | ${v.owner || '-'}</div>
                    `,
                    onSelect: (vendor) => {
                        document.getElementById('adjust-vendor-name').value = vendor.name;
                        document.getElementById('adjust-vendor-id').value = vendor.id;
                    }
                });
            });
        }
        
        // Adjust Modal Actions
        const btnApplyAdjust = document.getElementById('btn-apply-adjust');
        const btnCloseAdjust = document.getElementById('btn-close-modal-stock-adjust');
        const adjustTypeRadios = document.querySelectorAll('input[name="adjust-type"]');

        if(btnApplyAdjust) {
            btnApplyAdjust.addEventListener('click', () => {
                const id = btnApplyAdjust.dataset.targetId;
                const item = window.stockDataList.find(x => x.id === id);
                if(!item) return;

                const type = document.querySelector('input[name="adjust-type"]:checked').value;
                const qty = parseInt(document.getElementById('adjust-qty').value) || 0;
                const reason = document.getElementById('adjust-reason').value;

                if(qty <= 0) { showAlert('수량은 1개 이상이어야 합니다.'); return; }

                if(type === 'in') {
                    const pPrice = parseInt(document.getElementById('adjust-purchase-price').value) || 0;
                    const oldQty = item.qty || 0;
                    const oldAvg = parseInt(item.avgPurchasePrice || item.purchasePrice || 0);
                    const addedQty = qty;
                    
                    // 평균 단가 계산 (가중 평균)
                    const newTotalQty = oldQty + addedQty;
                    const finalPrice = pPrice || item.purchasePrice || 0;
                    const newAvg = Math.round(((oldQty * oldAvg) + (addedQty * finalPrice)) / newTotalQty);
                    
                    item.avgPurchasePrice = newAvg;
                    item.lastPurchasePrice = finalPrice;
                    item.qty = newTotalQty;

                    const vName = document.getElementById('adjust-vendor-name').value;
                    if(!item.purchaseHistory) item.purchaseHistory = [];
                    item.purchaseHistory.push({
                        date: new Date().toISOString(),
                        vendorName: vName || '일반 입고',
                        price: finalPrice,
                        qty: addedQty,
                        balance: newTotalQty
                    });
                    if(item.purchaseHistory.length > 20) item.purchaseHistory.shift();
                } else {
                    if(item.qty < qty) { showAlert('현재 재고가 부족합니다.'); return; }
                    item.qty -= qty;
                    if(!item.outHistory) item.outHistory = [];
                    item.outHistory.push({
                        date: new Date().toISOString(),
                        reason: reason,
                        qty: qty,
                        price: item.price || 0,
                        balance: item.qty
                    });
                    if(item.outHistory.length > 20) item.outHistory.shift();
                }

                window.saveStockData();
                document.getElementById('modal-stock-adjust').style.display = 'none';
                window.renderStockList();
                window.updateDashboardWidgets();
                showAlert(`${type === 'in' ? '입고' : '출고'} 처리가 완료되었습니다.`);
            });
        }

        if(btnCloseAdjust) btnCloseAdjust.addEventListener('click', () => document.getElementById('modal-stock-adjust').style.display = 'none');
        
        adjustTypeRadios.forEach(r => r.addEventListener('change', (e) => updateAdjustUI(e.target.value)));

        // History Modal Tab Switching
        const historyTabs = document.querySelectorAll('#modal-stock-history .as-tab-btn');
        historyTabs.forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                const itemId = document.getElementById('history-item-name').dataset.itemId; 
                // Note: Need to store itemId in the name element for reference during tab switch
                // Or just get current open item from somewhere. Let's update openStockHistoryModal to set this.
                const currentName = document.getElementById('history-item-name').textContent;
                const item = window.stockDataList.find(x => x.name === currentName);
                if(item) {
                    window.openStockHistoryModal(item.id, tabBtn.dataset.tab);
                }
            });
        });

        const btnCloseHistory = document.getElementById('btn-close-modal-stock-history');
        if(btnCloseHistory) btnCloseHistory.addEventListener('click', () => document.getElementById('modal-stock-history').style.display = 'none');

        // Filter Listeners
        ['search-input-stock', 'stock-filter-category', 'stock-filter-condition'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', window.renderStockList);
        });
    });

    window.loadStockData();
})();
