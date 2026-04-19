// [Application Core & Navigation Logic]
(function() {
    window.initApp = () => {
        // Theme Switch Logic
        const themeBtn = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');

        const executeThemeSwitch = (themeType) => {
            if (themeType === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                themeIcon.setAttribute('data-lucide', 'sun');
                window.DB.set('PC_AppTheme', 'dark');
                ipcRenderer.send('theme-changed', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
                themeIcon.setAttribute('data-lucide', 'moon');
                window.DB.set('PC_AppTheme', 'light');
                ipcRenderer.send('theme-changed', 'light');
            }
            lucide.createIcons();
        };

        if(themeBtn) {
            themeBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme');
                executeThemeSwitch(current === 'dark' ? 'light' : 'dark');
            });
        }

        // --- Real-time Date Update for Header ---
        window.getFormattedDate = () => {
            const now = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            return now.toLocaleDateString('ko-KR', options);
        };

        function updateHeaderDate() {
            try {
                const headerDesc = document.getElementById('header-desc');
                if (headerDesc) {
                    headerDesc.textContent = window.getFormattedDate();
                }
            } catch(e) { console.error('Date update failed', e); }
        }
        
        // 초기 실행 지연 최소화 및 즉시 실행
        updateHeaderDate(); 
        setInterval(() => window.safeInit(updateHeaderDate, 'HeaderDateInterval'), 60000);
        

        if (window.DB.get('PC_AppTheme') === 'dark') {
            executeThemeSwitch('dark');
        }

        // Tab Switch Generic Logic
        window.switchTab = (activeTab, activeView, title, desc, activeBtn) => {
            if(!activeTab || !activeView) return;
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
            activeTab.classList.add('active');
            
            const views = [
                document.getElementById('view-dashboard'),
                document.getElementById('view-customer'),
                document.getElementById('view-vendor'),
                document.getElementById('view-as'),
                document.getElementById('view-quote'),
                document.getElementById('view-stock'),
                document.getElementById('view-pc-sales'),
                document.getElementById('view-ledger'),
                document.getElementById('view-transaction'),
                document.getElementById('view-stat')
            ];
            views.forEach(v => { if(v) v.style.display = 'none'; });

            const topBtns = [
                document.getElementById('btn-open-customer'),
                document.getElementById('btn-open-vendor'),
                document.getElementById('btn-open-as'),
                document.getElementById('btn-open-quote'),
                document.getElementById('btn-open-stock'),
                document.getElementById('btn-add-pc-sale'),
                document.getElementById('btn-open-revenue'),
                document.getElementById('btn-open-expense'),
                document.getElementById('btn-open-transaction')
            ];
            topBtns.forEach(b => { if(b) b.style.display = 'none'; });
            
            activeView.style.display = 'block';
            if(activeBtn) {
                if (Array.isArray(activeBtn)) {
                    activeBtn.forEach(b => { if(b) b.style.display = 'flex'; });
                } else {
                    activeBtn.style.display = 'flex';
                }
            }
            
            const hTitle = document.getElementById('header-title');
            const hDesc = document.getElementById('header-desc');
            if(hTitle) hTitle.textContent = title;
            
            // 대시보드일 경우 실시간 날짜 즉시 반영, 그 외에는 각 탭의 설명 표시
            if(hDesc) {
                if(activeTab.id === 'tab-dashboard') {
                    hDesc.textContent = window.getFormattedDate();
                } else {
                    hDesc.textContent = desc;
                }
            }

            try { lucide.createIcons(); } catch(e) {}
        };
        
        initTabs();
    };

    function initTabs() {
        const tabs = [
            { id: 'tab-dashboard', view: 'view-dashboard', title: '오늘의 매장 현황', desc: '', btn: null, callback: updateDashboardWidgets },
            { id: 'tab-customer', view: 'view-customer', title: '고객 관리', desc: '등록된 고객 정보 및 히스토리를 관리합니다.', btn: 'btn-open-customer', callback: renderCustomerList },
            { id: 'tab-vendor', view: 'view-vendor', title: '매입처 관리', desc: '주요 부품 및 자재 거래처 정보를 통합 관리합니다.', btn: 'btn-open-vendor', callback: renderVendorList },
            { id: 'tab-stock', view: 'view-stock', title: '재고 관리', desc: '매장 내 부품 현황 및 입출고 기록을 관리합니다.', btn: 'btn-open-stock', callback: renderStockList },
            { id: 'tab-pc-sales', view: 'view-pc-sales', title: 'PC 판매 관리', desc: '조립 PC 판매 내역 및 진행 상태 관리', btn: 'btn-add-pc-sale', callback: renderPcSalesList },
            { id: 'tab-as', view: 'view-as', title: 'AS 관리', desc: '서비스 접수 내역 및 진행 상태를 파악합니다.', btn: 'btn-open-as', callback: renderASLists },
            { id: 'tab-quote', view: 'view-quote', title: '견적서 발급', desc: 'PC 조립 및 부품 판매 견적을 전문적으로 작성합니다.', btn: 'btn-open-quote', callback: renderQuoteList },
            { id: 'tab-ledger', view: 'view-ledger', title: '매출 및 매입 등록', desc: '통계에 반영될 공식 매출 및 지출 내역을 관리합니다.', btn: ['btn-open-revenue', 'btn-open-expense'], callback: renderLedgerList },
            { id: 'tab-transaction', view: 'view-transaction', title: '거래명세서 발급', desc: '고객에게 발송할 전문 거래명세서를 발행하고 관리합니다.', btn: 'btn-open-transaction', callback: renderTransactionList },
            { id: 'tab-stat', view: 'view-stat', title: '매출 및 통계', desc: '월 단위 매장 실적 요약 및 마감 집계를 확인합니다.', btn: null, callback: loadStatData }
        ];

        tabs.forEach(tab => {
            const el = document.getElementById(tab.id);
            if(el) {
                el.addEventListener('click', () => {
                    let targetBtn = null;
                    if (Array.isArray(tab.btn)) {
                        targetBtn = tab.btn.map(bid => document.getElementById(bid));
                    } else if (tab.btn) {
                        targetBtn = document.getElementById(tab.btn);
                    }
                    window.switchTab(el, document.getElementById(tab.view), tab.title, tab.desc, targetBtn);
                    if(typeof tab.callback === 'function') tab.callback();
                });
            }
        });
    }

    // Global widget update exposed for other modules
    window.updateDashboardWidgets = () => {
        if(typeof window._updateDashboardWidgets === 'function') window._updateDashboardWidgets();
    };
})();
