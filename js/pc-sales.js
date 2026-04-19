// [PC Sales Management Module]
(function() {
    window.pcSalesDataList = [];

    window.loadPcSalesData = () => {
        const saved = window.DB.get('PC_SalesData');
        window.pcSalesDataList = saved ? JSON.parse(saved) : [];
    };

    window.savePcSalesData = () => {
        window.DB.set('PC_SalesData', JSON.stringify(window.pcSalesDataList));
    };

    function updatePcSaleExpireDate() {
        const saleDateVal = document.getElementById('pc-sale-date').value;
        const warrantyVal = document.getElementById('pc-sale-warranty').value;
        const expireInput = document.getElementById('pc-sale-expire-date');
        if(!saleDateVal || !expireInput) return;

        const date = new Date(saleDateVal);
        if(isNaN(date.getTime())) return;

        if(warrantyVal.includes('년')) {
            const years = parseInt(warrantyVal);
            date.setFullYear(date.getFullYear() + years);
        } else if(warrantyVal.includes('개월')) {
            const months = parseInt(warrantyVal);
            date.setMonth(date.getMonth() + months);
        } else if(warrantyVal === '0' || warrantyVal === '자체무상없음' || warrantyVal === '보증 없음') {
            // 보증 없음 선택 시 판매일과 동일하게 유지
        }

        expireInput.value = date.toISOString().split('T')[0];
    }

    window.renderPcSalesList = (query = '') => {
        const container = document.getElementById('pc-sales-list-container');
        const emptyState = document.getElementById('pc-sales-empty-state');
        if(!container) return;
        
        const filtered = query 
            ? window.pcSalesDataList.filter(s => s.id.includes(query) || s.custName.includes(query) || (s.quoteInfo && s.quoteInfo.includes(query)))
            : window.pcSalesDataList;
        
        if(filtered.length === 0) {
            container.innerHTML = '';
            if(emptyState) emptyState.style.display = 'block';
            return;
        }
        if(emptyState) emptyState.style.display = 'none';
        
        const header = renderListHeader([
            { name: '판매번호', class: 'col-s' }, 
            { name: '판매일자', class: 'col-s' },
            { name: '완료날짜', class: 'col-s' },
            { name: '고객명', class: 'col-m' },
            { name: '견적 및 구성 정보', class: 'col-flex' },
            { name: '진행상태', class: 'col-s', align: 'center' }, 
            { name: '결제방식', class: 'col-s', align: 'center' },
            { name: '증빙요청', class: 'col-s', align: 'center' },
            { name: '총 금액', class: 'col-m', align: 'right' }, { name: '관리', class: 'col-action', align: 'center' }
        ], 'pc-sales-list');

        let html = header;
        filtered.forEach(s => {
            const statusColor = s.status === '판매완료' ? 'var(--success-color)' : 'var(--accent)';
            const saleDateDisp = s.saleDate ? s.saleDate.split('-').map(part => part.slice(-2)).join('.') : '-';
            const compDateDisp = s.completionDate ? s.completionDate.split('-').map(part => part.slice(-2)).join('.') : '-';
            html += `
                <div class="list-row" onclick="handleEditPcSale('${s.id}')">
                    <div class="col-s v-bold c-accent">${s.id}</div>
                    <div class="col-s c-muted" style="font-size:13px;">${saleDateDisp}</div>
                    <div class="col-s c-muted" style="font-size:13px;">${compDateDisp}</div>
                    <div class="col-m v-bold">${s.custName}</div>
                    <div class="col-flex c-muted" title="${s.quoteInfo || '-'}">${s.quoteInfo || '-'}</div>
                    <div class="col-s t-center"><span class="status-badge" style="background:${statusColor}15; color:${statusColor}; border:1px solid ${statusColor}30; padding:4px 10px;">${s.status}</span></div>
                    <div class="col-s t-center" style="font-size:13px; color:var(--text-color);">${s.paymentMethod || '-'}</div>
                    <div class="col-s t-center" style="font-size:13px; color:var(--text-color);">${s.taxRequest || '-'}</div>
                    <div class="col-m t-right v-bold">${parseInt(s.totalAmount || 0).toLocaleString()}원</div>
                    <div class="col-action t-center"><button class="btn-delete" onclick="handleDeletePcSale('${s.id}', event)" title="삭제"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button></div>
                </div>
            `;
        });
        container.innerHTML = html;
        applyColumnWidths('pc-sales-list-container', 'pc-sales-list');
        initResizableList('pc-sales-list-container', 'pc-sales-list');
        lucide.createIcons();
    };

    window.renderPcSalesDashboardList = () => {
        const dashboardList = document.getElementById('dashboard-pc-sales-list');
        if(!dashboardList) return;

        const headerHTML = renderListHeader([
            { name: '판매번호', class: 'col-s' },
            { name: '판매일자', class: 'col-s' },
            { name: '완료날짜', class: 'col-s' },
            { name: '고객명', class: 'col-m' },
            { name: '구성 요약', class: 'col-flex' },
            { name: '상태', class: 'col-s', align: 'center' },
            { name: '관리', class: 'col-action', align: 'center' }
        ], 'pc-sales-dash-list');

        const now = new Date();
        const ty = now.getFullYear(); const tm = now.getMonth() + 1; const td = now.getDate();
        
        const todayItems = window.pcSalesDataList.filter(item => {
             if(!item.saleDate) return false;
             const [y, m, d] = item.saleDate.split('-').map(Number);
             return ty === y && tm === m && td === d;
        }).slice(0, 5);

        if(todayItems.length === 0) {
            dashboardList.innerHTML = `
                <div style="padding:40px; text-align:center; color:var(--text-muted);">
                    <i data-lucide="info" style="width:32px;height:32px;opacity:0.3;margin-bottom:12px;"></i>
                    <div style="font-size:14px; font-weight:500;">오늘 등록된 PC 판매 내역이 없습니다.</div>
                </div>
            `;
        } else {
            let dashHTML = headerHTML;
            todayItems.forEach(item => {
                const statusColor = item.status === '판매완료' ? 'var(--success-color)' : 'var(--accent)';
                const saleDateDisp = item.saleDate ? item.saleDate.split('-').map(part => part.slice(-2)).join('.') : '-';
                const compDateDisp = item.completionDate ? item.completionDate.split('-').map(part => part.slice(-2)).join('.') : '-';
                dashHTML += `
                    <div class="list-row" onclick="handleEditPcSale('${item.id}')" style="padding:12px 24px;">
                        <div class="col-s v-bold c-accent">${item.id}</div>
                        <div class="col-s c-muted" style="font-size:12px;">${saleDateDisp}</div>
                        <div class="col-s c-muted" style="font-size:12px;">${compDateDisp}</div>
                        <div class="col-m v-bold">${item.custName}</div>
                        <div class="col-flex c-muted" style="font-size:13px;" title="${item.quoteInfo || '-'}">${item.quoteInfo || '-'}</div>
                        <div class="col-s t-center"><span class="status-badge" style="background:${statusColor}15; color:${statusColor}; border:1px solid ${statusColor}30; padding:4px 10px; font-size:11px;">${item.status}</span></div>
                        <div class="col-action t-center"><button class="btn-delete" onclick="handleDeletePcSale('${item.id}', event)" title="삭제"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button></div>
                    </div>
                `;
            });
            dashboardList.innerHTML = dashHTML;
            applyColumnWidths('dashboard-pc-sales-list', 'pc-sales-dash-list');
            initResizableList('dashboard-pc-sales-list', 'pc-sales-dash-list');
        }
        lucide.createIcons();
    };

    window.handleEditPcSale = (id) => {
        const item = window.pcSalesDataList.find(x => x.id === id);
        if(!item) return;
        document.getElementById('modal-pc-sale-title').textContent = id + ' - 판매 상세 수정';
        
        // [수정] 누락된 고객 정보 및 견적서 연동 정보 필드 추가
        document.getElementById('pc-sale-cust-name').value = item.custName || '';
        document.getElementById('pc-sale-quote-info').value = item.quoteInfo || '';
        document.getElementById('pc-sale-os').value = item.os || 'Windows 11 Home';
        
        document.getElementById('pc-sale-date').value = item.saleDate || '';
        document.getElementById('pc-sale-warranty').value = item.warranty || '1년';
        document.getElementById('pc-sale-route').value = item.route || '내방';
        document.getElementById('pc-sale-payment').value = item.paymentMethod || '현금';
        document.getElementById('pc-sale-tax').value = item.taxRequest || '미요청';
        document.getElementById('pc-sale-os').value = item.os || 'Windows 11 Home';
        document.getElementById('pc-sale-memo').value = item.memo || '';
        document.getElementById('pc-sale-total').value = (parseInt(item.totalAmount) || 0).toLocaleString() + '원';
        
        // 완료 날짜 처리
        const statusSelect = document.getElementById('pc-sale-status');
        const compGroup = document.getElementById('pc-sale-completion-date-group');
        const compInput = document.getElementById('pc-sale-completion-date');
        
        statusSelect.value = item.status || '조립대기';
        if(item.status === '판매완료') {
            compGroup.style.display = 'block';
            compInput.value = item.completionDate || new Date().toISOString().split('T')[0];
        } else {
            compGroup.style.display = 'none';
            compInput.value = '';
        }

        // 상태 변경 시 완료 날짜 필드 동적 노출 제어
        statusSelect.onchange = (e) => {
            const status = e.target.value;
            if(status === '판매완료') {
                compGroup.style.display = 'block';
                if(!compInput.value) compInput.value = new Date().toISOString().split('T')[0];
            } else {
                compGroup.style.display = 'none';
            }
        };
        
        // 보증 기간 만료일 계산 및 UI 업데이트
        updatePcSaleExpireDate();
        
        // 저장된 만료일이 있다면 다시 세팅 (수동 변경 대응)
        if(item.expireDate) {
            const expireInput = document.getElementById('pc-sale-expire-date');
            if(expireInput) expireInput.value = item.expireDate;
        }

        const btnSave = document.getElementById('btn-save-pc-sale');
        btnSave.dataset.targetId = id;
        document.getElementById('modal-pc-sale').style.display = 'flex';
    };

    window.handleDeletePcSale = async (id, e) => {
        if(e) e.stopPropagation();
        if(await showConfirm('해당 PC 판매 기록을 삭제하시겠습니까?', '삭제')) {
            window.pcSalesDataList = window.pcSalesDataList.filter(x => x.id !== id);
            window.savePcSalesData();
            window.renderPcSalesList();
            window.updateDashboardWidgets();
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const btnSavePcSale = document.getElementById('btn-save-pc-sale');
        const btnAddPcSale = document.getElementById('btn-add-pc-sale');
        if(btnAddPcSale) {
            btnAddPcSale.addEventListener('click', () => {
                document.getElementById('modal-pc-sale-title').textContent = '신규 PC 판매 내역 등록';
                document.getElementById('pc-sale-cust-name').value = '';
                document.getElementById('pc-sale-quote-info').value = '';
                document.getElementById('pc-sale-date').value = new Date().toISOString().split('T')[0];
                document.getElementById('pc-sale-warranty').value = '1년';
                document.getElementById('pc-sale-route').value = '내방';
                document.getElementById('pc-sale-payment').value = '현금';
                document.getElementById('pc-sale-tax').value = '미요청';
                document.getElementById('pc-sale-status').value = '조립대기';
                document.getElementById('pc-sale-os').value = 'Windows 11 Home';
                document.getElementById('pc-sale-memo').value = '';
                document.getElementById('pc-sale-total').value = '0원';
                
                // 완료 날짜 초기화 및 이벤트 연결
                const statusSelect = document.getElementById('pc-sale-status');
                const compGroup = document.getElementById('pc-sale-completion-date-group');
                const compInput = document.getElementById('pc-sale-completion-date');
                
                compGroup.style.display = 'none';
                compInput.value = '';
                
                statusSelect.onchange = (e) => {
                    const status = e.target.value;
                    if(status === '판매완료') {
                        compGroup.style.display = 'block';
                        compInput.value = new Date().toISOString().split('T')[0];
                    } else {
                        compGroup.style.display = 'none';
                    }
                };
                
                updatePcSaleExpireDate();

                if(btnSavePcSale) {
                    btnSavePcSale.textContent = '판매 기록 저장';
                    delete btnSavePcSale.dataset.targetId;
                }
                document.getElementById('modal-pc-sale').style.display = 'flex';
            });
        }

        if(btnSavePcSale) {
            btnSavePcSale.addEventListener('click', () => {
                const custName = document.getElementById('pc-sale-cust-name').value;
                if(!custName) { showAlert('고객 정보를 선택해주세요.'); return; }
                const targetId = btnSavePcSale.dataset.targetId;
                const saleData = {
                    custName, saleDate: document.getElementById('pc-sale-date').value,
                    expireDate: document.getElementById('pc-sale-expire-date').value,
                    quoteInfo: document.getElementById('pc-sale-quote-info').value,
                    warranty: document.getElementById('pc-sale-warranty').value,
                    route: document.getElementById('pc-sale-route').value,
                    paymentMethod: document.getElementById('pc-sale-payment').value,
                    taxRequest: document.getElementById('pc-sale-tax').value,
                    status: document.getElementById('pc-sale-status').value,
                    os: document.getElementById('pc-sale-os').value,
                    memo: document.getElementById('pc-sale-memo').value,
                    totalAmount: parseInt(document.getElementById('pc-sale-total').value.replace(/[^\d]/g, '')) || 0
                };
                if(targetId) {
                    const idx = window.pcSalesDataList.findIndex(x => x.id === targetId);
                    if(idx !== -1) {
                        const oldItem = window.pcSalesDataList[idx];
                        window.pcSalesDataList[idx] = { ...oldItem, ...saleData };
                        const item = window.pcSalesDataList[idx];
                        
                        if(item.status === '판매완료') {
                            item.completionDate = document.getElementById('pc-sale-completion-date').value || new Date().toISOString().split('T')[0];
                        } else {
                            delete item.completionDate;
                        }
                    }
                    delete btnSavePcSale.dataset.targetId;
                } else {
                    if(saleData.status === '판매완료') {
                        saleData.completionDate = document.getElementById('pc-sale-completion-date').value || new Date().toISOString().split('T')[0];
                    }
                    window.pcSalesDataList.unshift({ id: '#PCS-' + Date.now().toString().slice(-4), ...saleData });
                }
                window.savePcSalesData(); window.renderPcSalesList(); window.updateDashboardWidgets();
                document.getElementById('modal-pc-sale').style.display = 'none';
                showAlert('PC 판매 기록이 저장되었습니다.');
            });
        }
        
        const btnCloseModalPcSale = document.getElementById('btn-close-modal-pc-sale');
        if(btnCloseModalPcSale) btnCloseModalPcSale.addEventListener('click', () => {
            document.getElementById('modal-pc-sale').style.display = 'none';
        });

        const pcSaleDateInput = document.getElementById('pc-sale-date');
        const pcSaleWarrantySelect = document.getElementById('pc-sale-warranty');
        if(pcSaleDateInput) pcSaleDateInput.addEventListener('change', updatePcSaleExpireDate);
        if(pcSaleWarrantySelect) pcSaleWarrantySelect.addEventListener('change', updatePcSaleExpireDate);

        const btnSearchCustPC = document.getElementById('btn-search-cust-pc');
        if(btnSearchCustPC) {
            btnSearchCustPC.addEventListener('click', () => {
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
                        document.getElementById('pc-sale-cust-name').value = cust.name;
                    }
                });
            });
        }

        const btnSearchQuotePC = document.getElementById('btn-search-quote-pc');
        if(btnSearchQuotePC) {
            btnSearchQuotePC.addEventListener('click', () => {
                window.openGeneralPicker({
                    title: '견적서 검색 및 선택',
                    placeholder: '고객명 또는 견적 요약 내용을 입력하세요...',
                    data: window.quoteDataList,
                    filterFn: (q, query) => q.custName.toLowerCase().includes(query) || (q.summary && q.summary.toLowerCase().includes(query)),
                    renderFn: (q) => `
                        <div style="font-weight:700; font-size:14px; color:var(--text-color);">${q.summary} [${q.custName}]</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${q.date} | 총액: ${parseInt(q.total || 0).toLocaleString()}원</div>
                    `,
                    onSelect: (quote) => {
                        document.getElementById('pc-sale-quote-info').value = `${quote.summary} (${quote.id})`;
                        document.getElementById('pc-sale-total').value = (parseInt(quote.total) || 0).toLocaleString() + '원';
                    }
                });
            });
        }

        const btnPreviewQuote = document.getElementById('btn-preview-quote-pc');
        if(btnPreviewQuote) {
            btnPreviewQuote.addEventListener('click', () => {
                const quoteInfo = document.getElementById('pc-sale-quote-info').value;
                if(!quoteInfo || quoteInfo === '') {
                    showAlert('먼저 견적서를 불러와주세요.');
                    return;
                }
                
                // Extract ID using robust regex (Format: "Summary (#Q-XXXX)", "Summary (Q-XXXX)", etc)
                const match = quoteInfo.match(/\((#?Q-?\d+)\)/);
                let quoteId = match ? match[1] : null;
                
                if(quoteId) {
                    // Normalize to standard #Q-XXXX format for searching
                    // 1. Remove # if exists, 2. Remove - if exists, 3. Re-assemble as #Q-XXXX
                    const digits = quoteId.replace(/[#Q-]/g, '');
                    quoteId = '#Q-' + digits;
                }
                
                if(!quoteId || !match) {
                    showAlert('연동된 견적서 ID를 찾을 수 없습니다.');
                    return;
                }
                
                const quote = window.quoteDataList.find(q => q.id === quoteId);
                if(!quote) {
                    showAlert('해당 견적서 데이터를 찾을 수 없습니다.');
                    return;
                }
                
                // Render Preview Table
                const previewContent = document.getElementById('pc-quote-preview-content');
                let tableHtml = `
                    <table class="quote-table">
                        <thead>
                            <tr>
                                <th style="width:100px;">분류</th>
                                <th>품명 및 사양</th>
                                <th style="width:120px; text-align:right;">단가</th>
                                <th style="width:60px; text-align:center;">수량</th>
                                <th style="width:120px; text-align:right;">금액</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                quote.items.forEach(item => {
                    const price = parseInt(item.price || 0);
                    const qty = parseInt(item.qty || 1);
                    tableHtml += `
                        <tr>
                            <td>${item.cat || '-'}</td>
                            <td>${item.name || '-'}</td>
                            <td style="text-align:right;">${price.toLocaleString()}원</td>
                            <td style="text-align:center;">${qty}</td>
                            <td style="text-align:right; font-weight:700;">${(price * qty).toLocaleString()}원</td>
                        </tr>
                    `;
                });
                
                tableHtml += `
                        </tbody>
                    </table>
                    <div style="background:var(--accent-light); padding:16px; border-top:1px solid var(--border-color); text-align:right;">
                        <span style="font-size:14px; font-weight:600; color:var(--text-muted); margin-right:12px;">최종 합계 금액:</span>
                        <span style="font-size:18px; font-weight:800; color:var(--accent);">${quote.total.toLocaleString()}원</span>
                    </div>
                `;
                
                previewContent.innerHTML = tableHtml;
                document.getElementById('modal-pc-quote-preview').style.display = 'flex';
                lucide.createIcons();
            });
        }
        
        const btnClosePreview = document.getElementById('btn-close-pc-quote-preview');
        if(btnClosePreview) {
            btnClosePreview.addEventListener('click', () => {
                document.getElementById('modal-pc-quote-preview').style.display = 'none';
            });
        }

        // Sale Total Amount Auto Formatting
        const pcSaleTotalInput = document.getElementById('pc-sale-total');
        if(pcSaleTotalInput) {
            pcSaleTotalInput.addEventListener('input', function() {
                let val = this.value.replace(/[^\d]/g, '');
                if (val === '') val = 0;
                this.value = parseInt(val).toLocaleString() + '원';
            });
            pcSaleTotalInput.addEventListener('focus', function() {
                if (this.value === '0원') this.value = '';
            });
            pcSaleTotalInput.addEventListener('blur', function() {
                if (this.value === '') this.value = '0원';
            });
        }

        // Main List Search listener
        const pcSalesSearchInput = document.getElementById('search-input-pc-sales');
        if(pcSalesSearchInput) {
            pcSalesSearchInput.addEventListener('input', function() {
                window.renderPcSalesList(this.value);
            });
        }
    });

    window.loadPcSalesData();
})();
