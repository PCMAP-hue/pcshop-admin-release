// [Ledger Management Module]
(function() {
    window.ledgerDataList = [];

    window.loadLedgerData = () => {
        const saved = window.DB.get('PC_LedgerData');
        window.ledgerDataList = saved ? JSON.parse(saved) : [];
    };

    window.saveLedgerData = () => {
        window.DB.set('PC_LedgerData', JSON.stringify(window.ledgerDataList));
    };

    window.renderLedgerList = () => {
        const listContainer = document.getElementById('ledger-list-container');
        const emptyState = document.getElementById('ledger-empty-state');
        const searchInput = document.getElementById('search-input-ledger');
        const typeFilter = document.getElementById('ledger-filter-type');

        if(!listContainer) return;
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const currentTypeFilter = typeFilter ? typeFilter.value : 'all';

        const filtered = window.ledgerDataList.filter(item => {
            const matchesType = currentTypeFilter === 'all' || item.type === currentTypeFilter;
            const matchesSearch = !query || 
                item.itemName.toLowerCase().includes(query) || 
                (item.memo && item.memo.toLowerCase().includes(query)) ||
                (item.targetName && item.targetName.toLowerCase().includes(query)) ||
                item.category.toLowerCase().includes(query);
            return matchesType && matchesSearch;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filtered.length === 0 && window.ledgerDataList.length === 0) {
            listContainer.style.display = 'none';
            if(emptyState) emptyState.style.display = 'block';
        } else {
            if(emptyState) emptyState.style.display = 'none';
            listContainer.style.display = 'block';
            
            const header = renderListHeader([
                { name: '날짜', class: 'col-s' },
                { name: '구분', class: 'col-xs', align: 'center' },
                { name: '분류', class: 'col-s' },
                { name: '품목명 및 대상', class: 'col-flex' },
                { name: '금액', class: 'col-m', align: 'right' },
                { name: '결제수단', class: 'col-s', align: 'center' },
                { name: '관리', class: 'col-action', align: 'center' }
            ], 'ledger-list');

            let html = header;
            filtered.forEach(item => {
                const isRevenue = item.type === '매출';
                const amountColor = isRevenue ? 'var(--accent)' : 'var(--danger-color)';
                const typeLabel = isRevenue ? '매출' : '매입';
                const typeBg = isRevenue ? 'rgba(0, 113, 227, 0.1)' : 'rgba(255, 59, 48, 0.1)';
                
                html += `
                    <div class="list-row" onclick="handleEditLedger('${item.id}')">
                        <div class="col-s c-muted">${item.date}</div>
                        <div class="col-xs t-center">
                            <span style="padding:4px 8px; border-radius:6px; font-size:11px; font-weight:700; background:${typeBg}; color:${amountColor};">${typeLabel}</span>
                        </div>
                        <div class="col-s v-bold" style="font-size:13px;">${item.category}</div>
                        <div class="col-flex">
                            <span class="v-bold">${item.itemName}</span>
                            ${item.targetName ? `<span class="c-muted" style="font-size:12px; margin-left:8px;">[${item.targetName}]</span>` : ''}
                        </div>
                        <div class="col-m t-right v-bold" style="color:${amountColor};">${isRevenue ? '+' : '-'}${parseInt(item.amount).toLocaleString()}원</div>
                        <div class="col-s t-center c-muted" style="font-size:12px;">${item.paymentMethod === 'cash' ? '현금' : (item.paymentMethod === 'card' ? '카드' : '이체')}</div>
                        <div class="col-action t-center">
                            <button class="btn-delete" onclick="handleDeleteLedger('${item.id}', event)" title="삭제">
                                <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
            applyColumnWidths('ledger-list-container', 'ledger-list');
            initResizableList('ledger-list-container', 'ledger-list');
            lucide.createIcons();
        }
    };


    window.handleDeleteLedger = async (id, e) => {
        if(e) e.stopPropagation();
        if(await showConfirm('이 내역을 삭제하시겠습니까? 통계 데이터에서도 즉시 제외됩니다.', '삭제')) {
            window.ledgerDataList = window.ledgerDataList.filter(x => x.id !== id);
            window.saveLedgerData();
            window.renderLedgerList();
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const btnSaveLedger = document.getElementById('btn-save-ledger');
        const btnOpenRevenue = document.getElementById('btn-open-revenue');
        const btnOpenExpense = document.getElementById('btn-open-expense');
        const btnSearchTarget = document.getElementById('btn-search-ledger-target');
        const btnTargetEtc = document.getElementById('btn-ledger-target-etc');
        const modalLedger = document.getElementById('modal-ledger');
        const btnCloseModalLedger = document.getElementById('btn-close-modal-ledger');
        const searchInput = document.getElementById('search-input-ledger');
        const typeFilter = document.getElementById('ledger-filter-type');

        const formatWon = (val) => {
            if (val === 0 || val === '0') return '0원';
            if (!val) return '';
            const num = typeof val === 'string' ? val.replace(/[^0-9]/g, '') : val.toString();
            if (!num) return '';
            return parseInt(num).toLocaleString();
        };

        const parseWon = (str) => {
            if (!str) return 0;
            const num = parseInt(str.toString().replace(/[^0-9]/g, ''));
            return isNaN(num) ? 0 : num;
        };

        const applyWonFormatting = (input) => {
            const rawValue = parseWon(input.value);
            input.value = rawValue > 0 ? formatWon(rawValue) : '';
        };

        // [New] 매입 상세 항목 행 렌더링 함수
        const renderPurchaseRow = (item = { category: '', name: '', amount: 0 }) => {
            const row = document.createElement('div');
            row.className = 'purchase-item-row';
            row.style = 'display:grid; grid-template-columns: 100px 1fr 140px 50px; border-bottom:1px solid var(--border-color); align-items:center;';
            row.innerHTML = `
                <select class="purchase-item-cat" style="border:none; background:transparent; font-size:12px; height:38px; padding-left:8px; width:100%; color:var(--text-color); cursor:pointer;">
                    <option value="부품" style="background:var(--card-bg); color:var(--text-color);" ${item.category === '부품' ? 'selected' : ''}>부품</option>
                    <option value="소모품" style="background:var(--card-bg); color:var(--text-color);" ${item.category === '소모품' ? 'selected' : ''}>소모품</option>
                    <option value="운임" style="background:var(--card-bg); color:var(--text-color);" ${item.category === '운임' ? 'selected' : ''}>운임</option>
                    <option value="기타" style="background:var(--card-bg); color:var(--text-color);" ${item.category === '기타' ? 'selected' : ''}>기타</option>
                </select>
                <input type="text" class="purchase-item-name" value="${item.name}" placeholder="품목명 입력" style="border:none; border-left:1px solid var(--border-color); background:transparent; font-size:12px; height:38px; padding:0 8px; width:100%; color:var(--text-color);">
                <input type="text" class="purchase-item-amount" value="${item.amount ? formatWon(item.amount) : ''}" placeholder="0" style="border:none; border-left:1px solid var(--border-color); background:transparent; font-size:12px; height:38px; padding:0 8px; width:100%; text-align:right; color:var(--text-color); font-weight:700;">
                <button class="btn-remove-row" style="border:none; background:transparent; color:var(--danger-color); cursor:pointer;"><i data-lucide="minus-circle" style="width:14px; height:14px;"></i></button>
            `;

            // 금액 입력 시 자동 합산 및 포맷팅
            const amtInput = row.querySelector('.purchase-item-amount');
            amtInput.addEventListener('input', (e) => {
                applyWonFormatting(e.target);
                calculatePurchaseTotal();
            });
            
            // 삭제 버튼
            row.querySelector('.btn-remove-row').addEventListener('click', () => {
                row.remove();
                calculatePurchaseTotal();
            });

            document.getElementById('purchase-items-list').appendChild(row);
            lucide.createIcons();
        };

        const calculatePurchaseTotal = () => {
            let total = 0;
            document.querySelectorAll('.purchase-item-amount').forEach(input => {
                total += parseWon(input.value);
            });
            document.getElementById('ledger-amount').value = total > 0 ? formatWon(total) : '';
        };

        const resetPurchaseItems = (count = 7) => {
            const container = document.getElementById('purchase-items-list');
            if(!container) return;
            container.innerHTML = '';
            for(let i=0; i<count; i++) renderPurchaseRow();
        };

        // [New] 통합 UI 전환 함수 (매출/매입 구분에 따른 UI 일체)
        const updateLedgerTypeUI = (type, isEdit = false) => {
            const isRevenue = (type === '매출');
            const modalCard = document.getElementById('ledger-modal-card');
            const purchaseContainer = document.getElementById('purchase-details-container');
            const btnSave = document.getElementById('btn-save-ledger');

            // 1. 모달 너비 & 상세 컨테이너 노출 조정
            if (purchaseContainer) purchaseContainer.style.display = isRevenue ? 'none' : 'block';
            if (modalCard) modalCard.style.width = isRevenue ? '500px' : '750px';

            // 2. 카테고리 구성 교체
            const catSelect = document.getElementById('ledger-category');
            if (isRevenue) {
                catSelect.innerHTML = `
                    <option value="AS">AS</option>
                    <option value="업그레이드">업그레이드</option>
                    <option value="조립대행">조립대행</option>
                    <option value="PC 판매">PC 판매</option>
                    <option value="부품 판매">부품 판매</option>
                    <option value="기타">기타</option>
                `;
            } else {
                catSelect.innerHTML = `
                    <option value="부품 매입">부품 매입</option>
                    <option value="소모품/비품">소모품/비품</option>
                    <option value="임대료/관리비">임대료/관리비</option>
                    <option value="식대">식대</option>
                    <option value="기타">기타</option>
                `;
            }

            // 3. 버튼 텍스트 설정
            if (btnSave) {
                if (isEdit) {
                    btnSave.textContent = '내역 수정 완료';
                } else {
                    btnSave.textContent = isRevenue ? '매출 저장하기' : '매입 저장하기';
                }
            }
        };

        // Helper to reset modal (신규 등록용)
        const resetLedgerModal = (type = '매출') => {
            const isRevenue = (type === '매출');
            
            document.getElementById('modal-ledger-title').textContent = isRevenue ? '신규 매출 내역 등록' : '신규 매입 내역 등록';
            document.getElementById('ledger-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('ledger-amount').value = '';
            document.getElementById('ledger-target-name').value = '';
            document.getElementById('ledger-memo').value = '';
            
            document.querySelectorAll('input[name="ledger-type"]').forEach(r => r.checked = (r.value === type));
            document.querySelectorAll('input[name="ledger-payment"]').forEach(r => r.checked = (r.value === 'card'));

            // 통합 UI 업데이트 호출
            updateLedgerTypeUI(type, false);

            if (!isRevenue) resetPurchaseItems(7);

            if (btnSaveLedger) delete btnSaveLedger.dataset.targetId;
            modalLedger.style.display = 'flex';
        };

        // [New] 장부 수정 핸들러 (클로저 내부로 이동)
        window.handleEditLedger = (id) => {
            const item = window.ledgerDataList.find(x => x.id === id);
            if(!item) return;

            document.getElementById('modal-ledger-title').textContent = '장부 내역 수정';
            
            // 1. 기본 필드 채우기
            document.querySelectorAll('input[name="ledger-type"]').forEach(r => r.checked = (r.value === item.type));
            document.getElementById('ledger-date').value = item.date;
            
            // 2. UI 전환 (카테고리 목록이 먼저 생성되어야 하므로 UI 업데이트 먼저 수행)
            updateLedgerTypeUI(item.type, true);
            
            document.getElementById('ledger-category').value = item.category;
            document.getElementById('ledger-amount').value = formatWon(item.amount); // 금액 포맷팅 적용
            document.querySelector(`input[name="ledger-payment"][value="${item.paymentMethod}"]`).checked = true;
            document.getElementById('ledger-target-name').value = item.targetName || '';
            document.getElementById('ledger-memo').value = item.memo || '';

            // 3. 매입 상세 항목 처리
            if (item.type === '매입') {
                const container = document.getElementById('purchase-items-list');
                if (container) {
                    container.innerHTML = '';
                    if (item.purchaseItems && item.purchaseItems.length > 0) {
                        item.purchaseItems.forEach(pItem => renderPurchaseRow(pItem));
                    } else {
                        // 기존에 상세 항목이 없던 데이터는 기본 7줄 생성
                        for(let i=0; i<7; i++) renderPurchaseRow();
                    }
                }
            }

            if(btnSaveLedger) btnSaveLedger.dataset.targetId = id;
            modalLedger.style.display = 'flex';
        };

        if(btnOpenRevenue) btnOpenRevenue.addEventListener('click', () => resetLedgerModal('매출'));
        if(btnOpenExpense) btnOpenExpense.addEventListener('click', () => resetLedgerModal('매입'));

        // 메인 금액 필드 포맷팅 리스너
        const mainAmountInput = document.getElementById('ledger-amount');
        if(mainAmountInput) {
            mainAmountInput.addEventListener('input', (e) => applyWonFormatting(e.target));
        }

        // 라디오 버튼 변경 시 실시간 전환
        document.querySelectorAll('input[name="ledger-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const type = e.target.value;
                const isEdit = !!(btnSaveLedger && btnSaveLedger.dataset.targetId);
                updateLedgerTypeUI(type, isEdit);
                
                if (type === '매입' && document.getElementById('purchase-items-list').children.length === 0) {
                    resetPurchaseItems(7);
                }
            });
        });

        // 항목 추가 버튼
        const btnAddRow = document.getElementById('btn-add-purchase-row');
        if(btnAddRow) btnAddRow.addEventListener('click', () => renderPurchaseRow());

        // 정보 연동 (불러오기)
        if (btnSearchTarget) {
            btnSearchTarget.addEventListener('click', () => {
                const type = document.querySelector('input[name="ledger-type"]:checked').value;
                if (type === '매출') {
                    // 고객 선택
                    window.openGeneralPicker({
                        title: '매출 대상 고객 선택',
                        placeholder: '고객명 또는 연락처 검색...',
                        data: window.customerDataList || [],
                        filterFn: (item, query) => (item.name && item.name.toLowerCase().includes(query)) || (item.phone && item.phone.includes(query)),
                        renderFn: (item) => `
                            <div style="font-weight:700;">${item.name}</div>
                            <div style="font-size:12px; color:var(--text-muted);">${item.phone}</div>
                        `,
                        onSelect: (item) => {
                            document.getElementById('ledger-target-name').value = item.name;
                        }
                    });
                } else {
                    // 매입처 선택
                    window.openGeneralPicker({
                        title: '매입 거래처 선택',
                        placeholder: '상호명 또는 담당자 검색...',
                        data: window.vendorDataList || [],
                        filterFn: (item, query) => (item.name && item.name.toLowerCase().includes(query)) || (item.owner && item.owner.toLowerCase().includes(query)),
                        renderFn: (item) => `
                            <div style="font-weight:700;">${item.name}</div>
                            <div style="font-size:12px; color:var(--text-muted);">${item.owner || ''} | ${item.phone}</div>
                        `,
                        onSelect: (item) => {
                            document.getElementById('ledger-target-name').value = item.name;
                        }
                    });
                }
            });
        }

        // 기타(비회원) 버튼
        if (btnTargetEtc) {
            btnTargetEtc.addEventListener('click', () => {
                const targetInput = document.getElementById('ledger-target-name');
                targetInput.value = '기타(비회원)';
            });
        }

        if(btnSaveLedger) {
            btnSaveLedger.addEventListener('click', async () => {
                const type = document.querySelector('input[name="ledger-type"]:checked').value;
                const date = document.getElementById('ledger-date').value;
                const category = document.getElementById('ledger-category').value;
                const amount = parseWon(document.getElementById('ledger-amount').value);
                const paymentMethod = document.querySelector('input[name="ledger-payment"]:checked').value;
                const targetName = document.getElementById('ledger-target-name').value.trim();
                const memo = document.getElementById('ledger-memo').value.trim();

                if(!date || amount < 0) {
                    showAlert('날짜와 금액을 정확히 입력해주세요.');
                    return;
                }

                // [New] 매입 상세 항목 데이터 수집
                const purchaseItems = [];
                if (type === '매입') {
                    document.querySelectorAll('.purchase-item-row').forEach(row => {
                        const rowCat = row.querySelector('.purchase-item-cat').value;
                        const rowName = row.querySelector('.purchase-item-name').value.trim();
                        const rowAmount = parseWon(row.querySelector('.purchase-item-amount').value);
                        if (rowName || rowAmount > 0) {
                            purchaseItems.push({ category: rowCat, name: rowName, amount: rowAmount });
                        }
                    });
                }

                // 자동 품목명 생성 (매입 시)
                let finalItemName = memo ? (memo.length > 20 ? memo.substring(0, 20) + '...' : memo) : category;
                if (type === '매입' && purchaseItems.length > 0) {
                    const firstItem = purchaseItems[0].name || purchaseItems[0].category;
                    finalItemName = purchaseItems.length > 1 ? `${firstItem} 외 ${purchaseItems.length - 1}건` : firstItem;
                }

                const ledgerItem = {
                    id: btnSaveLedger.dataset.targetId || 'LEDGER-' + Date.now(),
                    type, date, category, 
                    amount: parseInt(amount),
                    paymentMethod, targetName, memo,
                    purchaseItems: type === '매입' ? purchaseItems : null,
                    itemName: finalItemName
                };

                if(btnSaveLedger.dataset.targetId) {
                    const idx = window.ledgerDataList.findIndex(x => x.id === ledgerItem.id);
                    if(idx > -1) window.ledgerDataList[idx] = ledgerItem;
                    delete btnSaveLedger.dataset.targetId;
                } else {
                    window.ledgerDataList.unshift(ledgerItem);
                }

                window.saveLedgerData();
                modalLedger.style.display = 'none';
                window.renderLedgerList();
                if(window.updateDashboardWidgets) window.updateDashboardWidgets();
            });
        }

        if(btnCloseModalLedger) btnCloseModalLedger.addEventListener('click', () => modalLedger.style.display = 'none');
        if(searchInput) searchInput.addEventListener('input', window.renderLedgerList);
        if(typeFilter) typeFilter.addEventListener('change', window.renderLedgerList);
    });

    window.loadLedgerData();
})();
