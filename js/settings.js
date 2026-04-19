// [Shop Settings & Branding Module]
(function() {
    window.shopSettings = {
        shopName: '', bizNum: '', ceoName: '', tel: '', address: '', bizType: '', bizItem: '', seal: '',
        bankName: '', bankAccount: ''
    };

    // Load Business Settings (for Quotes/AS)
    window.loadShopSettings = () => {
        try {
            const saved = window.DB.get('PC_ShopSettings');
            if(saved) window.shopSettings = JSON.parse(saved);
            
            // Fill Business Fields in System Modal
            const mapping = {
                'sys-shop-name': window.shopSettings.shopName,
                'sys-shop-biz-num': window.shopSettings.bizNum,
                'sys-shop-ceo-name': window.shopSettings.ceoName,
                'sys-shop-tel': window.shopSettings.tel,
                'sys-shop-address': window.shopSettings.address,
                'sys-shop-biz-type': window.shopSettings.bizType,
                'sys-shop-biz-item': window.shopSettings.bizItem,
                'sys-shop-bank-name': window.shopSettings.bankName,
                'sys-shop-bank-account': window.shopSettings.bankAccount
            };

            for(const id in mapping) {
                const el = document.getElementById(id);
                if(el) el.value = mapping[id] || '';
            }
            
            const preview = document.getElementById('shop-seal-preview');
            if(window.shopSettings.seal && preview) {
                preview.innerHTML = `<img src="${window.shopSettings.seal}" style="width:100%; height:100%; object-fit:contain;">`;
            } else if(preview) {
                preview.innerHTML = `<i data-lucide="image" style="opacity:0.2; width:20px;"></i>`;
                lucide.createIcons();
            }

            refreshDashboardBranding();
        } catch (e) {
            console.error('Failed to load shop settings:', e);
        }
    };

    // Refresh Sidebar & Login Branding (Logo + Name)
    window.refreshDashboardBranding = () => {
        const savedLogo = window.DB.get('PC_ShopLogo');
        const savedName = window.DB.get('PC_ShopName') || 'PCSHOP';
        const savedColor = window.DB.get('PC_ShopNameColor') || '#1d1d1f';
        
        const dashContainer = document.getElementById('dashboard-logo-container');
        const dashLogo = document.getElementById('dashboard-logo');
        const dashName = document.getElementById('dashboard-shop-name');
        const authLogo = document.getElementById('auth-logo-img');
        const authShopName = document.getElementById('auth-shop-name');
        
        // Settings Modal Preview
        const logoPreview = document.getElementById('logo-preview');
        if(logoPreview) {
            if(savedLogo) logoPreview.innerHTML = `<img src="${savedLogo}" style="width:100%; height:100%; object-fit:contain;">`;
            else logoPreview.innerHTML = `<i data-lucide="image" style="width:24px; color:var(--text-muted); opacity:0.3;"></i>`;
            lucide.createIcons();
        }

        if (dashContainer) {
            if(savedLogo || savedName) dashContainer.style.display = 'flex';
            else dashContainer.style.display = 'none';
        }

        if (dashLogo) {
            if(savedLogo) {
                dashLogo.src = savedLogo;
                dashLogo.parentElement.style.display = 'block';
            } else {
                dashLogo.src = '';
                dashLogo.parentElement.style.display = 'none';
            }
        }
        if (dashName) {
            dashName.textContent = savedName;
            dashName.style.color = savedColor;
            dashName.style.display = 'block';
        }
        
        if (authLogo && savedLogo) authLogo.src = savedLogo;
        if (authShopName) {
            authShopName.textContent = savedName;
            authShopName.style.color = savedColor;
        }
    };

    window.saveShopSettings = () => {
        const mapping = {
            shopName: 'sys-shop-name',
            bizNum: 'sys-shop-biz-num',
            ceoName: 'sys-shop-ceo-name',
            tel: 'sys-shop-tel',
            address: 'sys-shop-address',
            bizType: 'sys-shop-biz-type',
            bizItem: 'sys-shop-biz-item',
            bankName: 'sys-shop-bank-name',
            bankAccount: 'sys-shop-bank-account'
        };

        for(const key in mapping) {
            const el = document.getElementById(mapping[key]);
            if(el) window.shopSettings[key] = el.value;
        }

        window.DB.set('PC_ShopSettings', JSON.stringify(window.shopSettings));
        showAlert('사업자 정보가 저장 및 반영되었습니다.');
        if(window.renderQuoteList) window.renderQuoteList();
    };

    // DB Export / Import Logic
    const exportDatabase = async () => {
        const ipc = window.ipc || (typeof window.require !== 'undefined' ? window.require('electron').ipcRenderer : null);
        const data = window.DB.exportAll();
        const date = new Date().toISOString().split('T')[0];
        const filename = `pcshop_backup_${date}.json`;
        const content = JSON.stringify(data, null, 2);

        if(ipc) {
            try {
                const result = await ipc.invoke('save-database', content, filename);
                if(result && result.success) {
                    await showAlert('데이터베이스 내보내기가 완료되었습니다.');
                    return;
                } else if(result && result.canceled) {
                    return;
                }
            } catch (err) {
                console.error('IPC Invocation error:', err);
            }
        }

        try {
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            console.warn('Fallback export triggered.');
        } catch (e) {
            console.error('Fallback export failed:', e);
        }
    };

    const importDatabase = (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const count = Object.keys(data).length;
                const confirmed = await showConfirm(`불러오기를 진행하면 현재 데이터가 덮어씌워집니다.\n(${count}개의 항목 발견)\n진행하시겠습니까?`);
                if(!confirmed) return;

                window.DB.importAll(data);
                await showAlert('데이터 복구가 완료되었습니다. 애플리케이션을 새로고침합니다.');
                location.reload();
            } catch (err) {
                console.error('Import failed:', err);
                showAlert('데이터 형식이 올바르지 않거나 손상된 파일입니다.');
            }
        };
        reader.readAsText(file);
    };

    document.addEventListener('DOMContentLoaded', () => {
        const tabSettings = document.getElementById('tab-settings');
        
        const openSystemSettings = () => {
            const nameInput = document.getElementById('shop-name-input');
            if(nameInput) nameInput.value = window.DB.get('PC_ShopName') || '';

            const savedColor = window.DB.get('PC_ShopNameColor') || '#1d1d1f';
            document.querySelectorAll('#shop-color-palette .color-dot').forEach(dot => {
                if(dot.getAttribute('data-color') === savedColor) dot.classList.add('active');
                else dot.classList.remove('active');
            });

            window.loadShopSettings(); // Load Business Tab too
            document.getElementById('modal-system-settings').style.display = 'flex';
        };

        if(tabSettings) tabSettings.addEventListener('click', openSystemSettings);

        // Settings Tab Switch Logic
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                document.querySelectorAll('.settings-tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.color = 'var(--text-muted)';
                    b.style.fontWeight = '600';
                    b.style.borderBottom = 'none';
                });
                btn.classList.add('active');
                btn.style.color = 'var(--accent)';
                btn.style.fontWeight = '700';
                btn.style.borderBottom = '2px solid var(--accent)';

                document.querySelectorAll('.settings-tab-content').forEach(content => {
                    content.style.display = content.id === target.replace('sys-', 'sys-tab-') ? 'block' : 'none';
                });
            });
        });

        const btnExport = document.getElementById('btn-export-db');
        const btnImport = document.getElementById('btn-import-db');
        const importFile = document.getElementById('db-import-file');

        if(btnExport) btnExport.addEventListener('click', exportDatabase);
        if(btnImport && importFile) {
            btnImport.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => {
                if(e.target.files[0]) importDatabase(e.target.files[0]);
                importFile.value = '';
            });
        }

        const btnResetPw = document.getElementById('btn-reset-pw-view');
        if(btnResetPw) {
            btnResetPw.addEventListener('click', async () => {
                const confirmed = await showConfirm('마스터 비밀번호를 재설정하시겠습니까?\n확인을 누르면 초기 설정 화면으로 이동합니다.', '재설정');
                if(confirmed) {
                    window.DB.remove('PC_MasterPassword');
                    location.reload();
                }
            });
        }

        // Support Modal Logic
        const btnShowSupport = document.getElementById('btn-show-support-info');
        const btnCloseSupport = document.getElementById('btn-close-support-info');
        const modalSupport = document.getElementById('modal-support-info');

        if(btnShowSupport && modalSupport) {
            btnShowSupport.addEventListener('click', () => {
                modalSupport.style.display = 'flex';
            });
        }
        if(btnCloseSupport && modalSupport) {
            btnCloseSupport.addEventListener('click', () => {
                modalSupport.style.display = 'none';
            });
        }



        const colorPalette = document.getElementById('shop-color-palette');
        if(colorPalette) {
            colorPalette.addEventListener('click', (e) => {
                const dot = e.target.closest('.color-dot');
                if(!dot) return;
                document.querySelectorAll('#shop-color-palette .color-dot').forEach(el => el.classList.remove('active'));
                dot.classList.add('active');
                const color = dot.getAttribute('data-color');
                window.DB.set('PC_ShopNameColor', color);
                window.refreshDashboardBranding();
            });
        }

        const btnSaveShopInfo = document.getElementById('btn-save-shop-info');
        if(btnSaveShopInfo) {
            btnSaveShopInfo.addEventListener('click', () => {
                const name = document.getElementById('shop-name-input').value;
                window.DB.set('PC_ShopName', name);
                window.refreshDashboardBranding();
                showAlert('매장 브랜딩 정보가 저장되었습니다.');
            });
        }

        const btnSaveFull = document.getElementById('btn-save-full-settings');
        if(btnSaveFull) btnSaveFull.addEventListener('click', window.saveShopSettings);

        const btnCloseSystem = document.getElementById('btn-close-modal-system-settings');
        if(btnCloseSystem) btnCloseSystem.addEventListener('click', () => document.getElementById('modal-system-settings').style.display = 'none');

        const sealFile = document.getElementById('shop-seal-file');
        const btnDeleteSeal = document.getElementById('btn-delete-seal');
        if(sealFile) {
            sealFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if(!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    window.shopSettings.seal = event.target.result;
                    const preview = document.getElementById('shop-seal-preview');
                    if(preview) preview.innerHTML = `<img src="${window.shopSettings.seal}" style="width:100%; height:100%; object-fit:contain;">`;
                };
                reader.readAsDataURL(file);
            });
        }
        if(btnDeleteSeal) {
            btnDeleteSeal.addEventListener('click', () => {
                window.shopSettings.seal = '';
                const preview = document.getElementById('shop-seal-preview');
                if(preview) preview.innerHTML = `<i data-lucide="image" style="opacity:0.2; width:20px;"></i>`;
                lucide.createIcons();
                if(sealFile) sealFile.value = '';
            });
        }

        const btnUploadLogo = document.getElementById('btn-upload-logo');
        const btnDeleteLogo = document.getElementById('btn-delete-logo');
        const logoFile = document.getElementById('logo-upload-file');

        if(btnUploadLogo && logoFile) btnUploadLogo.addEventListener('click', () => logoFile.click());
        if(logoFile) {
            logoFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if(!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    if(window.openLogoEditor) window.openLogoEditor(event.target.result);
                };
                reader.readAsDataURL(file);
                logoFile.value = '';
            });
        }
        if(btnDeleteLogo) {
            btnDeleteLogo.addEventListener('click', () => {
                window.DB.remove('PC_ShopLogo');
                window.refreshDashboardBranding();
            });
        }

        // --- Logo Editor Logic (Restored) ---
        let editorState = { scale: 1.0, x: 0, y: 0, isDragging: false, startX: 0, startY: 0, img: null };

        window.openLogoEditor = (src) => {
            const modal = document.getElementById('modal-logo-edit');
            const canvas = document.getElementById('logo-edit-canvas');
            const slider = document.getElementById('logo-edit-scale-slider');
            const scaleVal = document.getElementById('logo-edit-scale-value');
            
            if(!modal || !canvas) return;

            editorState = { scale: 1.0, x: 0, y: 0, isDragging: false, startX: 0, startY: 0, img: new Image() };
            editorState.img.src = src;
            editorState.img.style.position = 'absolute';
            editorState.img.style.cursor = 'grab';
            editorState.img.style.userSelect = 'none';
            editorState.img.style.webkitUserDrag = 'none';

            editorState.img.onload = () => {
                canvas.innerHTML = '';
                canvas.appendChild(editorState.img);
                updateEditorTransform();
                modal.style.display = 'flex';
                if(slider) slider.value = 1.0;
                if(scaleVal) scaleVal.textContent = '100%';
            };
        };

        const updateEditorTransform = () => {
            if(!editorState.img) return;
            editorState.img.style.transform = `translate(${editorState.x}px, ${editorState.y}px) scale(${editorState.scale})`;
            const scaleVal = document.getElementById('logo-edit-scale-value');
            if(scaleVal) scaleVal.textContent = `${Math.round(editorState.scale * 100)}%`;
        };

        const applyLogoEdit = async () => {
            const canvas = document.getElementById('logo-edit-canvas');
            if(!canvas) return;
            try {
                const originalBorder = canvas.style.border;
                const originalShadow = canvas.style.boxShadow;
                canvas.style.border = 'none';
                canvas.style.boxShadow = 'none';

                const result = await html2canvas(canvas, {
                    backgroundColor: null,
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    width: 260,
                    height: 260
                });
                
                canvas.style.border = originalBorder;
                canvas.style.boxShadow = originalShadow;

                const dataUrl = result.toDataURL('image/png');
                window.DB.set('PC_ShopLogo', dataUrl);
                window.refreshDashboardBranding();
                document.getElementById('modal-logo-edit').style.display = 'none';
                showAlert('로고 편집이 완료되었습니다.');
            } catch (e) {
                console.error('Logo crop failed:', e);
                showAlert('로고 저장 중 오류가 발생했습니다.');
            }
        };

        const editCanvas = document.getElementById('logo-edit-canvas');
        if(editCanvas) {
            editCanvas.addEventListener('mousedown', (e) => {
                editorState.isDragging = true;
                editorState.startX = e.clientX - editorState.x;
                editorState.startY = e.clientY - editorState.y;
                if(editorState.img) editorState.img.style.cursor = 'grabbing';
            });
            window.addEventListener('mousemove', (e) => {
                if(!editorState.isDragging) return;
                editorState.x = e.clientX - editorState.startX;
                editorState.y = e.clientY - editorState.startY;
                updateEditorTransform();
            });
            window.addEventListener('mouseup', () => {
                editorState.isDragging = false;
                if(editorState.img) editorState.img.style.cursor = 'grab';
            });
            editCanvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.05 : 0.05;
                editorState.scale = Math.max(0.2, Math.min(5, editorState.scale + delta));
                const slider = document.getElementById('logo-edit-scale-slider');
                if(slider) slider.value = editorState.scale;
                updateEditorTransform();
            });
        }

        const scaleSlider = document.getElementById('logo-edit-scale-slider');
        if(scaleSlider) {
            scaleSlider.addEventListener('input', (e) => {
                editorState.scale = parseFloat(e.target.value);
                updateEditorTransform();
            });
        }

        const btnApply = document.getElementById('btn-apply-logo-edit');
        const btnCancel = document.getElementById('btn-cancel-logo-edit');
        if(btnApply) btnApply.addEventListener('click', applyLogoEdit);
        if(btnCancel) btnCancel.addEventListener('click', () => document.getElementById('modal-logo-edit').style.display = 'none');
    });

    window.loadShopSettings();
})();
