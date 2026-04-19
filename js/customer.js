// [Customer Management Module]
(function() {
    window.customerDataList = [];
    let currentCustomerFilterRoute = 'all';
    let currentCustomerFilterType = 'all';

    window.loadCustomerData = () => {
        const saved = window.DB.get('PC_CustomerData');
        window.customerDataList = saved ? JSON.parse(saved) : [];
    };

    window.saveCustomerData = () => {
        window.DB.set('PC_CustomerData', JSON.stringify(window.customerDataList));
    };

    window.handleDeleteCustomer = async (id, e) => {
        if (e) e.stopPropagation();
        if(await showConfirm('해당 고객의 정보를 영구히 삭제하시겠습니까? (복구 불가)', '삭제')) {
            window.customerDataList = window.customerDataList.filter(x => x.id !== id);
            window.saveCustomerData();
            window.renderCustomerList(document.getElementById('search-input-customer').value);
        }
    };

    window.handleEditCustomer = (id) => {
        const item = window.customerDataList.find(x => x.id === id);
        if(item) {
            const titleEl = document.querySelector('#modal-customer .modal-header h3');
            if(titleEl) titleEl.textContent = '고객 상세 및 수정';
            
            document.getElementById('cust-name').value = item.name;
            document.getElementById('cust-phone').value = item.phone;
            const custAddress = document.getElementById('cust-address');
            if(custAddress) custAddress.value = item.address || '';
            const custMemo = document.getElementById('cust-memo');
            if(custMemo) custMemo.value = item.memo || '';
            
            const typesArr = item.types.split(',').map(s => s.trim());
            document.querySelectorAll('input[name="customer-type"]').forEach(cb => {
                cb.checked = typesArr.includes(cb.value);
            });
            
            const hasZorip = document.querySelector('input[name="customer-type"][value="조립PC"]').checked;
            // warranty-asterisk 및 cust-warranty 관련 로직 제거됨
            
            const routeRadio = document.querySelector(`input[name="customer-route"][value="${item.route || '내방'}"]`);
            if(routeRadio) routeRadio.checked = true;
            
            const btnSaveCustomer = document.getElementById('btn-save-customer');
            btnSaveCustomer.textContent = '고객 정보 수정';
            btnSaveCustomer.dataset.targetId = id;
            
            document.getElementById('modal-customer').style.display = 'flex';
        }
    };

    window.renderCustomerList = (query = '') => {
        const container = document.getElementById('customer-list-container');
        const emptyState = document.getElementById('customer-empty-state');
        if(!container) return;
        
        const filtered = window.customerDataList.filter(item => {
            const matchesSearch = query ? (item.name.includes(query) || item.phone.includes(query)) : true;
            const matchesRoute = currentCustomerFilterRoute === 'all' ? true : item.route === currentCustomerFilterRoute;
            const matchesType = currentCustomerFilterType === 'all' ? true : (item.types && item.types.includes(currentCustomerFilterType));
            return matchesSearch && matchesRoute && matchesType;
        });
            
        if (filtered.length === 0 && window.customerDataList.length === 0) {
            container.style.display = 'none';
            if(emptyState) emptyState.style.display = 'block';
        } else if(filtered.length === 0) {
            if(emptyState) emptyState.style.display = 'none';
            container.style.display = 'block';
            container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">검색 결과가 없습니다.</div>`;
        } else {
            if(emptyState) emptyState.style.display = 'none';
            container.style.display = 'block';
            
            const header = renderListHeader([
                { name: '고객번호', class: 'col-s' },
                { name: '등록 날짜', class: 'col-s' },
                { name: '고객명', style: 'flex: 1;' },
                { name: '연락처', style: 'flex: 1;' },
                { name: '유입 경로', class: 'col-s', align: 'center' },
                { name: '고객 분류', class: 'col-s' },
                { name: '메모 및 특이사항', style: 'flex: 2;' },
                { name: '관리', class: 'col-action', align: 'center' }
            ], 'customer-list');

            let html = header;
            filtered.forEach(item => {
                const route = item.route || '내방';
                let routeStyle = 'background:rgba(0,0,0,0.05); color:var(--text-muted);'; // 기본 (내방/기타)
                
                if (route === '네이버') routeStyle = 'background:#e7f7ed; color:#2db400; border-color:#2db40020;';
                else if (route === '카카오톡') routeStyle = 'background:#fff9db; color:#856404; border-color:#85640420;';
                else if (route === '소개') routeStyle = 'background:#f3f0ff; color:#7950f2; border-color:#7950f220;';
                else if (route === '내방') routeStyle = 'background:#e7f5ff; color:#1c7ed6; border-color:#1c7ed620;';

                html += `
                    <div class="list-row" onclick="handleEditCustomer('${item.id}')">
                        <div class="col-s v-bold c-accent">${item.id}</div>
                        <div class="col-s c-muted" style="font-size:12px;">${item.regDate || '-'}</div>
                        <div style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" class="v-bold">${item.name}</div>
                        <div style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.phone}</div>
                        <div class="col-s t-center"><span class="status-badge" style="${routeStyle} border:1px solid transparent; font-size:12px; padding:4px 10px;">${route}</span></div>
                        <div class="col-s"><span class="status-badge" style="background:rgba(0,113,227,0.05); color:var(--accent); border:none; font-size:12px; padding:4px 10px;">${item.types}</span></div>
                        <div style="flex: 2; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" class="c-muted" title="${item.memo || '-'}">${item.memo || '-'}</div>
                        <div class="col-action t-center">
                            <button class="btn-delete" onclick="handleDeleteCustomer('${item.id}', event)" title="삭제">
                                <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                            </button>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
            
            // [Resizable Table] Apply saved widths and init resizers
            applyColumnWidths('customer-list-container', 'customer-list');
            initResizableList('customer-list-container', 'customer-list');

            lucide.createIcons();

        }
    };

    // Initialization Logic
    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('search-input-customer');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                window.renderCustomerList(e.target.value.trim());
            });
        }

        document.querySelectorAll('input[name="customer-type"]').forEach(cb => {
            cb.addEventListener('change', () => {
                // 무상 보증 필드 삭제로 인한 별표 토글 로직 제거
            });
        });

        const btnFilterCustomer = document.getElementById('btn-filter-customer');
        const filterPanelCustomer = document.getElementById('customer-filter-panel');
        if(btnFilterCustomer) {
            btnFilterCustomer.addEventListener('click', () => {
                const isHidden = filterPanelCustomer.style.display === 'none';
                filterPanelCustomer.style.display = isHidden ? 'block' : 'none';
            });
        }

        document.querySelectorAll('input[name="customer-filter-route"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                currentCustomerFilterRoute = e.target.value;
                window.renderCustomerList(document.getElementById('search-input-customer').value.trim());
            });
        });

        document.querySelectorAll('input[name="customer-filter-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                currentCustomerFilterType = e.target.value;
                window.renderCustomerList(document.getElementById('search-input-customer').value.trim());
            });
        });

        const btnSaveCustomer = document.getElementById('btn-save-customer');
        const btnOpenCustomer = document.getElementById('btn-open-customer');
        const modalCustomer = document.getElementById('modal-customer');
        const btnCloseModal = document.getElementById('btn-close-modal');

        if(btnOpenCustomer) {
            btnOpenCustomer.addEventListener('click', () => {
                const titleEl = document.querySelector('#modal-customer .modal-header h3');
                if(titleEl) titleEl.textContent = '신규 고객 등록';
                
                document.getElementById('cust-name').value = '';
                document.getElementById('cust-phone').value = '';
                document.getElementById('cust-address').value = '';
                document.getElementById('cust-memo').value = '';
                document.querySelectorAll('input[name="customer-type"]').forEach(cb => cb.checked = false);
                // warranty-asterisk 관련 로직 제거됨
                
                if(btnSaveCustomer) {
                    btnSaveCustomer.textContent = '저장하기';
                    delete btnSaveCustomer.dataset.targetId;
                }
                modalCustomer.style.display = 'flex';
            });
        }

        if(btnSaveCustomer) {
            btnSaveCustomer.addEventListener('click', () => {
                const custName = document.getElementById('cust-name');
                const custPhone = document.getElementById('cust-phone');
                let hasError = false;
                
                if (!custName.value.trim()) {
                    custName.classList.add('shake', 'input-error');
                    setTimeout(() => custName.classList.remove('shake', 'input-error'), 800);
                    hasError = true;
                }
                if (!custPhone.value.trim()) {
                    custPhone.classList.add('shake', 'input-error');
                    setTimeout(() => custPhone.classList.remove('shake', 'input-error'), 800);
                    hasError = true;
                }

                // 무상 보증기간 필수 입력 체크 로직 제거됨

                if (hasError) return;

                btnSaveCustomer.textContent = '저장 완료!';
                btnSaveCustomer.style.backgroundColor = 'var(--success-color, #34c759)';
                
                const custAddress = document.getElementById('cust-address');
                const custMemo = document.getElementById('cust-memo');
                const custTypes = document.querySelectorAll('input[name="customer-type"]:checked');
                const routeNode = document.querySelector('input[name="customer-route"]:checked');
                const custRoute = routeNode ? routeNode.value : '내방';
                const typesStr = Array.from(custTypes).map(cb => cb.value).join(', ');
                
                setTimeout(() => {
                    const targetId = btnSaveCustomer.dataset.targetId;
                    if (targetId) {
                        const tr = window.customerDataList.find(x => x.id === targetId);
                        if(tr) {
                            tr.name = custName.value.trim();
                            tr.phone = custPhone.value.trim();
                            tr.address = custAddress ? custAddress.value.trim() : '';
                            tr.memo = custMemo ? custMemo.value.trim() : '';
                            tr.types = typesStr || '미분류';
                            // warranty 필드 제거됨
                            tr.route = custRoute;
                        }
                        delete btnSaveCustomer.dataset.targetId;
                    } else {
                        const d = new Date();
                        const regDate = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
                        
                        window.customerDataList.unshift({
                            id: 'CUST-' + new Date().getTime().toString().slice(-4),
                            name: custName.value.trim(),
                            phone: custPhone.value.trim(),
                            address: custAddress ? custAddress.value.trim() : '',
                            memo: custMemo ? custMemo.value.trim() : '',
                            types: typesStr || '미분류',
                            route: custRoute,
                            regDate: regDate
                        });
                    }
                    
                    modalCustomer.style.display = 'none';
                    btnSaveCustomer.textContent = '저장하기';
                    btnSaveCustomer.style.backgroundColor = ''; 
                    
                    window.saveCustomerData();
                    window.renderCustomerList();
                    
                    custName.value = ''; custPhone.value = '';
                    if(custAddress) custAddress.value = '';
                    if(custMemo) custMemo.value = '';
                    if(custMemo) custMemo.value = '';
                    // cust-warranty 및 별표 초기화 로직 제거됨
                    document.querySelectorAll('input[name="customer-type"]').forEach(cb => cb.checked = false);
                }, 800);
            });
        }

        if(btnCloseModal) {
            btnCloseModal.addEventListener('click', () => {
                modalCustomer.style.display = 'none';
                if(btnSaveCustomer) btnSaveCustomer.textContent = '저장하기';
            });
        }

        if(modalCustomer) {
            modalCustomer.addEventListener('click', (e) => {
                if (e.target === modalCustomer) btnCloseModal.click();
            });
        }
    });
})();
