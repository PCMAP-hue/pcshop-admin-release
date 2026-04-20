// [Transaction Management Module]
(function() {
    window.transactionDataList = [];

    // [Vat Included Default Rule]
    const VAT_RATE = 0.1;

    window.loadTransactionData = () => {
        const saved = window.DB.get('PC_TransactionData');
        window.transactionDataList = saved ? JSON.parse(saved) : [];
    };

    window.saveTransactionData = () => {
        window.DB.set('PC_TransactionData', JSON.stringify(window.transactionDataList));
    };

    window.renderTransactionList = (query = '') => {
        const listContainer = document.getElementById('transaction-list-container');
        const emptyState = document.getElementById('transaction-empty-state');
        if(!listContainer) return;

        let filtered = query 
            ? window.transactionDataList.filter(t => t.id.includes(query) || t.custName.toLowerCase().includes(query.toLowerCase())) 
            : window.transactionDataList;

        if(filtered.length === 0 && window.transactionDataList.length === 0) {
            listContainer.style.display = 'none';
            if(emptyState) emptyState.style.display = 'block';
            return;
        }

        if(emptyState) emptyState.style.display = 'none';
        listContainer.style.display = 'block';

        const header = renderListHeader([
            { name: '명세서 번호', class: 'col-s' },
            { name: '고객명/상호', class: 'col-m' },
            { name: '품목 요약', class: 'col-flex' },
            { name: '총 합계', class: 'col-m', align: 'right' },
            { name: '발행일', class: 'col-s', align: 'center' },
            { name: '관리', class: 'col-action', align: 'center' }
        ], 'transaction-list');

        let html = header;
        filtered.forEach(t => {
            html += `
                <div class="list-row" onclick="handleEditTransaction('${t.id}')">
                    <div class="col-s v-bold c-accent">${t.id}</div>
                    <div class="col-m v-bold">${t.custName}</div>
                    <div class="col-flex c-muted">${t.summary}</div>
                    <div class="col-m t-right v-bold">${t.total.toLocaleString()}원</div>
                    <div class="col-s t-center c-muted" style="font-size:12px;">${t.date}</div>
                    <div class="col-action t-center">
                        <button class="btn-delete" onclick="handleDeleteTransaction('${t.id}', event)" title="삭제">
                            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html;
        applyColumnWidths('transaction-list-container', 'transaction-list');
        initResizableList('transaction-list-container', 'transaction-list');
        lucide.createIcons();
    };

    window.handleDeleteTransaction = async (id, e) => {
        if(e) e.stopPropagation();
        if(await showConfirm('해당 거래명세서를 삭제하시겠습니까?', '삭제')) {
            window.transactionDataList = window.transactionDataList.filter(t => t.id !== id);
            window.saveTransactionData();
            window.renderTransactionList();
        }
    };

    window.handleEditTransaction = (id) => {
        const t = window.transactionDataList.find(x => x.id === id);
        if(!t) return;

        document.getElementById('modal-transaction-title').textContent = t.id + ' - 거래명세서 수정';
        document.getElementById('trans-cust-name').value = t.custName;
        document.getElementById('trans-date').value = t.date;
        document.getElementById('trans-memo').value = t.memo || '';
        
        const tbody = document.getElementById('trans-items-tbody');
        tbody.innerHTML = '';
        t.items.forEach(item => addTransactionRow(item.cat, item.name, item.price, item.qty));
        
        const btnSave = document.getElementById('btn-save-trans');
        btnSave.textContent = '정보 업데이트';
        btnSave.dataset.targetId = id;
        
        // Show export actions for existing items
        document.getElementById('trans-export-actions').style.display = 'flex';
        
        // Restore VAT setting
        document.getElementById('trans-vat-type').value = t.vatType || 'include';
        
        document.getElementById('modal-transaction').style.display = 'flex';
        updateTransactionTotal();
    };

    function addTransactionRow(cat = '', name = '', price = 0, qty = 1) {
        const tr = document.createElement('tr');
        tr.className = 'trans-row';
        tr.innerHTML = `
            <td><input type="text" class="quote-table-input row-cat" value="${cat}" placeholder="분류"></td>
            <td><input type="text" class="quote-table-input row-name" value="${name}" placeholder="품명/모델명"></td>
            <td><input type="number" class="quote-table-input row-qty" value="${qty}" style="text-align:center;"></td>
            <td><input type="number" class="quote-table-input row-price" value="${price}" style="text-align:right;"></td>
            <td class="row-amount t-right v-bold" style="font-size:14px;">0원</td>
            <td class="t-center">
                <button class="btn-row-del"><i data-lucide="minus-circle" style="width:14px;height:14px;"></i></button>
            </td>
        `;
        
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', updateTransactionTotal));
        tr.querySelector('.btn-row-del').addEventListener('click', () => {
            tr.remove();
            updateTransactionTotal();
        });
        
        document.getElementById('trans-items-tbody').appendChild(tr);
        lucide.createIcons();
        updateTransactionTotal();
    }

    function updateTransactionTotal() {
        const vatType = document.getElementById('trans-vat-type').value;
        const vatLabel = document.getElementById('trans-vat-label');
        if(vatLabel) vatLabel.textContent = (vatType === 'include') ? '(VAT 포함)' : '(VAT 별도)';

        let total = 0;
        document.querySelectorAll('.trans-row').forEach(row => {
            const qty = parseInt(row.querySelector('.row-qty').value) || 0;
            const price = parseInt(row.querySelector('.row-price').value) || 0;
            const amount = qty * price;
            row.querySelector('.row-amount').textContent = amount.toLocaleString() + '원';
            total += amount;
        });

        // Calculation: if exclude, the total is supply * 1.1? 
        // Or is it just a display setting for the report?
        // Usually, in these types of forms, if "Exclude" is chosen, the price is supply and total is price * 1.1.
        // But looking at the existing code, it seems the price entered is considered the final amount for that line.
        // Let's stick to the convention where 'exclude' means the total sum is auto-calculated as sum * 1.1.
        let finalTotal = (vatType === 'exclude') ? Math.round(total * 1.1) : total;
        document.getElementById('trans-total-val').textContent = finalTotal.toLocaleString();
    }

    document.addEventListener('DOMContentLoaded', () => {
        const modalTrans = document.getElementById('modal-transaction');
        const btnCloseModal = document.getElementById('btn-close-modal-transaction');
        const btnCancel = document.getElementById('btn-cancel-trans');
        const btnSave = document.getElementById('btn-save-trans');
        const btnAddRow = document.getElementById('btn-add-trans-row');
        const btnOpenTrans = document.getElementById('btn-open-transaction');
        const btnLoadLedger = document.getElementById('btn-load-ledger');
        const btnSearchCust = document.getElementById('btn-search-cust-trans');
        const searchInput = document.getElementById('search-input-transaction');

        // [New Transaction Open]
        if(btnOpenTrans) {
            btnOpenTrans.addEventListener('click', () => {
                document.getElementById('modal-transaction-title').textContent = '신규 거래명세서 발행';
                document.getElementById('trans-cust-name').value = '';
                document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
                document.getElementById('trans-memo').value = '';
                document.getElementById('trans-items-tbody').innerHTML = '';
                document.getElementById('trans-export-actions').style.display = 'none';
                
                // Add 3 default empty rows
                for(let i=0; i<3; i++) addTransactionRow();
                
                btnSave.textContent = '명세서 저장하기';
                delete btnSave.dataset.targetId;
                document.getElementById('trans-vat-type').value = 'include';
                modalTrans.style.display = 'flex';
                updateTransactionTotal();
            });
        }

        const transVatType = document.getElementById('trans-vat-type');
        if(transVatType) transVatType.addEventListener('change', updateTransactionTotal);

        if(btnAddRow) btnAddRow.addEventListener('click', () => addTransactionRow());
        if(btnCloseModal) btnCloseModal.addEventListener('click', () => modalTrans.style.display = 'none');
        if(btnCancel) btnCancel.addEventListener('click', () => modalTrans.style.display = 'none');

        // [Search Customer]
        if(btnSearchCust) {
            btnSearchCust.addEventListener('click', () => {
                window.openGeneralPicker({
                    title: '대상 고객 검색 및 선택',
                    data: window.customerDataList || [],
                    filterFn: (item, query) => item.name.toLowerCase().includes(query) || (item.phone && item.phone.includes(query)),
                    renderFn: (item) => `
                        <div style="font-weight:700;">${item.name}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${item.phone || ''}</div>
                    `,
                    onSelect: (item) => {
                        document.getElementById('trans-cust-name').value = item.name;
                        // Show Choice Modal
                        const modalChoice = document.getElementById('modal-trans-choice');
                        if(modalChoice) modalChoice.style.display = 'flex';
                    }
                });
            });
        }

        // [Choice Modal Listeners]
        const modalChoice = document.getElementById('modal-trans-choice');
        const btnChoiceManual = document.getElementById('btn-trans-choice-manual');
        const btnChoiceLoad = document.getElementById('btn-trans-choice-load');
        const btnChoiceCancel = document.getElementById('btn-trans-choice-cancel');

        if(btnChoiceManual) {
            btnChoiceManual.onclick = () => {
                modalChoice.style.display = 'none';
                showAlert('상세 내역을 직접 입력해 주세요.');
            };
        }

        if(btnChoiceCancel) {
            btnChoiceCancel.onclick = () => {
                modalChoice.style.display = 'none';
            };
        }

        if(btnChoiceLoad) {
            btnChoiceLoad.onclick = () => {
                modalChoice.style.display = 'none';
                const customerName = document.getElementById('trans-cust-name').value;
                loadLedgerForCustomer(customerName);
            };
        }

        function loadLedgerForCustomer(custName) {
            // [Fixed] trim() 및 존재 여부 체크로 필터링 신뢰도 향상
            const results = (window.ledgerDataList || []).filter(l => 
                l.type === '매출' && 
                l.targetName && 
                l.targetName.trim() === custName.trim()
            );
            
            if(results.length === 0) {
                showAlert(`${custName} 고객님의 등록된 매출 내역이 없습니다. 정보를 직접 입력해 주세요.`);
                return;
            }

            window.openGeneralPicker({
                title: `${custName} 고객 매출 내역 선택`,
                placeholder: '품목명 검색...',
                data: results,
                showAllOnEmpty: true, // [Fixed] 이 단계에서만 즉시 노출
                filterFn: (item, query) => item.itemName.toLowerCase().includes(query),
                renderFn: (item) => `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:700;">${item.itemName}</div>
                            <div style="font-size:11px; color:var(--text-muted);">${item.date}</div>
                        </div>
                        <div style="font-weight:800; color:var(--accent);">${item.amount.toLocaleString()}원</div>
                    </div>
                `,
                onSelect: (item) => {
                    if(item.date) document.getElementById('trans-date').value = item.date;
                    document.getElementById('trans-items-tbody').innerHTML = '';
                    addTransactionRow(item.category, item.itemName, item.amount, 1);
                    showAlert('매출 내역이 성공적으로 불러와졌습니다.');
                }
            });
        }

        // [Save Transaction]
        if(btnSave) {
            btnSave.addEventListener('click', () => {
                const custName = document.getElementById('trans-cust-name').value.trim();
                const date = document.getElementById('trans-date').value;
                const memo = document.getElementById('trans-memo').value.trim();
                
                if(!custName) { showAlert('대상 고객명 또는 상호를 입력해주세요.'); return; }
                if(!date) { showAlert('발행 일자를 선택해주세요.'); return; }

                const items = [];
                document.querySelectorAll('.trans-row').forEach(row => {
                    const name = row.querySelector('.row-name').value.trim();
                    if(name) {
                        items.push({
                            cat: row.querySelector('.row-cat').value.trim(),
                            name: name,
                            qty: parseInt(row.querySelector('.row-qty').value) || 0,
                            price: parseInt(row.querySelector('.row-price').value) || 0
                        });
                    }
                });

                if(items.length === 0) { showAlert('최소 1개 이상의 품목을 입력해주세요.'); return; }

                const total = parseInt(document.getElementById('trans-total-val').textContent.replace(/,/g, '')) || 0;
                const targetId = btnSave.dataset.targetId;
                
                const summary = items[0].name + (items.length > 1 ? ` 외 ${items.length - 1}건` : '');

                const transItem = {
                    id: targetId || '#T' + Date.now().toString().slice(-6),
                    custName, date, memo, items, total, summary,
                    vatType: document.getElementById('trans-vat-type').value
                };

                if(targetId) {
                    const idx = window.transactionDataList.findIndex(x => x.id === targetId);
                    if(idx > -1) window.transactionDataList[idx] = transItem;
                    delete btnSave.dataset.targetId;
                } else {
                    window.transactionDataList.unshift(transItem);
                }

                window.saveTransactionData();
                window.renderTransactionList();
                modalTrans.style.display = 'none';
                showAlert('거래명세서가 저장되었습니다.');
            });
        }

        if(searchInput) {
            searchInput.addEventListener('input', (e) => window.renderTransactionList(e.target.value));
        }

        // [Print/Image Export Listeners]
        const btnPrint = document.getElementById('btn-trans-report-print');
        const btnImg = document.getElementById('btn-trans-report-img');

        if(btnPrint) {
            btnPrint.addEventListener('click', async () => {
                const type = document.getElementById('trans-print-type').value;
                const data = constructCurrentTransObject();
                if(!data) return;

                const tplId = (type === 'a4') ? 'trans-report-a4-template' : 'trans-report-standard-template';
                window.renderTransReport(data, type);
                
                const fileDate = data.date.replace(/-/g, '');
                const safeId = data.id.replace('#', '');
                const title = `Transaction_${safeId}_${fileDate}`;
                
                await window.isolatedPrint(tplId, title);
            });
        }

        if(btnImg) {
            btnImg.addEventListener('click', async () => {
                const type = document.getElementById('trans-print-type').value;
                const data = constructCurrentTransObject();
                if(!data) return;

                const tplId = (type === 'a4') ? 'trans-report-a4-template' : 'trans-report-standard-template';
                window.renderTransReport(data, type);
                
                const tpl = document.getElementById(tplId);
                tpl.style.display = 'block';
                
                if(typeof window.showLoading === 'function') window.showLoading('이미지 생성 중...');
                
                try {
                    const canvas = await html2canvas(tpl, {
                        scale: 2,
                        logging: false,
                        backgroundColor: '#ffffff'
                    });
                    const link = document.createElement('a');
                    const fileDate = data.date.replace(/-/g, '');
                    const safeId = data.id.replace('#', '');
                    link.download = `Transaction_${safeId}_${fileDate}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    if(typeof window.hideLoading === 'function') window.hideLoading();
                } catch(e) {
                    console.error(e);
                    if(typeof window.hideLoading === 'function') window.hideLoading();
                    showAlert('이미지 저장 중 오류가 발생했습니다.');
                } finally {
                    tpl.style.display = 'none';
                }
            });
        }

        function constructCurrentTransObject() {
            const btnSave = document.getElementById('btn-save-trans');
            const targetId = btnSave.dataset.targetId;
            
            const items = [];
            document.querySelectorAll('.trans-row').forEach(row => {
                const name = row.querySelector('.row-name').value.trim();
                if(name) {
                    items.push({
                        cat: row.querySelector('.row-cat').value.trim(),
                        name: name,
                        qty: parseInt(row.querySelector('.row-qty').value) || 0,
                        price: parseInt(row.querySelector('.row-price').value) || 0
                    });
                }
            });

            return {
                id: targetId || 'PREVIEW',
                custName: document.getElementById('trans-cust-name').value || '고객님',
                date: document.getElementById('trans-date').value || new Date().toISOString().split('T')[0],
                memo: document.getElementById('trans-memo').value,
                items: items,
                total: parseInt(document.getElementById('trans-total-val').textContent.replace(/,/g, '')) || 0,
                vatType: document.getElementById('trans-vat-type').value
            };
        }
    });

    // [Report Rendering Logic]
    window.renderTransReport = (data, type) => {
        const shop = window.shopSettings || {};
        if(type === 'a4') {
            renderA4(data, shop);
        } else {
            renderStandard(data, shop);
        }
    };

    function renderA4(data, shop) {
        // [Header Info]
        const headerDate = document.getElementById('tpl-trans-a4-header-date');
        if(headerDate) headerDate.textContent = '발행일자: ' + data.date;
        
        const headerPic = document.getElementById('tpl-trans-a4-header-pic');
        if(headerPic) headerPic.textContent = '담당자: ________________';

        // [Recipient Side]
        document.getElementById('tpl-trans-a4-cust-name-main').textContent = data.custName;
        
        let custInfo = { address: '', phone: '' };
        if(window.customerDataList) {
            const found = window.customerDataList.find(c => c.name === data.custName);
            if(found) {
                custInfo.address = found.address || '';
                custInfo.phone = found.phone || '';
            }
        }
        document.getElementById('tpl-trans-a4-cust-addr').textContent = custInfo.address;
        document.getElementById('tpl-trans-a4-cust-tel').textContent = custInfo.phone;
        document.getElementById('tpl-trans-a4-total-big').textContent = '₩ ' + data.total.toLocaleString();

        // [Provider Side]
        document.getElementById('tpl-trans-a4-biz-num').textContent = shop.bizNum || '';
        document.getElementById('tpl-trans-a4-shop-name').textContent = shop.shopName || '';
        document.getElementById('tpl-trans-a4-ceo').textContent = shop.ceoName || '';
        document.getElementById('tpl-trans-a4-addr').textContent = shop.address || '';
        document.getElementById('tpl-trans-a4-tel').textContent = shop.tel || '';
        
        const sealDiv = document.getElementById('tpl-trans-a4-seal');
        if(sealDiv) {
            sealDiv.innerHTML = shop.seal ? `<img src="${shop.seal}" style="width:100%; height:100%; object-fit:contain; opacity:0.8;">` : '';
        }

        // [Items Table - Optimized Proportions]
        const tbody = document.getElementById('tpl-trans-a4-items');
        tbody.innerHTML = '';
        
        let subTotal = 0;
        let taxTotal = 0;

        data.items.forEach((item, idx) => {
            const amount = item.price * item.qty;
            let supplyAmt, vatAmt;
            
            if(data.vatType === 'exclude') {
                supplyAmt = amount;
                vatAmt = Math.round(amount * 0.1);
            } else {
                supplyAmt = Math.round(amount / 1.1);
                vatAmt = amount - supplyAmt;
            }
            
            subTotal += supplyAmt;
            taxTotal += vatAmt;

            const tr = document.createElement('tr');
            tr.style.textAlign = 'center';
            tr.style.height = '32px';
            tr.innerHTML = `
                <td style="border-bottom:1px solid #000; border-right:1px solid #000;">${idx + 1}</td>
                <td style="border-bottom:1px solid #000; border-right:1px solid #000; font-size:11px;">${data.date}</td>
                <td style="border-bottom:1px solid #000; border-right:1px solid #000; text-align:left; padding-left:10px;">${item.name}</td>
                <td style="border-bottom:1px solid #000; border-right:1px solid #000;">${item.qty}</td>
                <td style="border-bottom:1px solid #000; border-right:1px solid #000; text-align:right; padding-right:6px;">${item.price.toLocaleString()}</td>
                <td style="border-bottom:1px solid #000; border-right:1px solid #000; text-align:right; padding-right:6px;">${supplyAmt.toLocaleString()}</td>
                <td style="border-bottom:1px solid #000; border-right:1px solid #000; text-align:right; padding-right:6px;">${vatAmt.toLocaleString()}</td>
                <td style="border-bottom:1px solid #000;"></td>
            `;
            tbody.appendChild(tr);
        });

        const minRows = 22;
        if(data.items.length < minRows) {
            for(let i=0; i<minRows - data.items.length; i++) {
                const tr = document.createElement('tr');
                tr.style.height = '32px';
                tr.innerHTML = `
                    <td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td>
                    <td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td>
                    <td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td>
                    <td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td>
                    <td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td>
                    <td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td>
                    <td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td>
                    <td style="border-bottom:1px solid #000;"></td>
                `;
                tbody.appendChild(tr);
            }
        }

        document.getElementById('tpl-trans-a4-summary-supply').textContent = subTotal.toLocaleString();
        document.getElementById('tpl-trans-a4-summary-vat').textContent = taxTotal.toLocaleString();
        document.getElementById('tpl-trans-a4-summary-total').textContent = '₩ ' + data.total.toLocaleString();
    }

    function renderStandard(data, shop) {
        const providerArea = document.getElementById('standard-provider-copy');
        const recipientArea = document.getElementById('standard-recipient-copy');

        let custInfo = { address: '', phone: '' };
        if(window.customerDataList) {
            const found = window.customerDataList.find(c => c.name === data.custName);
            if(found) {
                custInfo.address = found.address || '';
                custInfo.phone = found.phone || '';
            }
        }

        const createContent = (title) => {
            let totalSupply = 0;
            let totalVat = 0;

            const itemsRows = data.items.map((item, idx) => {
                const amount = item.price * item.qty;
                let supplyAmt, vatAmt;

                if(data.vatType === 'exclude') {
                    supplyAmt = amount;
                    vatAmt = Math.round(amount * 0.1);
                } else {
                    supplyAmt = Math.round(amount / 1.1);
                    vatAmt = amount - supplyAmt;
                }

                totalSupply += supplyAmt;
                totalVat += vatAmt;

                return `
                    <tr style="font-size:10px; text-align:center; height:22px;">
                        <td style="border-bottom:1px solid #000; border-right:1px solid #000;">${idx + 1}</td>
                        <td style="border-bottom:1px solid #000; border-right:1px solid #000; font-size:9px;">${data.date}</td>
                        <td style="border-bottom:1px solid #000; border-right:1px solid #000; text-align:left; padding-left:8px;">${item.name}</td>
                        <td style="border-bottom:1px solid #000; border-right:1px solid #000;">${item.qty}</td>
                        <td style="border-bottom:1px solid #000; border-right:1px solid #000; text-align:right; padding-right:4px;">${item.price.toLocaleString()}</td>
                        <td style="border-bottom:1px solid #000; border-right:1px solid #000; text-align:right; padding-right:4px;">${supplyAmt.toLocaleString()}</td>
                        <td style="border-bottom:1px solid #000; border-right:1px solid #000; text-align:right; padding-right:4px;">${vatAmt.toLocaleString()}</td>
                        <td style="border-bottom:1px solid #000;"></td>
                    </tr>
                `;
            });

            const minRows = 8;
            for(let i=itemsRows.length; i<minRows; i++) {
                itemsRows.push(`<tr style="height:22px;"><td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td><td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td><td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td><td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td><td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td><td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td><td style="border-bottom:1px solid #000; border-right:1px solid #000;"></td><td style="border-bottom:1px solid #000;"></td></tr>`);
            }

            return `
                <div style="font-family:'Pretendard', sans-serif; height:100%; box-sizing:border-box; display:flex; flex-direction:column;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px; font-size:10px;">
                        <div>발행일자: ${data.date}</div>
                        <div style="font-weight:700;">담당자: ________________</div>
                    </div>
                    <div style="border:2px solid #000; display:flex; flex-direction:column; background:#fff;">
                        <div style="border-bottom:2px solid #000; display:flex; justify-content:center; align-items:center; padding:6px; position:relative;">
                            <h3 style="margin:0; font-size:20px; border:2px solid #000; padding:2px 14px; letter-spacing:5px;">거 래 명 세 서</h3>
                            <span style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:10px;">(${title})</span>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1.2fr; border-bottom:1px solid #000;">
                            <table style="width:100%; border-collapse:collapse; font-size:10px; border-right:1px solid #000;">
                                <tr>
                                    <td rowspan="4" style="width:25px; background:#f2f2f2; border-right:1px solid #000; text-align:center; font-weight:700; line-height:1.4;">공<br>급<br>받<br>는<br>자</td>
                                    <td style="width:50px; background:#f2f2f2; border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; text-align:center;">상 호</td>
                                    <td style="border-bottom:1px solid #000; padding:4px; font-weight:700;">${data.custName}</td>
                                </tr>
                                <tr>
                                    <td style="background:#f2f2f2; border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; text-align:center;">주 소</td>
                                    <td style="border-bottom:1px solid #000; padding:4px; height:24px; vertical-align:top; font-size:9px;">${custInfo.address}</td>
                                </tr>
                                <tr>
                                    <td style="background:#f2f2f2; border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; text-align:center;">전 화</td>
                                    <td style="border-bottom:1px solid #000; padding:4px;">${custInfo.phone}</td>
                                </tr>
                                <tr>
                                    <td style="background:#f2f2f2; border-right:1px solid #000; padding:4px; text-align:center;">합계금액</td>
                                    <td style="padding:4px; font-weight:700; text-align:right;">₩ ${data.total.toLocaleString()}</td>
                                </tr>
                            </table>
                            <table style="width:100%; border-collapse:collapse; font-size:10px;">
                                <tr>
                                    <td rowspan="4" style="width:25px; background:#f2f2f2; border-right:1px solid #000; text-align:center; font-weight:700; line-height:1.4;">공<br>급<br>자</td>
                                    <td style="width:60px; background:#f2f2f2; border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; text-align:center;">등록번호</td>
                                    <td colspan="3" style="border-bottom:1px solid #000; padding:4px; font-weight:700;">${shop.bizNum || ''}</td>
                                </tr>
                                <tr>
                                    <td style="background:#f2f2f2; border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; text-align:center;">상 호</td>
                                    <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; font-weight:700;">${shop.shopName || ''}</td>
                                    <td style="width:25px; background:#f2f2f2; border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; text-align:center;">성명</td>
                                    <td style="border-bottom:1px solid #000; position:relative; padding:4px; width:50px;">
                                        ${shop.ceoName || ''}
                                        ${shop.seal ? `<img src="${shop.seal}" style="position:absolute; right:1px; top:0; width:34px; height:34px; opacity:0.8;">` : ''}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background:#f2f2f2; border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; text-align:center;">주 소</td>
                                    <td colspan="3" style="border-bottom:1px solid #000; padding:4px; font-size:9px; vertical-align:top; height:24px;">${shop.address || ''}</td>
                                </tr>
                                <tr>
                                    <td style="background:#f2f2f2; border-right:1px solid #000; padding:4px; text-align:center;">전 화</td>
                                    <td style="border-right:1px solid #000; padding:4px;">${shop.tel || ''}</td>
                                    <td style="width:25px; background:#f2f2f2; border-right:1px solid #000; padding:4px; text-align:center;">팩스</td>
                                    <td style="padding:4px;">-</td>
                                </tr>
                            </table>
                        </div>
                        <table style="width:100%; border-collapse:collapse; border-bottom:1px solid #000;">
                            <thead>
                                <tr style="background:#f2f2f2; font-size:10px; font-weight:700; text-align:center;">
                                    <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; width:25px;">NO</td>
                                    <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; width:65px;">거래일자</td>
                                    <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px;">품 목</td>
                                    <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; width:30px;">수량</td>
                                    <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; width:65px;">단가</td>
                                    <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; width:65px;">공급가액</td>
                                    <td style="border-bottom:1px solid #000; border-right:1px solid #000; padding:4px; width:55px;">세액</td>
                                    <td style="border-bottom:1px solid #000; padding:4px;">비고</td>
                                </tr>
                            </thead>
                            <tbody>${itemsRows.join('')}</tbody>
                        </table>
                        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-top:auto;">
                            <tr style="height:36px; text-align:center;">
                                <td style="width:40px; background:#f2f2f2; border-right:1px solid #000;">공급<br>가액</td>
                                <td style="border-right:1px solid #000; width:90px; text-align:right; padding-right:6px; font-weight:700;">${totalSupply.toLocaleString()}</td>
                                <td style="width:40px; background:#f2f2f2; border-right:1px solid #000;">세액</td>
                                <td style="border-right:1px solid #000; width:70px; text-align:right; padding-right:6px; font-weight:700;">${totalVat.toLocaleString()}</td>
                                <td style="width:50px; background:#f2f2f2; border-right:1px solid #000;">합계금액</td>
                                <td style="border-right:1px solid #000; text-align:right; padding-right:10px; font-weight:800; font-size:14px; color:var(--accent);">₩ ${data.total.toLocaleString()}</td>
                                <td style="width:40px; background:#f2f2f2; border-right:1px solid #000;">인수자</td>
                                <td style="text-align:right; padding-right:6px; color:#aaa; font-size:9px;">(인)</td>
                            </tr>
                        </table>
                    </div>
                </div>
            `;
        };

        providerArea.innerHTML = createContent('공급자 보관용');
        recipientArea.innerHTML = createContent('공급받는자 보관용');
    }

    window.loadTransactionData();
})();
