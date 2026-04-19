// [Quote Management Module]
(function() {
    window.quoteDataList = [];

    window.loadQuoteData = () => {
        const saved = window.DB.get('PC_QuoteData');
        window.quoteDataList = saved ? JSON.parse(saved) : [];
    };

    window.saveQuoteData = () => {
        window.DB.set('PC_QuoteData', JSON.stringify(window.quoteDataList));
    };

    window.renderQuoteList = (query = '') => {
        const listContainer = document.getElementById('quote-list-container');
        if(!listContainer) return;
        let filtered = query ? window.quoteDataList.filter(q => q.id.includes(query) || q.custName.includes(query)) : window.quoteDataList;
        if(filtered.length === 0 && window.quoteDataList.length === 0) {
            listContainer.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">발행된 견적서가 없습니다.</div>`;
            return;
        }
        const header = renderListHeader([
            { name: '견적 번호', class: 'col-s' }, { name: '고객명', class: 'col-m' }, { name: '주요 구성 및 요약 내용', class: 'col-flex-2' },
            { name: '합계 금액', class: 'col-m', align: 'right' }, { name: '발행 일자', class: 'col-s', align: 'right' }, { name: '관리', class: 'col-action', align: 'center' }
        ], 'quote-list');
        let html = header;
        filtered.forEach(q => {
            html += `
                <div class="list-row" onclick="handleEditQuote('${q.id}')">
                    <div class="col-s v-bold c-accent">${q.id}</div>
                    <div class="col-m v-bold">${q.custName}</div>
                    <div class="col-flex-2 c-muted" title="${q.summary}">${q.summary}</div>
                    <div class="col-m t-right v-bold">${q.total.toLocaleString()}원</div>
                    <div class="col-s t-right c-muted" style="font-size:12px;">${q.date}</div>
                    <div class="col-action t-center"><button class="btn-delete" onclick="handleDeleteQuote('${q.id}', event)" title="삭제"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button></div>
                </div>
            `;
        });
        listContainer.innerHTML = html;
        applyColumnWidths('quote-list-container', 'quote-list');
        initResizableList('quote-list-container', 'quote-list');
        lucide.createIcons();
    };

    window.handleDeleteQuote = async (id, e) => {
        if(e) e.stopPropagation();
        if(await showConfirm('해당 견적서를 삭제하시겠습니까?', '삭제')) {
            window.quoteDataList = window.quoteDataList.filter(q => q.id !== id);
            window.saveQuoteData();
            window.renderQuoteList();
        }
    };

    window.handleEditQuote = (id) => {
        const q = window.quoteDataList.find(x => x.id === id);
        if(!q) return;
        document.getElementById('modal-quote-title').textContent = q.id + ' - 견적서 수정';
        document.getElementById('quote-cust-name').value = q.custName;
        document.getElementById('quote-memo').value = q.memo || '';
        const tbody = document.getElementById('quote-items-tbody');
        tbody.innerHTML = '';
        q.items.forEach(item => addQuoteRow(item.cat, item.name, item.price, item.qty));
        const btnSave = document.getElementById('btn-save-quote');
        btnSave.textContent = '견적서 정보 업데이트';
        btnSave.dataset.targetId = id;
        document.getElementById('modal-quote').style.display = 'flex';
    };

    function updateQuoteTotal() {
        const vatType = document.getElementById('quote-vat-type').value;
        const isManual = document.getElementById('quote-manual-total-check').checked;
        const manualInput = document.getElementById('quote-manual-total-val');
        manualInput.style.display = isManual ? 'block' : 'none';
        let autoTotal = 0;
        document.querySelectorAll('.quote-row').forEach(row => {
            const price = parseInt(row.querySelector('.row-price').value) || 0;
            const qty = parseInt(row.querySelector('.row-qty').value) || 0;
            const amount = price * qty;
            row.querySelector('.row-amount').textContent = amount.toLocaleString() + '원';
            autoTotal += amount;
        });
        let finalTotal = isManual ? (parseInt(manualInput.value) || 0) : (vatType === 'exclude' ? Math.round(autoTotal * 1.1) : autoTotal);
        document.getElementById('quote-total-val').textContent = finalTotal.toLocaleString() + '원';
    }

    function addQuoteRow(category = '', name = '', price = 0, qty = 1) {
        const tr = document.createElement('tr');
        tr.className = 'quote-row';
        tr.innerHTML = `
            <td><input type="text" class="quote-table-input row-cat" value="${category}" placeholder="분류"></td>
            <td><input type="text" class="quote-table-input row-name" value="${name}" placeholder="품명 및 사양"></td>
            <td><input type="number" class="quote-table-input row-price" value="${price}" style="text-align:right;"></td>
            <td><input type="number" class="quote-table-input row-qty" value="${qty}" style="text-align:center;"></td>
            <td class="row-amount" style="text-align:right; font-weight:600;">0원</td>
            <td style="text-align:center;"><button class="btn-row-del"><i data-lucide="minus-circle" style="width:14px;height:14px;"></i></button></td>
        `;
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', updateQuoteTotal));
        tr.querySelector('.btn-row-del').addEventListener('click', () => { tr.remove(); updateQuoteTotal(); });
        document.getElementById('quote-items-tbody').appendChild(tr);
        lucide.createIcons();
        updateQuoteTotal();
    }
    window.addQuoteRow = addQuoteRow;
    window.updateQuoteTotal = updateQuoteTotal;

    document.addEventListener('DOMContentLoaded', () => {
        const btnSaveQuote = document.getElementById('btn-save-quote');
        const btnOpenQuote = document.getElementById('btn-open-quote');
        if(btnOpenQuote) {
            btnOpenQuote.addEventListener('click', () => {
                document.getElementById('modal-quote-title').textContent = '신규 견적서 작성';
                document.getElementById('quote-cust-name').value = '';
                document.getElementById('quote-memo').value = '';
                document.getElementById('quote-items-tbody').innerHTML = '';
                
                // Add default PC parts rows for convenience
                const defaultParts = ['CPU', '메인보드', '메모리', '그래픽카드', 'SSD', '파워', '케이스', '공임 및 셋팅'];
                defaultParts.forEach(part => addQuoteRow(part, '', 0, 1));
                
                if(btnSaveQuote) {
                    btnSaveQuote.textContent = '견적서 저장하기';
                    delete btnSaveQuote.dataset.targetId;
                }
                document.getElementById('modal-quote').style.display = 'flex';
                updateQuoteTotal();
            });
        }

        const btnSearchCustQuote = document.getElementById('btn-search-cust-quote');
        if(btnSearchCustQuote) {
            btnSearchCustQuote.addEventListener('click', () => {
                window.openGeneralPicker({
                    title: '고객 검색 및 선택',
                    placeholder: '고객명 또는 연락처를 입력하세요...',
                    data: window.customerDataList,
                    filterFn: (c, q) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)),
                    renderFn: (c) => `
                        <div style="font-weight:700; font-size:14px; color:var(--text-color);">${c.name}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${c.phone || '-'}</div>
                    `,
                    onSelect: (cust) => {
                        document.getElementById('quote-cust-name').value = cust.name;
                    }
                });
            });
        }

        if(btnSaveQuote) {
            btnSaveQuote.addEventListener('click', async () => {
                const custName = document.getElementById('quote-cust-name').value;
                if(!custName) { showAlert('고객을 먼저 선택하거나 입력해주세요.'); return; }
                const items = [];
                document.querySelectorAll('.quote-row').forEach(row => {
                    const name = row.querySelector('.row-name').value.trim();
                    if(name) items.push({ cat: row.querySelector('.row-cat').value, name, price: parseInt(row.querySelector('.row-price').value) || 0, qty: parseInt(row.querySelector('.row-qty').value) || 0 });
                });
                if(items.length === 0) { showAlert('최소 하나 이상의 품목을 입력해주세요.'); return; }
                const total = parseInt(document.getElementById('quote-total-val').textContent.replace(/,/g, '').replace('원', '')) || 0;
                const targetId = btnSaveQuote.dataset.targetId;
                if(targetId) {
                    const q = window.quoteDataList.find(x => x.id === targetId);
                    if(q) { 
                        q.custName = custName; q.items = items; q.total = total; 
                        q.summary = items[0].name + (items.length > 1 ? ` 외 ${items.length-1}건` : ''); 
                        q.memo = document.getElementById('quote-memo').value; 
                    }
                    delete btnSaveQuote.dataset.targetId;
                } else {
                    window.quoteDataList.unshift({
                        id: '#Q-' + Date.now().toString().slice(-6), custName, items, total, summary: items[0].name + (items.length > 1 ? ` 외 ${items.length-1}건` : ''),
                        memo: document.getElementById('quote-memo').value, date: new Date().toLocaleDateString()
                    });
                }
                window.saveQuoteData(); window.renderQuoteList();
                document.getElementById('modal-quote').style.display = 'none';
                showAlert('견적서가 저장되었습니다.');
            });
        }
        
        ['quote-vat-type', 'quote-manual-total-check', 'quote-manual-total-val'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', updateQuoteTotal);
        });
        
        const btnAddRow = document.getElementById('btn-add-quote-row');
        if(btnAddRow) btnAddRow.addEventListener('click', () => addQuoteRow());

        const btnCloseQuote = document.getElementById('btn-close-modal-quote');
        if(btnCloseQuote) btnCloseQuote.addEventListener('click', () => document.getElementById('modal-quote').style.display = 'none');

        // --- Quotation Print & Image Export Logic ---
        const btnPrintQuote = document.getElementById('btn-print-quote');
        const btnSaveQuoteImg = document.getElementById('btn-save-quote-img');

        if(btnPrintQuote) {
            btnPrintQuote.addEventListener('click', async () => {
                const targetId = document.getElementById('btn-save-quote').dataset.targetId;
                const quoteItem = targetId ? window.quoteDataList.find(x => x.id === targetId) : null;
                const currentData = quoteItem || constructQuoteObjectFromInputs();
                
                if(currentData) {
                    window.renderQuoteReport(currentData, true); // 인쇄 모드 (빈 행 추가)
                    const originalTitle = document.title;
                    const fileDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    const safeId = (currentData.id || 'Preview').replace('#', '');
                    document.title = `Quotation_${safeId}_${fileDate}`;
                    
                    // [엔진 교체] Electron 네이티브 printToPDF API 사용
                    await window.isolatedPrint('quote-official-template', document.title);
                    document.title = originalTitle;
                }
            });
        }

        if(btnSaveQuoteImg) {
            btnSaveQuoteImg.addEventListener('click', async () => {
                const targetId = document.getElementById('btn-save-quote').dataset.targetId;
                const quoteItem = targetId ? window.quoteDataList.find(x => x.id === targetId) : null;
                const currentData = quoteItem || constructQuoteObjectFromInputs();

                if(currentData) {
                    window.renderQuoteReport(currentData, false); // 이미지 모드 (콤팩트)
                    const tpl = document.getElementById('quote-official-template');
                    const originalMinHeight = tpl.style.minHeight;
                    
                    tpl.style.display = 'block';
                    tpl.style.minHeight = 'auto'; // 이미지 저장 시에만 최소 높이 해제
                    if (typeof window.showLoading === 'function') {
                        window.showLoading('이미지 렌더링 중입니다...');
                    }

                    try {
                        const canvas = await html2canvas(tpl, {
                            scale: 2,
                            useCORS: true,
                            logging: false,
                            backgroundColor: '#ffffff'
                        });
                        const link = document.createElement('a');
                        const fileDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                        const safeId = (currentData.id || 'IMG').replace('#', '');
                        link.download = `Quotation_${safeId}_${fileDate}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        
                        if (typeof window.hideLoading === 'function') window.hideLoading();
                        setTimeout(() => showAlert('이미지가 저장되었습니다.'), 300);
                    } catch (e) {
                        console.error('Quote Image Export Error:', e);
                        if (typeof window.hideLoading === 'function') window.hideLoading();
                        showAlert('이미지 생성 중 오류가 발생했습니다.');
                    } finally {
                        tpl.style.display = 'none';
                        tpl.style.minHeight = originalMinHeight;
                    }
                }
            });
        }

        function constructQuoteObjectFromInputs() {
            const items = [];
            document.querySelectorAll('.quote-row').forEach(row => {
                const name = row.querySelector('.row-name').value.trim();
                if(name) items.push({ 
                    cat: row.querySelector('.row-cat').value, 
                    name, 
                    price: parseInt(row.querySelector('.row-price').value) || 0, 
                    qty: parseInt(row.querySelector('.row-qty').value) || 0 
                });
            });
            return {
                id: document.getElementById('btn-save-quote').dataset.targetId || 'NEW',
                custName: document.getElementById('quote-cust-name').value || '고객',
                items: items,
                total: parseInt(document.getElementById('quote-total-val').textContent.replace(/,/g, '').replace('원', '')) || 0,
                memo: document.getElementById('quote-memo').value,
                date: new Date().toLocaleDateString()
            };
        }

        // Main List Search listener
        const quoteSearchInput = document.getElementById('search-input-quote');
        if(quoteSearchInput) {
            quoteSearchInput.addEventListener('input', function() {
                window.renderQuoteList(this.value);
            });
        }
    });

    window.renderQuoteReport = (q, isPrint = false) => {
        const tpl = {
            id: document.getElementById('tpl-off-quote-id'),
            date: document.getElementById('tpl-off-quote-date'),
            custName: document.getElementById('tpl-cust-name'),
            itemsList: document.getElementById('tpl-items-tbody'),
            memo: document.getElementById('tpl-quote-memo'),
            total: document.getElementById('tpl-total-val'),
            shopName: document.getElementById('tpl-shop-name'),
            shopBiz: document.getElementById('tpl-shop-biz-num'),
            shopCeo: document.getElementById('tpl-shop-ceo'),
            shopAddr: document.getElementById('tpl-shop-addr'),
            shopTel: document.getElementById('tpl-shop-tel'),
            shopType: document.getElementById('tpl-shop-type'),
            shopItem: document.getElementById('tpl-shop-item'),
            shopSeal: document.getElementById('tpl-shop-seal')
        };

        if(tpl.id) tpl.id.textContent = q.id;
        if(tpl.date) tpl.date.textContent = q.date;
        if(tpl.custName) tpl.custName.textContent = q.custName;
        if(tpl.memo) tpl.memo.textContent = q.memo || '내용 없음';
        if(tpl.total) tpl.total.textContent = q.total.toLocaleString();

        // Shop Settings Mapping
        const shop = window.shopSettings || {};
        if(tpl.shopName) tpl.shopName.textContent = shop.shopName || '-';
        if(tpl.shopBiz) tpl.shopBiz.textContent = shop.bizNum || '-';
        if(tpl.shopCeo) tpl.shopCeo.textContent = shop.ceoName || '-';
        if(tpl.shopAddr) tpl.shopAddr.textContent = shop.address || '-';
        if(tpl.shopTel) tpl.shopTel.textContent = shop.tel || '-';
        if(tpl.shopType) tpl.shopType.textContent = shop.bizType || '-';
        if(tpl.shopItem) tpl.shopItem.textContent = shop.bizItem || '-';
        
        if(tpl.shopSeal) {
            tpl.shopSeal.innerHTML = shop.seal ? `<img src="${shop.seal}" style="width:100%; height:100%; object-fit:contain; opacity:0.8;">` : '';
        }

        const bankNameEl = document.getElementById('tpl-bank-name');
        const bankAccountEl = document.getElementById('tpl-bank-account');
        if(bankNameEl) bankNameEl.textContent = shop.bankName || '';
        if(bankAccountEl) bankAccountEl.textContent = shop.bankAccount || '등록된 계좌 정보가 없습니다.';

        if(tpl.itemsList) {
            let rowsHtml = q.items.map(item => `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px 10px; color:#86868b; text-align:center; font-size:13px;">${item.cat}</td>
                    <td style="padding:8px 10px; font-weight:700; font-size:14px; color:#000;">${item.name}</td>
                    <td style="padding:8px 10px; text-align:center; font-size:13.5px;">${item.qty}개</td>
                    <td style="padding:8px 10px; text-align:right; color:#86868b; font-size:13.5px;">${item.price.toLocaleString()}원</td>
                    <td style="padding:8px 10px; text-align:right; font-weight:800; font-size:14px; color:#000;">${(item.price * item.qty).toLocaleString()}원</td>
                </tr>
            `).join('');

            // 하단 여백 방지를 위해 인쇄 모드(isPrint=true)에서만 최소 3행까지 빈 행 자동 추가
            if(isPrint) {
                const minRows = 3;
                if(q.items.length < minRows) {
                    for(let i = 0; i < (minRows - q.items.length); i++) {
                        rowsHtml += `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:8px 10px;">&nbsp;</td>
                                <td style="padding:8px 10px;"></td>
                                <td style="padding:8px 10px;"></td>
                                <td style="padding:8px 10px;"></td>
                                <td style="padding:8px 10px;"></td>
                            </tr>
                        `;
                    }
                }
            }
            tpl.itemsList.innerHTML = rowsHtml;
        }
    };

    window.loadQuoteData();
})();
