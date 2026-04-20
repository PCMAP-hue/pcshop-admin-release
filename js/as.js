// [AS Management Module]
(function() {
    window.asDataList = [];

    window.loadAsData = () => {
        const saved = window.DB.get('PC_AsDataList');
        window.asDataList = saved ? JSON.parse(saved) : [];
    };

    window.saveASToStorage = () => {
        window.DB.set('PC_AsDataList', JSON.stringify(window.asDataList));
    };

    const getStatusConfig = (status) => {
        const configs = {
            '대기중': { cl: 'status-pending', text: '대기중' },
            '수리중': { cl: 'status-repair', text: '수리중' },
            '결제대기': { cl: 'status-payment', text: '결제대기' },
            '완료': { cl: 'status-completed', text: '완료' }
        };
        return configs[status] || configs['대기중'];
    };

    window.renderASLists = (query = '') => {
        const dashboardList = document.getElementById('dashboard-as-list');
        const managementList = document.getElementById('management-as-list');
        const headerHTML_dash = renderListHeader([
            { name: 'AS번호', class: 'col-s' },
            { name: '접수날짜', class: 'col-s' },
            { name: '완료날짜', class: 'col-s' },
            { name: '고객명', class: 'col-m' },
            { name: '접수 내용 및 증상', class: 'col-flex' },
            { name: '상태', class: 'col-m', align: 'center' },
            { name: '관리', class: 'col-action', align: 'center' }
        ], 'as-list-dash');

        const headerHTML_mng = renderListHeader([
            { name: 'AS번호', class: 'col-s' },
            { name: '접수날짜', class: 'col-s' },
            { name: '완료날짜', class: 'col-s' },
            { name: '고객명', class: 'col-m' },
            { name: '접수 내용 및 증상', class: 'col-flex' },
            { name: '상태', class: 'col-m', align: 'center' },
            { name: '관리', class: 'col-action', align: 'center' }
        ], 'as-list-mng');

        if(dashboardList) {
            const now = new Date();
            const ty = now.getFullYear(); const tm = now.getMonth() + 1; const td = now.getDate();
            
            const todayItems = window.asDataList.filter(item => {
                const parts = item.date.match(/\d+/g);
                if(!parts || parts.length < 3) return false;
                let dy = parseInt(parts[0]); let dm = parseInt(parts[1]); let dd = parseInt(parts[2]);
                if(dy < 100) dy += 2000;
                return ty === dy && tm === dm && td === dd;
            }).slice(0, 5);

            if(todayItems.length === 0) {
                dashboardList.innerHTML = `
                    <div style="padding:40px; text-align:center; color:var(--text-muted);">
                        <i data-lucide="info" style="width:32px;height:32px;opacity:0.3;margin-bottom:12px;"></i>
                        <div style="font-size:14px; font-weight:500;">오늘 접수된 AS 내역이 없습니다.</div>
                    </div>
                `;
            } else {
                let dashHTML = headerHTML_dash;
                todayItems.forEach(item => {
                    const conf = getStatusConfig(item.status);
                    const compDate = item.completionDate ? item.completionDate.split('-').map(s => s.slice(-2)).join('.') : '';
                    dashHTML += `
                        <div class="list-row" onclick="handleEditAs('${item.id}')">
                            <div class="col-s v-bold c-accent">${item.id}</div>
                            <div class="col-s c-muted" style="font-size:12px;">${item.date}</div>
                            <div class="col-s c-muted" style="font-size:12px;">${compDate}</div>
                            <div class="col-m v-bold">${item.name} <span class="c-muted" style="font-weight:400; font-size:11px;">(${item.type})</span></div>
                            <div class="col-flex c-muted" style="font-size:13px;" title="${item.issues}">${item.issues}</div>
                            <div class="col-m t-center"><span class="status-badge ${conf.cl}" style="font-size:11px; padding:4px 10px;">${conf.text}</span></div>
                            <div class="col-action t-center"><button class="btn-delete" onclick="handleDeleteAs('${item.id}', event)" title="삭제"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button></div>
                        </div>
                    `;
                });
                dashboardList.innerHTML = dashHTML;
                applyColumnWidths('dashboard-as-list', 'as-list-dash');
                initResizableList('dashboard-as-list', 'as-list-dash');
            }
        }
        
        if(managementList) {
            let mngHTML = headerHTML_mng;
            const filtered = query ? window.asDataList.filter(item => item.name.includes(query) || item.id.includes(query)) : window.asDataList;
            if(filtered.length === 0) {
                mngHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">검색 결과가 없습니다.</div>`;
            } else {
                filtered.forEach(item => {
                    const conf = getStatusConfig(item.status);
                    const compDate = item.completionDate ? item.completionDate.split('-').map(s => s.slice(-2)).join('.') : '';
                    mngHTML += `
                        <div class="list-row" onclick="handleEditAs('${item.id}')">
                            <div class="col-s v-bold c-accent">${item.id}</div>
                            <div class="col-s c-muted" style="font-size:13px;">${item.date}</div>
                            <div class="col-s c-muted" style="font-size:13px;">${compDate}</div>
                            <div class="col-m v-bold">${item.name} <span class="c-muted" style="font-weight:400; font-size:12px;">(${item.type})</span></div>
                            <div class="col-flex c-muted" title="${item.issues}">${item.issues}</div>
                            <div class="col-m t-center"><span class="status-badge ${conf.cl}">${conf.text}</span></div>
                            <div class="col-action" style="display:flex; align-items:center; justify-content:center; gap:8px;">
                                <select class="apple-select" onclick="event.stopPropagation()" onchange="handleChangeStatus('${item.id}', this)" style="padding-right:24px; min-width:90px;">
                                    <option value="대기중" ${item.status==='대기중'?'selected':''}>대기중</option>
                                    <option value="수리중" ${item.status==='수리중'?'selected':''}>수리중</option>
                                    <option value="결제대기" ${item.status==='결제대기'?'selected':''}>결제대기</option>
                                    <option value="완료" ${item.status==='완료'?'selected':''}>완료</option>
                                </select>
                                <button class="btn-delete" onclick="handleDeleteAs('${item.id}', event)" title="삭제">
                                    <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
            managementList.innerHTML = mngHTML;
            applyColumnWidths('management-as-list', 'as-list-mng');
            initResizableList('management-as-list', 'as-list-mng');
        }
        lucide.createIcons();
    };

    window.handleChangeStatus = async (id, elm) => {
        const item = window.asDataList.find(x => x.id === id);
        if(item) {
            const oldStatus = item.status;
            const newStatus = elm.value;

            if(newStatus === '완료' && oldStatus !== '완료') {
                // 재고 부족 검증
                if(item.usedParts && item.usedParts.length > 0) {
                    for(const p of item.usedParts) {
                        if(p.stockId && !p.isDeducted) {
                            const sItem = (window.stockDataList || []).find(s => s.id === p.stockId);
                            if(sItem && sItem.qty < p.qty) {
                                showAlert(`재고가 부족하여 완료 처리할 수 없습니다.\n\n부품: ${p.name}\n실재고: ${sItem.qty}개 / 투입수량: ${p.qty}개\n\n(실재고보다 투입수량이 높습니다(주의))`);
                                elm.value = oldStatus;
                                return;
                            }
                        }
                    }
                }

                if(!await showConfirm('이 AS 건을 완료 처리하시겠습니까?\n재고가 자동으로 차감됩니다.', '완료 처리')) {
                    elm.value = oldStatus; return;
                }
                window.deductStockForAs(item);
                const now = new Date();
                item.completionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            } else if (newStatus !== '완료') delete item.completionDate;
            item.status = newStatus;
            window.saveASToStorage();
            window.renderASLists();
            window.updateDashboardWidgets();
        }
    };

    window.handleDeleteAs = async (id, e) => {
        if(e) e.stopPropagation();
        if(await showConfirm('해당 AS 내역을 삭제하시겠습니까?', '삭제')) {
            window.asDataList = window.asDataList.filter(x => x.id !== id);
            window.saveASToStorage();
            window.renderASLists();
            window.updateDashboardWidgets();
        }
    };

    window.handleEditAs = (id) => {
        const item = window.asDataList.find(x => x.id === id);
        if(!item) return;
        document.getElementById('modal-as-title').textContent = id + ' - 상세 및 수정';
        document.getElementById('as-cust-name').value = item.name;
        document.getElementById('as-date').value = item.fullDate || new Date().toISOString().split('T')[0];
        document.getElementById('as-memo').value = item.memo || '';
        document.getElementById('as-inspect-result').value = item.inspectResult || '';
        document.getElementById('as-action-result').value = item.actionResult || '';
        document.getElementById('as-labor-fee').value = item.laborFee || 0;
        document.getElementById('as-part-fee').value = item.partFee || 0;
        document.getElementById('as-total-fee').value = item.totalFee || 0;
        
        const partsTbody = document.getElementById('as-parts-tbody');
        partsTbody.innerHTML = '';
        if(item.usedParts) item.usedParts.forEach(p => addUsedPartRow(p.name, p.qty, p.price, p.stockId, p.isDeducted));
        
        const issuesArr = (item.issues || '').split(', ').map(s => s.trim());
        document.querySelectorAll('input[name="as-issue"]').forEach(cb => cb.checked = issuesArr.includes(cb.value));
        document.querySelectorAll('input[name="as-type"]').forEach(r => r.checked = (r.value === item.type));
        document.querySelectorAll('input[name="as-payment"]').forEach(r => r.checked = (r.value === (item.payment || 'cash')));
        
        showAsTab('reception');
        
        const statusSelect = document.getElementById('as-status-select');
        const compGroup = document.getElementById('as-completion-date-group');
        const compInput = document.getElementById('as-completion-date');
        
        statusSelect.value = item.status || '대기중';
        if(item.status === '완료') {
            compGroup.style.display = 'block';
            compInput.value = item.completionDate || new Date().toISOString().split('T')[0];
        } else {
            compGroup.style.display = 'none';
            compInput.value = '';
        }

        const btnSave = document.getElementById('btn-save-as');
        btnSave.textContent = 'AS 내역 수정하기';
        btnSave.dataset.targetId = id;
        document.getElementById('as-report-actions').style.display = (item.status === '완료') ? 'flex' : 'none';
        
        // 상태 변경 시 리포트 버튼 및 완료 날짜 필드 동적 노출 제어
        statusSelect.onchange = (e) => {
            const status = e.target.value;
            document.getElementById('as-report-actions').style.display = (status === '완료' && id) ? 'flex' : 'none';
            if(status === '완료') {
                compGroup.style.display = 'block';
                if(!compInput.value) compInput.value = new Date().toISOString().split('T')[0];
            } else {
                compGroup.style.display = 'none';
            }
        };

        document.getElementById('modal-as').style.display = 'flex';
    };

    function showAsTab(tabId) {
        document.querySelectorAll('.as-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        document.querySelectorAll('.as-tab-content').forEach(c => c.style.display = c.id === `as-tab-${tabId}` ? 'block' : 'none');
    }

    function updateAsFees() {
        let totalPartCost = 0;
        document.querySelectorAll('#as-parts-tbody tr').forEach(row => {
            const qty = parseInt(row.querySelector('.row-qty').value) || 0;
            const price = parseInt(row.querySelector('.row-price').value) || 0;
            totalPartCost += qty * price;
        });
        
        const partFeeInput = document.getElementById('as-part-fee');
        const laborFeeInput = document.getElementById('as-labor-fee');
        const totalFeeInput = document.getElementById('as-total-fee');
        
        if (partFeeInput) partFeeInput.value = totalPartCost;
        
        const labor = parseInt(laborFeeInput?.value) || 0;
        const parts = parseInt(partFeeInput?.value) || 0;
        if (totalFeeInput) totalFeeInput.value = labor + parts;
    }

    function addUsedPartRow(name = '', qty = 1, price = 0, stockId = null, isDeducted = false) {
        const tr = document.createElement('tr');
        tr.dataset.stockId = stockId || '';
        tr.dataset.isDeducted = isDeducted ? 'true' : 'false';

        // 실재고 수량 가져오기
        const stockItem = stockId ? (window.stockDataList || []).find(s => s.id === stockId) : null;
        const stockQtyText = stockItem ? ` / 실재고: ${stockItem.qty}개` : '';

        tr.innerHTML = `
            <td>
                <input type="text" class="quote-table-input row-name" value="${name}" placeholder="부품명">
                ${stockId ? `<span style="font-size:10px; color:var(--success-color); display:block; margin-top:2px;">(재고 연동됨${isDeducted ? ': 차감됨' : ''}${stockQtyText})</span>` : ''}
            </td>
            <td><input type="number" class="quote-table-input row-qty" value="${qty}" style="text-align:center;" ${isDeducted ? 'readonly' : ''}></td>
            <td><input type="number" class="quote-table-input row-price" value="${price}" style="text-align:right;"></td>
            <td style="text-align:center;"><button class="btn-row-del" onclick="this.closest('tr').remove(); updateAsFees();"><i data-lucide="minus-circle" style="width:14px;height:14px;"></i></button></td>
        `;
        document.getElementById('as-parts-tbody').appendChild(tr);
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', updateAsFees));
        lucide.createIcons();
        updateAsFees();
    }
    window.addUsedPartRow = addUsedPartRow;
    window.updateAsFees = updateAsFees;

    window.deductStockForAs = (asItem) => {
        if(!asItem || !asItem.usedParts || asItem.usedParts.length === 0) return;
        
        let changed = false;
        asItem.usedParts.forEach(p => {
            if(p.stockId && !p.isDeducted) {
                let stockItem = window.stockDataList.find(s => s.id === p.stockId);
                // ID로 못찾으면 이름으로 재시도
                if(!stockItem && p.name) stockItem = window.stockDataList.find(s => s.name.toLowerCase().includes(p.name.toLowerCase()));
                
                if(stockItem) {
                    const oldQty = stockItem.qty; 
                    stockItem.qty -= p.qty;
                    p.isDeducted = true;
                    changed = true;

                    // Global History
                    window.stockHistoryList.unshift({
                        id: 'HIST-' + Date.now().toString().slice(-6), partId: stockItem.id, partName: stockItem.name, type: 'out',
                        qty: p.qty, oldQty, newQty: stockItem.qty, reason: `AS수리사용(${asItem.id} / ${asItem.name})`, date: new Date().toISOString()
                    });
                    // Individual History
                    if(!stockItem.outHistory) stockItem.outHistory = [];
                    stockItem.outHistory.push({
                        date: new Date().toISOString(),
                        reason: `AS수리(${asItem.id})`,
                        qty: p.qty,
                        price: stockItem.price || 0,
                        balance: stockItem.qty
                    });
                }
            }
        });

        if(changed) {
            window.saveStockData();
            window.updateDashboardWidgets();
            if(window.renderStockList) window.renderStockList(); // 재고 리스트 즉시 갱신
        }
    };

    // [New] AS Report Generation Helper
    window.renderAsReport = (asItem) => {
        const tpl = document.getElementById('as-report-template');
        if(!tpl) return;
        
        const settings = JSON.parse(window.DB.get('PC_ShopSettings') || '{}');
        const showPrice = document.getElementById('as-report-show-price').checked;
        
        // Shop Info
        document.getElementById('tpl-as-shop-biz-num').textContent = settings.bizNum || '미입력';
        document.getElementById('tpl-as-shop-name').textContent = settings.shopName || 'PCSHOP';
        document.getElementById('tpl-as-shop-ceo').textContent = settings.ceoName || '관리자';
        document.getElementById('tpl-as-shop-addr').textContent = settings.address || '매장 주소 미설정';
        document.getElementById('tpl-as-shop-tel').textContent = settings.tel || '연락처 미설정';
        
        const shopTypeEl = document.getElementById('tpl-as-shop-biz-type');
        const shopItemEl = document.getElementById('tpl-as-shop-biz-item');
        if(shopTypeEl) shopTypeEl.textContent = settings.bizType || '미입력';
        if(shopItemEl) shopItemEl.textContent = settings.bizItem || '미입력';
        
        // Shop Seal
        const sealContainer = document.getElementById('tpl-as-shop-seal');
        if(sealContainer) {
            if(settings.seal) {
                sealContainer.innerHTML = `<img src="${settings.seal}" style="width:100%; height:100%; object-fit:contain; opacity:0.8;">`;
            } else {
                sealContainer.innerHTML = '';
            }
        }
        
        // Report Info
        document.getElementById('tpl-as-id').textContent = asItem.id;
        document.getElementById('tpl-as-report-date').textContent = new Date().toLocaleDateString();
        document.getElementById('tpl-as-cust-name').textContent = asItem.name || '고객명 미기입';
        document.getElementById('tpl-as-issues').textContent = asItem.issues || '내용 없음';
        document.getElementById('tpl-as-inspect').textContent = asItem.inspectResult || '내용 없음';
        document.getElementById('tpl-as-action').textContent = asItem.actionResult || '내용 없음';
        
        // Parts List
        const partsTbody = document.getElementById('tpl-as-parts-list');
        partsTbody.innerHTML = '';
        if (asItem.usedParts && asItem.usedParts.length > 0) {
            asItem.usedParts.forEach(p => {
                const tr = document.createElement('tr');
                const priceHTML = showPrice ? `
                    <td style="padding:10px; border:1px solid #d2d2d7; text-align:right;">${parseInt(p.price).toLocaleString()}원</td>
                    <td style="padding:10px; border:1px solid #d2d2d7; text-align:right; font-weight:700;">${(parseInt(p.price) * parseInt(p.qty)).toLocaleString()}원</td>
                ` : '<td colspan="2" style="border:1px solid #d2d2d7;"></td>';

                tr.innerHTML = `
                    <td style="padding:10px; border:1px solid #d2d2d7;">${p.name}</td>
                    <td style="padding:10px; border:1px solid #d2d2d7; text-align:center;">${p.qty}</td>
                    ${priceHTML}
                `;
                partsTbody.appendChild(tr);
            });
        }
        
        // Totals
        const priceSection = document.querySelector('.tpl-as-price-section');
        const priceCells = document.querySelectorAll('.tpl-as-price-cell');
        
        if (showPrice) {
            priceSection.style.display = 'flex';
            priceCells.forEach(el => el.style.display = 'table-cell');
            document.getElementById('tpl-as-labor-fee').textContent = parseInt(asItem.laborFee || 0).toLocaleString() + '원';
            document.getElementById('tpl-as-part-fee').textContent = parseInt(asItem.partFee || 0).toLocaleString() + '원';
            document.getElementById('tpl-as-total-fee').textContent = parseInt(asItem.totalFee || 0).toLocaleString() + '원';
        } else {
            priceSection.style.display = 'none';
            priceCells.forEach(el => el.style.display = 'none');
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const btnSaveAs = document.getElementById('btn-save-as');
        const btnOpenAs = document.getElementById('btn-open-as');
        if(btnOpenAs) {
            btnOpenAs.addEventListener('click', () => {
                document.getElementById('modal-as-title').textContent = '신규 AS 서비스 접수';
                document.getElementById('as-cust-name').value = '';
                document.getElementById('as-date').value = new Date().toISOString().split('T')[0];
                document.getElementById('as-memo').value = '';
                document.getElementById('as-inspect-result').value = '';
                document.getElementById('as-action-result').value = '';
                document.getElementById('as-labor-fee').value = 0;
                document.getElementById('as-part-fee').value = 0;
                document.getElementById('as-total-fee').value = 0;
                document.getElementById('as-parts-tbody').innerHTML = '';
                document.querySelectorAll('input[name="as-issue"]').forEach(cb => cb.checked = false);
                document.querySelectorAll('input[name="as-type"]').forEach(r => r.checked = (r.value === '내방'));
                document.querySelectorAll('input[name="as-payment"]').forEach(r => r.checked = (r.value === 'cash'));
                document.getElementById('as-status-select').value = '대기중';
                document.getElementById('as-completion-date-group').style.display = 'none';
                document.getElementById('as-completion-date').value = '';
                
                showAsTab('reception');
                if(btnSaveAs) {
                    btnSaveAs.textContent = 'AS 서비스 접수하기';
                    delete btnSaveAs.dataset.targetId;
                }
                document.getElementById('as-report-actions').style.display = 'none';
                
                // 상태 변경 감지 루틴 연결
                document.getElementById('as-status-select').onchange = (e) => {
                    const status = e.target.value;
                    const compGroup = document.getElementById('as-completion-date-group');
                    const compInput = document.getElementById('as-completion-date');
                    if(status === '완료') {
                        compGroup.style.display = 'block';
                        compInput.value = new Date().toISOString().split('T')[0];
                    } else {
                        compGroup.style.display = 'none';
                    }
                    // 신규 접수 중에는 ID가 없으므로 리포트 생성 불가 (저장 후 편집에서만 가능)
                    document.getElementById('as-report-actions').style.display = 'none';
                };

                document.getElementById('modal-as').style.display = 'flex';
            });
        }

        const btnSearchCustAs = document.getElementById('btn-search-cust-as');
        if(btnSearchCustAs) {
            btnSearchCustAs.addEventListener('click', () => {
                window.openGeneralPicker({
                    title: '고객 검색 및 선택',
                    placeholder: '고객명 또는 연락처를 입력하세요...',
                    data: window.customerDataList,
                    filterFn: (c, q) => (c.name || '').toLowerCase().includes(q) || (c.phone && c.phone.includes(q)),
                    renderFn: (c) => `
                        <div style="font-weight:700; font-size:14px; color:var(--text-color);">${c.name}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${c.phone || '-'}</div>
                    `,
                    onSelect: (cust) => {
                        document.getElementById('as-cust-name').value = cust.name;
                    }
                });
            });
        }

        // AS Repair Parts Handlers
        const btnAddAsPart = document.getElementById('btn-add-as-part');
        if(btnAddAsPart) {
            btnAddAsPart.addEventListener('click', () => addUsedPartRow());
        }

        const btnAsStockSearch = document.getElementById('btn-as-stock-search');
        if(btnAsStockSearch) {
            btnAsStockSearch.addEventListener('click', () => {
                window.openGeneralPicker({
                    title: '수리 부품 재고 검색',
                    placeholder: '부품명 또는 모델번호를 입력하세요...',
                    data: window.stockDataList,
                    filterFn: (s, q) => (s.name || '').toLowerCase().includes(q) || (s.model && s.model.toLowerCase().includes(q)),
                    renderFn: (s) => `
                        <div style="font-weight:700; font-size:14px; color:var(--text-color);">${s.name}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${s.model || '-'} | 재고: ${s.qty}개 | ${parseInt(s.price).toLocaleString()}원</div>
                    `,
                    onSelect: (stock) => {
                        addUsedPartRow(stock.name, 1, stock.price, stock.id);
                    }
                });
            });
        }

        // Fee Input Auto Update
        ['as-labor-fee', 'as-part-fee'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', updateAsFees);
        });

        if(btnSaveAs) {
            btnSaveAs.addEventListener('click', () => {
                const asCustName = document.getElementById('as-cust-name');
                const asDate = document.getElementById('as-date');
                if(!asCustName.value.trim() || !asDate.value) {
                    showAsTab('reception');
                    [asCustName, asDate].forEach(el => {
                        if(!el.value) { el.classList.add('shake', 'input-error'); setTimeout(() => el.classList.remove('shake', 'input-error'), 800); }
                    });
                    return;
                }
                const usedParts = Array.from(document.querySelectorAll('#as-parts-tbody tr')).map(row => ({
                    name: row.querySelector('.row-name').value, 
                    qty: parseInt(row.querySelector('.row-qty').value) || 0,
                    price: parseInt(row.querySelector('.row-price').value) || 0, 
                    stockId: row.dataset.stockId || null,
                    isDeducted: row.dataset.isDeducted === 'true'
                }));
                const asEntry = {
                    name: asCustName.value,
                    status: document.getElementById('as-status-select').value,
                    type: document.querySelector('input[name="as-type"]:checked')?.value || '내방',
                    issues: Array.from(document.querySelectorAll('input[name="as-issue"]:checked')).map(x => x.value).join(', '),
                    memo: document.getElementById('as-memo').value,
                    inspectResult: document.getElementById('as-inspect-result').value,
                    actionResult: document.getElementById('as-action-result').value,
                    laborFee: parseInt(document.getElementById('as-labor-fee').value) || 0,
                    partFee: parseInt(document.getElementById('as-part-fee').value) || 0,
                    totalFee: parseInt(document.getElementById('as-total-fee').value) || 0,
                    usedParts, fullDate: asDate.value, payment: document.querySelector('input[name="as-payment"]:checked')?.value || 'cash'
                };
                const targetStatus = document.getElementById('as-status-select').value;
                if(targetStatus === '완료') {
                    for(const p of usedParts) {
                        if(p.stockId && !p.isDeducted) {
                            const sItem = (window.stockDataList || []).find(s => s.id === p.stockId);
                            if(sItem && sItem.qty < p.qty) {
                                showAsTab('reception');
                                showAlert(`재고가 부족하여 완료 처리할 수 없습니다.\n\n부품: ${p.name}\n실재고: ${sItem.qty}개 / 투입수량: ${p.qty}개\n\n(실재고보다 투입수량이 높습니다(주의))`);
                                return;
                            }
                        }
                    }
                }

                const targetId = btnSaveAs.dataset.targetId;
                const d = new Date(asDate.value);
                const displayDate = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
                
                if(targetId) {
                    const tr = window.asDataList.find(x => x.id === targetId);
                    if(tr) {
                        const oldStatus = tr.status;
                        Object.assign(tr, asEntry);
                        tr.date = displayDate;
                        if(tr.status === '완료') {
                            if(oldStatus !== '완료') window.deductStockForAs(tr);
                            tr.completionDate = document.getElementById('as-completion-date').value || new Date().toISOString().split('T')[0];
                        } else {
                            delete tr.completionDate;
                        }
                    }
                    delete btnSaveAs.dataset.targetId;
                } else {
                    const newAs = { 
                        id: '#AS-' + Date.now().toString().slice(-4), 
                        ...asEntry, 
                        date: displayDate
                    };
                    if(newAs.status === '완료') {
                        window.deductStockForAs(newAs);
                        newAs.completionDate = document.getElementById('as-completion-date').value || new Date().toISOString().split('T')[0];
                    }
                    window.asDataList.unshift(newAs);
                }
                window.saveASToStorage(); window.renderASLists(); window.updateDashboardWidgets();
                document.getElementById('modal-as').style.display = 'none';
            });
        }
        const btnCloseAs = document.getElementById('btn-close-modal-as');
        if(btnCloseAs) {
            btnCloseAs.addEventListener('click', () => {
                document.getElementById('modal-as').style.display = 'none';
            });
        }

        // AS Tab Button Event Binding
        document.querySelectorAll('.as-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => showAsTab(btn.dataset.tab));
        });

        // Cancel / Close Modal
        const btnCancelAs = document.getElementById('btn-cancel-as');
        if(btnCancelAs) btnCancelAs.addEventListener('click', () => document.getElementById('modal-as').style.display = 'none');

        // Report Image Export
        const btnReportImg = document.getElementById('btn-as-report-img');
        if(btnReportImg) {
            btnReportImg.addEventListener('click', () => {
                const targetId = document.getElementById('btn-save-as').dataset.targetId;
                if(!targetId) return;
                const asItem = window.asDataList.find(x => x.id === targetId);
                if(asItem) {
                    window.renderAsReport(asItem);
                    const tpl = document.getElementById('as-report-template');
                    // html2canvas 버그 해결: 화면 밖에서 실제 레이아웃이 잡히도록 함
                    tpl.style.display = 'block';
                    tpl.style.visibility = 'visible';
                    tpl.style.left = '0';
                    tpl.style.top = '0';
                    tpl.style.position = 'fixed';
                    tpl.style.zIndex = '-9999';

                    if(typeof window.showLoading === 'function') {
                        window.showLoading('이미지 렌더링 중입니다...');
                    }

                    html2canvas(tpl, { 
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff'
                    }).then(canvas => {
                        const link = document.createElement('a');
                        const fileDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                        const safeId = (asItem.id || 'Report').replace('#', '');
                        link.download = `AS_Report_${safeId}_${fileDate}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        
                        tpl.style.display = 'none';
                        tpl.style.left = '-9999px';

                        if(typeof window.hideLoading === 'function') window.hideLoading();
                        setTimeout(() => showAlert('이미지가 저장되었습니다.'), 300);
                    }).catch(err => {
                        console.error(err);
                        tpl.style.display = 'none';
                        tpl.style.left = '-9999px';
                        if(typeof window.hideLoading === 'function') window.hideLoading();
                        showAlert('이미지 생성 중 오류가 발생했습니다.');
                    });
                }
            });
        }

        // Report PDF Print
        const btnReportPrint = document.getElementById('btn-as-report-print');
        if(btnReportPrint) {
            btnReportPrint.addEventListener('click', async () => {
                const targetId = document.getElementById('btn-save-as').dataset.targetId;
                if(!targetId) return;
                const asItem = window.asDataList.find(x => x.id === targetId);
                if(asItem) {
                    window.renderAsReport(asItem);
                    const originalTitle = document.title;
                    const fileDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    const safeId = (asItem.id || 'Report').replace('#', '');
                    // [엔진 교체] Electron 네이티브 printToPDF API 사용
                    await window.isolatedPrint('as-report-template', document.title);
                    document.title = originalTitle;
                }
            });
        }

        // Main List Search listener
        const asSearchInput = document.getElementById('search-input-as');
        if(asSearchInput) {
            asSearchInput.addEventListener('input', function() {
                window.renderASLists(this.value);
            });
        }
    });

    window.loadAsData();
})();
