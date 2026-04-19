// [Vendor Management Module]
(function() {
    window.vendorDataList = [];

    window.loadVendorData = () => {
        const saved = window.DB.get('PC_VendorData');
        window.vendorDataList = saved ? JSON.parse(saved) : [];
    };

    window.saveVendorData = () => {
        window.DB.set('PC_VendorData', JSON.stringify(window.vendorDataList));
    };

    window.handleDeleteVendor = async (id, e) => {
        if (e) e.stopPropagation();
        if(await showConfirm('해당 매입처를 영구히 삭제하시겠습니까? (복구 불가)', '삭제')) {
            window.vendorDataList = window.vendorDataList.filter(x => x.id !== id);
            window.saveVendorData();
            window.renderVendorList(document.getElementById('search-input-vendor').value);
        }
    };

    window.handleEditVendor = (id) => {
        const item = window.vendorDataList.find(x => x.id === id);
        if(item) {
            const titleEl = document.querySelector('#modal-vendor .modal-header h3');
            if(titleEl) titleEl.textContent = '매입처 상세 및 수정';
            
            document.getElementById('vend-name').value = item.name;
            document.getElementById('vend-phone').value = item.phone;
            const vendOwner = document.getElementById('vend-owner');
            if(vendOwner) vendOwner.value = item.owner;
            const vendAddress = document.getElementById('vend-address');
            if(vendAddress) vendAddress.value = item.address;
            const vendCat = document.getElementById('vend-category');
            if(vendCat) vendCat.value = item.cat;
            const vendType = document.getElementById('vend-type');
            if(vendType) vendType.value = item.type;
            const vendFax = document.getElementById('vend-fax');
            if(vendFax) vendFax.value = item.fax;
            const vendMemo = document.getElementById('vend-memo');
            if(vendMemo) vendMemo.value = item.memo;
            
            const btnSaveVendor = document.getElementById('btn-save-vendor');
            btnSaveVendor.textContent = '매입처 정보 수정';
            btnSaveVendor.dataset.targetId = id;
            
            document.getElementById('modal-vendor').style.display = 'flex';
        }
    };

    window.renderVendorList = (query = '') => {
        const container = document.getElementById('vendor-list-container');
        const emptyState = document.getElementById('vendor-empty-state');
        if(!container) return;
        
        const filtered = query 
            ? window.vendorDataList.filter(item => item.name.includes(query) || (item.phone && item.phone.includes(query)) || (item.owner && item.owner.includes(query)))
            : window.vendorDataList;
            
        if (filtered.length === 0 && window.vendorDataList.length === 0) {
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
                { name: '상호명', class: 'col-m' },
                { name: '대표자', class: 'col-s' },
                { name: '연락처/FAX', class: 'col-m' },
                { name: '업태/종목', class: 'col-m' },
                { name: '비고 및 정보', class: 'col-flex' },
                { name: '관리', class: 'col-action', align: 'center' }
            ], 'vendor-list');

            let html = header;
            filtered.forEach(item => {
                html += `
                    <div class="list-row" onclick="handleEditVendor('${item.id}')">
                        <div class="col-m v-bold">${item.name}</div>
                        <div class="col-s">${item.owner || '-'}</div>
                        <div class="col-m">
                            <div class="v-bold">${item.phone || '-'}</div>
                            ${item.fax ? `<div class="c-muted" style="font-size:11px; margin-top:2px;">FAX: ${item.fax}</div>` : ''}
                        </div>
                        <div class="col-m c-muted" style="font-size:13px;">${item.category || '-'} / ${item.type || '-'}</div>
                        <div class="col-flex c-muted" title="${item.memo || '-'}">${item.memo || '-'}</div>
                        <div class="col-action t-center">
                            <button class="btn-delete" onclick="handleDeleteVendor('${item.id}', event)" title="삭제">
                                <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;

            // [Resizable Table] Apply saved widths and init resizers
            applyColumnWidths('vendor-list-container', 'vendor-list');
            initResizableList('vendor-list-container', 'vendor-list');

            lucide.createIcons();

        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('search-input-vendor');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                window.renderVendorList(e.target.value.trim());
            });
        }

        const btnSaveVendor = document.getElementById('btn-save-vendor');
        const btnOpenVendor = document.getElementById('btn-open-vendor');
        const modalVendor = document.getElementById('modal-vendor');
        const btnCloseModalVendor = document.getElementById('btn-close-modal-vendor');

        if(btnOpenVendor) {
            btnOpenVendor.addEventListener('click', () => {
                const titleEl = document.querySelector('#modal-vendor .modal-header h3');
                if(titleEl) titleEl.textContent = '신규 매입처 등록';
                
                document.getElementById('vend-name').value = '';
                document.getElementById('vend-phone').value = '';
                document.getElementById('vend-owner').value = '';
                document.getElementById('vend-address').value = '';
                document.getElementById('vend-category').value = '';
                document.getElementById('vend-type').value = '';
                document.getElementById('vend-fax').value = '';
                document.getElementById('vend-memo').value = '';
                
                if(btnSaveVendor) {
                    btnSaveVendor.textContent = '매입처 정보 저장';
                    delete btnSaveVendor.dataset.targetId;
                }
                modalVendor.style.display = 'flex';
            });
        }

        if(btnSaveVendor) {
            btnSaveVendor.addEventListener('click', () => {
                const vendName = document.getElementById('vend-name');
                const vendPhone = document.getElementById('vend-phone');
                let hasError = false;
                
                if (!vendName.value.trim()) {
                    vendName.classList.add('shake', 'input-error');
                    setTimeout(() => vendName.classList.remove('shake', 'input-error'), 800);
                    hasError = true;
                }
                if (!vendPhone.value.trim()) {
                    vendPhone.classList.add('shake', 'input-error');
                    setTimeout(() => vendPhone.classList.remove('shake', 'input-error'), 800);
                    hasError = true;
                }
                if (hasError) return;

                btnSaveVendor.textContent = '저장 완료!';
                btnSaveVendor.style.backgroundColor = 'var(--success-color, #34c759)';
                
                const vendOwner = document.getElementById('vend-owner');
                const vendAddress = document.getElementById('vend-address');
                const vendCat = document.getElementById('vend-category');
                const vendType = document.getElementById('vend-type');
                const vendFax = document.getElementById('vend-fax');
                const vendMemo = document.getElementById('vend-memo');
                
                setTimeout(() => {
                    const targetId = btnSaveVendor.dataset.targetId;
                    if (targetId) {
                        const tr = window.vendorDataList.find(x => x.id === targetId);
                        if(tr) {
                            tr.name = vendName.value.trim();
                            tr.phone = vendPhone.value.trim();
                            tr.owner = vendOwner ? vendOwner.value.trim() : '';
                            tr.address = vendAddress ? vendAddress.value.trim() : '';
                            tr.cat = vendCat ? vendCat.value.trim() : '';
                            tr.type = vendType ? vendType.value.trim() : '';
                            tr.fax = vendFax ? vendFax.value.trim() : '';
                            tr.memo = vendMemo ? vendMemo.value.trim() : '';
                        }
                        delete btnSaveVendor.dataset.targetId;
                    } else {
                        window.vendorDataList.unshift({
                            id: 'VEND-' + new Date().getTime().toString().slice(-4),
                            name: vendName.value.trim(),
                            phone: vendPhone.value.trim(),
                            owner: vendOwner ? vendOwner.value.trim() : '',
                            address: vendAddress ? vendAddress.value.trim() : '',
                            cat: vendCat ? vendCat.value.trim() : '',
                            type: vendType ? vendType.value.trim() : '',
                            fax: vendFax ? vendFax.value.trim() : '',
                            memo: vendMemo ? vendMemo.value.trim() : ''
                        });
                    }
                    
                    modalVendor.style.display = 'none';
                    btnSaveVendor.textContent = '매입처 정보 저장';
                    btnSaveVendor.style.backgroundColor = ''; 
                    
                    window.saveVendorData();
                    window.renderVendorList();
                    
                    vendName.value = ''; vendPhone.value = '';
                    if(vendOwner) vendOwner.value = '';
                    if(vendAddress) vendAddress.value = '';
                    if(vendCat) vendCat.value = '';
                    if(vendType) vendType.value = '';
                    if(vendFax) vendFax.value = '';
                    if(vendMemo) vendMemo.value = '';
                }, 800);
            });
        }

        if(btnCloseModalVendor) {
            btnCloseModalVendor.addEventListener('click', () => {
                modalVendor.style.display = 'none';
                if(btnSaveVendor) btnSaveVendor.textContent = '매입처 정보 저장';
            });
        }

        if(modalVendor) {
            modalVendor.addEventListener('click', (e) => {
                if (e.target === modalVendor) btnCloseModalVendor.click();
            });
        }
    });

    window.loadVendorData();
})();
