// [Statistics & System Management Module]
(function() {
    const fs = require('fs');
    const ipcStat = require('electron').ipcRenderer;
    let statChartInstance = null;
    let currentStatPeriod = 'today';

    window.loadStatData = () => {
        const periodBtns = document.querySelectorAll('.stat-period-btn');
        periodBtns.forEach(btn => {
            if(!btn.dataset.bound) {
                btn.addEventListener('click', () => {
                    periodBtns.forEach(b => { b.classList.remove('active'); b.style.color = 'var(--text-muted)'; });
                    btn.classList.add('active'); btn.style.color = 'var(--text-color)';
                    currentStatPeriod = btn.dataset.period;
                    document.getElementById('stat-custom-month').value = '';
                    window.renderStatDashboard();
                });
                btn.dataset.bound = 'true';
            }
        });

        const customMonthInput = document.getElementById('stat-custom-month');
        if(customMonthInput && !customMonthInput.dataset.bound) {
            customMonthInput.addEventListener('change', () => {
                if(customMonthInput.value) {
                    periodBtns.forEach(b => { b.classList.remove('active'); b.style.color = 'var(--text-muted)'; });
                    currentStatPeriod = 'custom';
                    window.renderStatDashboard();
                }
            });
            customMonthInput.dataset.bound = 'true';
        }

        const btnRefresh = document.getElementById('btn-refresh-stat');
        if(btnRefresh && !btnRefresh.dataset.bound) {
            btnRefresh.addEventListener('click', window.renderStatDashboard);
            btnRefresh.dataset.bound = 'true';
        }

        const now = new Date();
        if(customMonthInput && !customMonthInput.value) {
            customMonthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        
        window.renderStatDashboard();
        
        // [Report Export Listeners]
        const btnReportExcel = document.getElementById('btn-stat-report-excel');
        const btnReportPrint = document.getElementById('btn-stat-report-print');
        
        if(btnReportExcel && !btnReportExcel.dataset.bound) {
            btnReportExcel.addEventListener('click', () => exportReport('excel'));
            btnReportExcel.dataset.bound = 'true';
        }
        if(btnReportPrint && !btnReportPrint.dataset.bound) {
            btnReportPrint.addEventListener('click', () => exportReport('pdf'));
            btnReportPrint.dataset.bound = 'true';
        }

        const reportTypeSelect = document.getElementById('stat-report-type');
        if(reportTypeSelect && !reportTypeSelect.dataset.bound) {
            reportTypeSelect.addEventListener('change', () => {
                const area = document.getElementById('stat-report-custom-date-area');
                if(area) area.style.display = (reportTypeSelect.value === 'custom') ? 'flex' : 'none';
            });
            reportTypeSelect.dataset.bound = 'true';
        }

        const reportStartDate = document.getElementById('stat-report-start-date');
        const reportEndDate = document.getElementById('stat-report-end-date');
        if(reportStartDate && reportEndDate && !reportStartDate.value) {
            const today = new Date().toISOString().split('T')[0];
            reportStartDate.value = today;
            reportEndDate.value = today;
        }
    };

    const getStatDateRange = () => {
        const now = new Date();
        const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        switch(currentStatPeriod) {
            case 'today': return [formatDate(now), formatDate(now)];
            case 'week': { const d = new Date(); d.setDate(now.getDate() - 6); return [formatDate(d), formatDate(now)]; }
            case 'month': return [formatDate(new Date(now.getFullYear(), now.getMonth(), 1)), formatDate(now)];
            case 'year': return [formatDate(new Date(now.getFullYear(), 0, 1)), formatDate(now)];
            case 'custom': {
                const val = document.getElementById('stat-custom-month').value;
                if(!val) return [formatDate(now), formatDate(now)];
                const [y, m] = val.split('-');
                return [formatDate(new Date(y, m - 1, 1)), formatDate(new Date(y, m, 0))];
            }
            default: return [formatDate(now), formatDate(now)];
        }
    };

    window.renderStatDashboard = () => {
        const [startDate, endDate] = getStatDateRange();
        let totalRevenue = 0, asRevenue = 0, pcRevenue = 0, totalCard = 0, partsCost = 0, asCount = 0, pcCount = 0;
        const purchaseCategoryStats = {};
        const routeStats = {};
        const detailList = [];
        const isDateInRange = (d) => d >= startDate && d <= endDate;

        window.ledgerDataList.forEach(item => {
            if(!isDateInRange(item.date)) return;
            if (item.type === '매출') {
                const amt = parseInt(item.amount) || 0;
                totalRevenue += amt;
                
                // 세분화된 카테고리를 통계 그룹에 매핑
                const asGroup = ['AS', '업그레이드', '조립대행', 'AS수리'];
                const pcGroup = ['PC 판매', '부품 판매', 'PC판매'];

                if (asGroup.includes(item.category)) { 
                    asRevenue += amt; asCount++; 
                } else if (pcGroup.includes(item.category)) { 
                    pcRevenue += amt; pcCount++; 
                }
                
                if (item.paymentMethod === 'card') totalCard += amt;
                let route = '내방';
                try {
                    const cust = window.customerDataList.find(c => c.name === item.targetName);
                    if(cust && cust.route) route = cust.route;
                } catch(e){}
                routeStats[route] = (routeStats[route] || 0) + 1;
            } else if (item.type === '매입') {
                const amt = parseInt(item.amount) || 0;
                partsCost += amt;
                purchaseCategoryStats[item.category] = (purchaseCategoryStats[item.category] || 0) + amt;
            }
            detailList.push(item);
        });

        // 세무 및 수익 정밀화 (보고서 로직과 일치)
        const revVat = Math.floor(totalRevenue / 11);
        const buyVat = Math.floor(partsCost / 11);
        const netVat = revVat - buyVat; // 납부/환급 부가세
        const cardFee = Math.floor(totalCard * 0.012);
        
        const revSupply = totalRevenue - revVat;
        const buySupply = partsCost - buyVat;
        const netProfit = revSupply - buySupply - cardFee;

        const setInh = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
        const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

        setInh('stat-total-revenue', `${totalRevenue.toLocaleString()} <span style="font-size:18px; color:var(--text-muted); font-weight:600;">원</span>`);
        setTxt('stat-pc-revenue', pcRevenue.toLocaleString());
        setTxt('stat-as-revenue', asRevenue.toLocaleString());
        
        // 총 매입액 표시
        setInh('stat-total-purchase', `${partsCost.toLocaleString()} <span style="font-size:18px; font-weight:600;">원</span>`);

        setInh('stat-total-deduction', `${(netVat + cardFee).toLocaleString()} <span style="font-size:18px; color:var(--text-muted); font-weight:600;">원</span>`);
        setTxt('stat-tax-deduction', (netVat >= 0 ? '' : '-') + Math.abs(netVat).toLocaleString());
        setTxt('stat-card-deduction', cardFee.toLocaleString());
        
        // 실질 운영 순수익 표시 (ID: stat-pure-profit)
        setInh('stat-pure-profit', `${netProfit.toLocaleString()} <span style="font-size:18px; color:rgba(255,255,255,0.8); font-weight:600;">원</span>`);
        
        // 수익 박스 하단 상세 정산 요약 (매출 - 매입 - 세금/수수료)
        const breakdownContainer = document.getElementById('stat-purchase-breakdown');
        if (breakdownContainer) {
            const totalTaxFee = netVat + cardFee;
            // 세금/수수료 합계가 음수면 '환급/이득'이므로 +로 표시, 양수면 '지출'이므로 -로 표시
            const taxFeeSign = totalTaxFee >= 0 ? '-' : '+';
            const taxFeeLabel = totalTaxFee >= 0 ? '세금 및 수수료:' : '세금 환급 및 수수료:';
            
            breakdownContainer.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,0.9); margin-bottom:4px;">
                    <span>총 매출액:</span>
                    <span style="font-weight:700;">+${totalRevenue.toLocaleString()}원</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,0.8); margin-bottom:4px;">
                    <span>총 매입액:</span>
                    <span style="font-weight:700;">-${partsCost.toLocaleString()}원</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,0.7);">
                    <span>${taxFeeLabel}</span>
                    <span style="font-weight:700;">${taxFeeSign}${Math.abs(totalTaxFee).toLocaleString()}원</span>
                </div>
            `;
        }
        
        setInh('stat-pc-count', `${pcCount}<span style="font-size:16px; color:var(--text-muted); font-weight:600; margin-left:4px;">대</span>`);
        setInh('stat-as-count', `${asCount}<span style="font-size:16px; color:var(--text-muted); font-weight:600; margin-left:4px;">건</span>`);

        const routeContainer = document.getElementById('stat-route-container');
        if(routeContainer) {
            const total = Object.values(routeStats).reduce((a, b) => a + b, 0);
            if(total === 0) routeContainer.innerHTML = `<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:20px;">데이터가 없습니다.</div>`;
            else {
                routeContainer.innerHTML = Object.entries(routeStats).sort((a,b) => b[1]-a[1]).map(([name, count]) => {
                    const pct = Math.round((count/total)*100);
                    return `<div style="display:flex; align-items:center; gap:12px;"><div style="font-size:12px; font-weight:600; width:60px;">${name}</div><div style="flex:1; height:8px; background:var(--bg-color); border-radius:4px; overflow:hidden;"><div style="width:${pct}%; height:100%; background:var(--accent);"></div></div><div style="font-size:11px; color:var(--text-muted); width:40px; text-align:right;">${pct}%</div></div>`;
                }).join('');
            }
        }
        
        setTxt('stat-detail-count', `총 ${detailList.length}건`);

        const detailListContainer = document.getElementById('stat-detail-list');
        if(detailListContainer) {
            if(detailList.length === 0) detailListContainer.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">표시할 내역이 없습니다.</div>`;
            else {
                detailListContainer.innerHTML = detailList.sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => `
                    <div class="list-row" style="padding: 12px 24px; border-bottom: 1px solid var(--border-color); cursor: default;">
                        <div class="col-s" style="font-size:12px; color:var(--text-muted);">${item.date}</div>
                        <div class="col-xs"><span style="padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; ${item.type === '매출' ? 'background:rgba(0,113,227,0.1); color:var(--accent);' : 'background:rgba(255,59,48,0.1); color:var(--danger-color);'}">${item.type}</span></div>
                        <div class="col-s v-bold" style="font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.targetName || '-'}</div>
                        <div class="col-flex" style="font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:12px;">${item.itemName}</div>
                        <div class="col-m t-right v-bold" style="color:${item.type === '매출' ? 'var(--text-color)' : 'var(--danger-color)'};">${item.type === '매출' ? '+' : '-'}${item.amount.toLocaleString()}</div>
                    </div>
                `).join('');
            }
        }
        window.updateStatChart();
    };
    window.updateStatChart = () => {
        const ctx = document.getElementById('monthlyTrendChart');
        if(!ctx) return;
        const labels = []; const revData = []; const costData = []; const profData = []; 
        const now = new Date();
        const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const formatMonth = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        const processData = (rev, cost, card) => {
            const rVat = Math.floor(rev / 11);
            const cVat = Math.floor(cost / 11);
            const fee = Math.floor(card * 0.012);
            return (rev - rVat) - (cost - cVat) - fee;
        };

        if (currentStatPeriod === 'year') {
            const currentYear = now.getFullYear();
            for(let i = 0; i < 12; i++) {
                const d = new Date(currentYear, i, 1);
                const mLabel = formatMonth(d);
                labels.push(mLabel);
                let mRev = 0, mCost = 0, mCard = 0;
                window.ledgerDataList.forEach(item => {
                    if(item.date.startsWith(mLabel)) {
                        const amt = parseInt(item.amount) || 0;
                        if(item.type === '매출') { mRev += amt; if(item.paymentMethod === 'card') mCard += amt; }
                        else mCost += amt;
                    }
                });
                revData.push(mRev); costData.push(mCost); 
                profData.push(processData(mRev, mCost, mCard));
            }
        } else if (currentStatPeriod === 'custom') {
            const val = document.getElementById('stat-custom-month').value;
            if (val) {
                const [y, m] = val.split('-');
                const lastDay = new Date(y, m, 0).getDate();
                for(let i = 1; i <= lastDay; i++) {
                    const d = new Date(y, m - 1, i);
                    const dLabel = formatDate(d);
                    labels.push(`${m}/${i}`);
                    let dRev = 0, dCost = 0, dCard = 0;
                    window.ledgerDataList.forEach(item => {
                        if(item.date === dLabel) {
                            const amt = parseInt(item.amount) || 0;
                            if(item.type === '매출') { dRev += amt; if(item.paymentMethod === 'card') dCard += amt; }
                            else dCost += amt;
                        }
                    });
                    revData.push(dRev); costData.push(dCost);
                    profData.push(processData(dRev, dCost, dCard));
                }
            }
        } else if (currentStatPeriod === 'month') {
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for(let i = 1; i <= lastDay; i++) {
                const d = new Date(now.getFullYear(), now.getMonth(), i);
                const dLabel = formatDate(d);
                labels.push(`${now.getMonth() + 1}/${i}`);
                let dRev = 0, dCost = 0, dCard = 0;
                window.ledgerDataList.forEach(item => {
                    if(item.date === dLabel) {
                        const amt = parseInt(item.amount) || 0;
                        if(item.type === '매출') { dRev += amt; if(item.paymentMethod === 'card') dCard += amt; }
                        else dCost += amt;
                    }
                });
                revData.push(dRev); costData.push(dCost);
                profData.push(processData(dRev, dCost, dCard));
            }
        } else if (currentStatPeriod === 'today') {
            // 오늘 기준 최근 7일 추이
            for(let i = 6; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                const dLabel = formatDate(d);
                labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
                let dRev = 0, dCost = 0, dCard = 0;
                window.ledgerDataList.forEach(item => {
                    if(item.date === dLabel) {
                        const amt = parseInt(item.amount) || 0;
                        if(item.type === '매출') { dRev += amt; if(item.paymentMethod === 'card') dCard += amt; }
                        else dCost += amt;
                    }
                });
                revData.push(dRev); costData.push(dCost);
                profData.push(processData(dRev, dCost, dCard));
            }
        } else {
            // 기본 14일 추이 (이번 주 등)
            for(let i = 13; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                const dLabel = formatDate(d);
                labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
                let dRev = 0, dCost = 0, dCard = 0;
                window.ledgerDataList.forEach(item => {
                    if(item.date === dLabel) {
                        const amt = parseInt(item.amount) || 0;
                        if(item.type === '매출') { dRev += amt; if(item.paymentMethod === 'card') dCard += amt; }
                        else dCost += amt;
                    }
                });
                revData.push(dRev); costData.push(dCost);
                profData.push(processData(dRev, dCost, dCard));
            }
        }

        if(statChartInstance) statChartInstance.destroy();
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        statChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: '총 매출', data: revData, borderColor: '#0071e3', backgroundColor: 'rgba(0, 113, 227, 0.05)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: labels.length > 20 ? 0 : 3 },
                    { label: '총 매입', data: costData, borderColor: '#ff3b30', backgroundColor: 'transparent', borderWidth: 2, tension: 0.4, borderDash: [2, 2], pointRadius: 0 },
                    { label: '순수익 (예상)', data: profData, borderColor: '#34c759', backgroundColor: 'transparent', borderWidth: 2, tension: 0.2, borderDash: [5, 5], pointRadius: 0 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { labels: { color: isDark ? '#fff' : '#000', font: { family: 'Pretendard', weight: '600', size: 11 } } },
                    tooltip: { backgroundColor: isDark ? '#1d1d1f' : '#fff', titleColor: isDark ? '#fff' : '#1d1d1f', bodyColor: isDark ? '#fff' : '#1d1d1f', boxPadding: 6 }
                },
                scales: {
                    y: { grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }, ticks: { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }
                }
            }
        });
    };

    window._updateDashboardWidgets = () => {
        const now = new Date();
        const ty = now.getFullYear();
        const tm = now.getMonth() + 1;
        const td = now.getDate();

        const checkToday = (dateStr) => {
            if(!dateStr) return false;
            try {
                const parts = dateStr.match(/\d+/g);
                if(!parts || parts.length < 3) return false;
                let dy = parseInt(parts[0]);
                let dm = parseInt(parts[1]);
                let dd = parseInt(parts[2]);
                if(dy < 100) dy += 2000;
                return ty === dy && tm === dm && td === dd;
            } catch(e) { return false; }
        };

        const checkThisMonth = (dateStr) => {
            if(!dateStr) return false;
            try {
                const parts = dateStr.match(/\d+/g);
                if(!parts || parts.length < 3) return false;
                let dy = parseInt(parts[0]);
                let dm = parseInt(parts[1]);
                if(dy < 100) dy += 2000;
                return ty === dy && tm === dm;
            } catch(e) { return false; }
        };

        // 1. 오늘 접수된 AS / 조립 합산 (신규 등록 기준)
        const todayAsCount = window.asDataList.filter(x => checkToday(x.date)).length;
        const todayPcCount = window.pcSalesDataList.filter(x => checkToday(x.saleDate)).length;
        
        // 2. 이번 달 완료된 AS / 조립 (실제 완료 기준)
        const monthCompletedAs = window.asDataList.filter(x => x.status === '완료' && checkThisMonth(x.completionDate)).length;
        const monthCompletedPc = window.pcSalesDataList.filter(x => x.status === '판매완료' && checkThisMonth(x.completionDate)).length;
        const totalCompleted = monthCompletedAs + monthCompletedPc;

        // 3. 입고 대기 중인 부품 (재고 부족 알림)
        const lowStockParts = window.stockDataList.filter(x => x.qty <= (x.safeQty || 3));
        const lowStockCount = lowStockParts.length;
        
        const lowStockCard = document.getElementById('widget-low-stock-card');
        const lowStockList = document.getElementById('widget-low-stock-list');
        
        if(lowStockCard) {
            if(lowStockCount > 0) lowStockCard.classList.add('widget-alert');
            else lowStockCard.classList.remove('widget-alert');
        }

        if(lowStockList) {
            if(lowStockCount > 0) {
                const displayItems = lowStockParts.slice(0, 3); // 최대 3개 노출
                let html = displayItems.map(item => `
                    <div class="low-stock-item" onclick="window.navigateToStock('${item.name}')">${item.name}</div>
                `).join('');
                if(lowStockCount > 3) html += `<div style="font-size:11px; color:var(--text-muted); font-weight:600; padding:4px;">외 ${lowStockCount-3}건</div>`;
                lowStockList.innerHTML = html;
            } else {
                lowStockList.innerHTML = '';
            }
        }
        
        const setWidgetHTML = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html; };
        
        setWidgetHTML('widget-today-count', `${todayAsCount + todayPcCount} <span style="font-size:18px; color:var(--text-muted); font-weight:600; margin-left:2px;">건</span>`);
        setWidgetHTML('widget-pending-count', `
            ${totalCompleted} <span style="font-size:18px; font-weight:600; margin-left:2px; opacity:0.6;">건</span>
            <span style="font-size:13px; font-weight:600; margin-left:10px; opacity:0.7; letter-spacing:-0.5px;">(AS ${monthCompletedAs} / PC ${monthCompletedPc})</span>
        `);
        setWidgetHTML('widget-low-stock-count', `${lowStockCount} <span style="font-size:18px; color:var(--text-muted); font-weight:600; margin-left:2px;">건</span>`);

        // [추가] 대시보드 하단 실시간 리스트(AS, PC판매) 갱신 연동
        if(typeof window.renderASLists === 'function') window.renderASLists();
        if(typeof window.renderPcSalesDashboardList === 'function') window.renderPcSalesDashboardList();
    };

    // 대시보드에서 재고 관리 탭으로 이동 및 자동 검색 헬퍼
    window.navigateToStock = (query) => {
        const tabStock = document.getElementById('tab-stock');
        if(tabStock) {
            tabStock.click();
            setTimeout(() => {
                const searchInput = document.getElementById('search-input-stock');
                if(searchInput) {
                    searchInput.value = query;
                    window.renderStockList(query);
                }
            }, 50);
        }
    };

    // [Report Export Helpers]
    async function exportReport(format) {
        const type = document.getElementById('stat-report-type').value;
        const reportFormat = document.getElementById('stat-report-format').value;
        const data = getReportData(type);
        
        // Select template based on format
        const tplId = (reportFormat === 'detailed') ? 'stat-report-detail-template' : 'stat-report-modern-template';
        const tpl = document.getElementById(tplId);
        
        if(!tpl) {
            showAlert('템플릿을 찾을 수 없습니다.');
            return;
        }

        // Show template for rendering
        tpl.style.display = 'block';
        
        // Render data into selected template
        if(reportFormat === 'detailed') {
            renderDetailReport(data, type);
        } else {
            renderModernReport(data, type);
        }
        
        if(typeof window.showLoading === 'function') window.showLoading('보고서 생성 중...');
        
        try {
            if(format === 'excel') {
                generateExcel(data, type, reportFormat);
            } else if(format === 'img') {
                const canvas = await html2canvas(tpl, { scale: 2, backgroundColor: '#ffffff' });
                const link = document.createElement('a');
                link.download = `Report_${type}_${new Date().toISOString().split('T')[0]}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } else {
                const title = `Report_${reportFormat}_${type}_${new Date().toISOString().split('T')[0]}`;
                await window.isolatedPrint(tplId, title);
            }
            if(typeof window.hideLoading === 'function') window.hideLoading();
        } catch(e) {
            console.error(e);
            if(typeof window.hideLoading === 'function') window.hideLoading();
            window.showAlert('보고서 생성 중 오류가 발생했습니다.');
        } finally {
            tpl.style.display = 'none';
        }
    }

    function generateExcel(data, type, reportFormat) {
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `PCSHOP_보고서_${type}_${dateStr}.xls`;
        const ipc = window.ipc || require('electron').ipcRenderer;

        // XML 특수문자 이스케이프 헬퍼
        const escapeXml = (str) => {
            if (!str) return '';
            return String(str).replace(/[<>&"']/g, (c) => {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case '"': return '&quot;';
                    case "'": return '&apos;';
                    default: return c;
                }
            });
        };

        // [Premium XML Styles] PDF 양식의 프리미엄 디자인을 엑셀 셀 스타일로 이식
        let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="맑은 고딕" ss:Size="10"/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="맑은 고딕" ss:Size="18" ss:Bold="1" ss:Color="#000000"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#000000"/>
   </Borders>
  </Style>
  <Style ss:ID="SubTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="맑은 고딕" ss:Size="10" ss:Color="#86868b"/>
  </Style>
  <Style ss:ID="BoxTitle">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="맑은 고딕" ss:Size="10" ss:Bold="1" ss:Color="#0071e3"/>
   <Interior ss:Color="#f5f5f7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0071e3"/>
   </Borders>
  </Style>
  <Style ss:ID="MainHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryLabel">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="10" ss:Bold="1" ss:Color="#555555"/>
   <Interior ss:Color="#f9f9fb" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryValue">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="11" ss:Bold="1"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="NetProfitBox">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0071e3"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0071e3"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0071e3"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0071e3"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="16" ss:Bold="1" ss:Color="#0071e3"/>
   <Interior ss:Color="#eef7ff" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="TblHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="9" ss:Bold="1" ss:Color="#333333"/>
   <Interior ss:Color="#f5f5f7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TblCell">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="9"/>
  </Style>
  <Style ss:ID="TblCellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="9"/>
  </Style>
  <Style ss:ID="TblCellMoney">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="10" ss:Bold="1"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="TblRedMoney">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#d2d2d7"/>
   </Borders>
   <Font ss:FontName="맑은 고딕" ss:Size="10" ss:Bold="1" ss:Color="#ff3b30"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Report">
  <Table>`;

        if (reportFormat === 'detailed') {
            // ==========================================
            // [Detailed Report: 상세 매출-매입 증빙 양식]
            // ==========================================
            xml += `
   <Column ss:Width="110"/><Column ss:Width="50"/><Column ss:Width="90"/><Column ss:Width="110"/><Column ss:Width="180"/><Column ss:Width="70"/><Column ss:Width="100"/>
   <Row ss:Height="35"><Cell ss:MergeAcross="6" ss:StyleID="Title"><Data ss:Type="String">상세 매출-매입 보고서</Data></Cell></Row>
   <Row ss:Height="20"><Cell ss:MergeAcross="6" ss:StyleID="SubTitle"><Data ss:Type="String">기간: ${data.period} | 발행일: ${dateStr}</Data></Cell></Row>
   
   <Row ss:Index="4" ss:Height="18"><Cell ss:MergeAcross="3" ss:StyleID="BoxTitle"><Data ss:Type="String">  운용 실적 및 결제 수단 요약</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="BoxTitle"><Data ss:Type="String">  서비스 유형 통계</Data></Cell></Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="1" ss:StyleID="SummaryLabel"><Data ss:Type="String">총 매출액</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="SummaryValue"><Data ss:Type="Number">${data.totalRev}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">🔧 AS 서비스</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="SummaryValue"><Data ss:Type="String">${data.asCount}건</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="1" ss:StyleID="SummaryLabel"><Data ss:Type="String">카드 결제 합계 (${data.payStats.card.count}건)</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="SummaryValue"><Data ss:Type="Number">${data.payStats.card.amount}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">🖥️ PC/부품 판매</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="SummaryValue"><Data ss:Type="String">${data.pcCount}건</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="1" ss:StyleID="SummaryLabel"><Data ss:Type="String">현금/이체 합계 (${data.payStats.cash.count + data.payStats.transfer.count}건)</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="SummaryValue"><Data ss:Type="Number">${data.payStats.cash.amount + data.payStats.transfer.amount}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">기타 매출 건수</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="SummaryValue"><Data ss:Type="String">${data.ledger.filter(x => x.type === '매출' && !['AS', '업그레이드', 'PC 판매', '부품 판매'].includes(x.category)).length}건</Data></Cell>
   </Row>
   <Row ss:Height="35">
    <Cell ss:StyleID="NetProfitBox"><Data ss:Type="String">운영 순수익</Data></Cell><Cell ss:MergeAcross="5" ss:StyleID="NetProfitBox"><Data ss:Type="Number">${data.netProfit}</Data></Cell>
   </Row>

   <Row ss:Index="9" ss:Height="22">
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">날짜</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">구분</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">카테고리</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">고객/매입처</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">품목 및 적요</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">결제수단</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">금액</Data></Cell>
   </Row>`;

            const sortedLedger = [...data.ledger].sort((a,b) => new Date(a.date) - new Date(b.date));
            sortedLedger.forEach(item => {
                let pm = item.paymentMethod === 'card' ? '카드' : item.paymentMethod === 'cash' ? '현금' : item.paymentMethod === 'transfer' ? '이체' : '-';
                let amtStyle = item.type === '매출' ? 'TblCellMoney' : 'TblRedMoney';
                xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="String">${item.date}</Data></Cell>
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="String">${item.type}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.category)}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.targetName || '-')}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.itemName || '-')}</Data></Cell>
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="String">${pm}</Data></Cell>
    <Cell ss:StyleID="${amtStyle}"><Data ss:Type="Number">${item.amount}</Data></Cell>
   </Row>`;
            });
        } else {
            // ==========================================
            // [Modern Report: 통합 요약 보고서 대시보드 양식]
            // ==========================================
            xml += `
   <Column ss:Width="130"/><Column ss:Width="100"/><Column ss:Width="130"/><Column ss:Width="100"/>
   <Row ss:Height="35"><Cell ss:MergeAcross="3" ss:StyleID="Title"><Data ss:Type="String">매출 통계 요약 보고서</Data></Cell></Row>
   <Row ss:Height="20"><Cell ss:MergeAcross="3" ss:StyleID="SubTitle"><Data ss:Type="String">분석 기간: ${data.period}</Data></Cell></Row>
   
   <Row ss:Index="4" ss:Height="45">
    <Cell ss:StyleID="NetProfitBox"><Data ss:Type="String">실질 운영 순수익</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="NetProfitBox"><Data ss:Type="Number">${data.netProfit}</Data></Cell>
   </Row>
   <Row ss:Height="15"><Cell ss:MergeAcross="3" ss:StyleID="SubTitle"><Data ss:Type="String">* 총 매출에서 매입가, 부가세, 카드수수료를 차감한 금액</Data></Cell></Row>

   <Row ss:Index="7" ss:Height="22"><Cell ss:MergeAcross="3" ss:StyleID="BoxTitle"><Data ss:Type="String">  매출 및 정산 현황</Data></Cell></Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">총 매출액 (+)</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="Number">${data.totalRev}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">총 매입액 (-)</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="Number">${data.partsCost}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">예상 부가세 (-)</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="Number">${data.vat}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">카드 수수료 (-)</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="Number">${data.cardFee}</Data></Cell>
   </Row>

   <Row ss:Index="11" ss:Height="22"><Cell ss:MergeAcross="3" ss:StyleID="BoxTitle"><Data ss:Type="String">  결제 수단 상세 분석</Data></Cell></Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">카드 결제 합계</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${data.payStats.card.count}건 (${data.payStats.card.amount.toLocaleString()}원)</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">현금 결제 합계</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${data.payStats.cash.count}건 (${data.payStats.cash.amount.toLocaleString()}원)</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">계좌 이체 합계</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${data.payStats.transfer.count}건 (${data.payStats.transfer.amount.toLocaleString()}원)</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">전체 서비스 건수</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${data.asCount + data.pcCount}건</Data></Cell>
   </Row>

   <Row ss:Index="15" ss:Height="22"><Cell ss:MergeAcross="3" ss:StyleID="BoxTitle"><Data ss:Type="String">  고객 유입 경로 분석 (Inbound Route)</Data></Cell></Row>`;
            
            // 유입 경로 동적 생성 (2열씩 배치)
            const routes = Object.entries(data.routeStats);
            for(let i=0; i<routes.length; i+=2) {
                const r1 = routes[i];
                const r2 = routes[i+1];
                xml += `
   <Row ss:Height="22">
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">${escapeXml(r1[0])}</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${r1[1]}건</Data></Cell>
    ${r2 ? `<Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">${escapeXml(r2[0])}</Data></Cell><Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${r2[1]}건</Data></Cell>` : '<Cell ss:MergeAcross="1" ss:StyleID="SummaryValue"><Data ss:Type="String">-</Data></Cell>'}
   </Row>`;
            }

            xml += `
   <Row ss:Height="22"><Cell ss:MergeAcross="3" ss:StyleID="BoxTitle"><Data ss:Type="String">  주요 매출 내역 요약</Data></Cell></Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">날짜</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">카테고리</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">고객/상호명</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">금액</Data></Cell>
   </Row>`;
            
            // 상위 10개 매출만 요약 표시
            const topLedger = data.ledger.filter(i => i.type === '매출').slice(0, 10);
            topLedger.forEach(item => {
                xml += `
   <Row ss:Height="18">
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="String">${item.date}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${item.category}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${item.targetName || '-'}</Data></Cell>
    <Cell ss:StyleID="TblCellMoney"><Data ss:Type="Number">${item.amount}</Data></Cell>
   </Row>`;
            });
        }

        xml += `
  </Table>
 </Worksheet>
</Workbook>`;

        ipc.invoke('save-excel', { 
            content: xml, 
            filename: filename 
        }).then(result => {
            if(result && result.success) {
                setTimeout(() => { window.showAlert('엑셀 파일 내보내기가 완료되었습니다.'); }, 150);
            }
        }).catch(err => {
            console.error('Excel Export Error:', err);
            try {
                const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url; link.download = filename;
                link.click();
            } catch (e) {}
        });
    }

    function getReportData(type) {
        const now = new Date();
        const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let start, end;

        if(type === 'daily') {
            const today = formatDate(now);
            start = today; end = today;
        } else if(type === 'weekly') {
            const d = new Date(); d.setDate(now.getDate() - 6);
            start = formatDate(d); end = formatDate(now);
        } else if(type === 'custom') {
            start = document.getElementById('stat-report-start-date').value || formatDate(now);
            end = document.getElementById('stat-report-end-date').value || formatDate(now);
        } else {
            start = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
            end = formatDate(now);
        }

        const stats = {
            totalRev: 0, asRev: 0, pcRev: 0, totalCard: 0, partsCost: 0,
            asCount: 0, pcCount: 0, routeStats: {}, ledger: [],
            period: (start === end) ? start : `${start} ~ ${end}`,
            payStats: {
                card: { count: 0, amount: 0 },
                cash: { count: 0, amount: 0 },
                transfer: { count: 0, amount: 0 }
            }
        };

        const isDateInRange = (d) => d >= start && d <= end;

        window.ledgerDataList.forEach(item => {
            if(!isDateInRange(item.date)) return;
            const amt = parseInt(item.amount) || 0;
            if(item.type === '매출') {
                stats.totalRev += amt;
                const asGroup = ['AS', '업그레이드', '조립대행', 'AS수리'];
                const pcGroup = ['PC 판매', '부품 판매', 'PC판매'];
                if (asGroup.includes(item.category)) { stats.asRev += amt; stats.asCount++; }
                else if (pcGroup.includes(item.category)) { stats.pcRev += amt; stats.pcCount++; }
                if (item.paymentMethod === 'card') stats.totalCard += amt;
                
                // 결제 수단별 집계
                const pm = item.paymentMethod || 'card';
                if(stats.payStats[pm]) {
                    stats.payStats[pm].count++;
                    stats.payStats[pm].amount += amt;
                }

                let route = '내방';
                try {
                    const cust = window.customerDataList.find(c => c.name === item.targetName);
                    if(cust && cust.route) route = cust.route;
                } catch(e){}
                stats.routeStats[route] = (stats.routeStats[route] || 0) + 1;
            } else {
                stats.partsCost += amt;
            }
            stats.ledger.push(item);
        });

        // 세무 로직 정밀화 (매출세액 - 매입세액)
        const revVat = Math.floor(stats.totalRev / 11);
        const buyVat = Math.floor(stats.partsCost / 11);
        stats.vat = revVat - buyVat; // 납부 또는 환급액
        
        stats.cardFee = Math.floor(stats.totalCard * 0.012);
        
        // 순이익 = (매출공급가 - 매입공급가 - 카드수수료)
        const revSupply = stats.totalRev - revVat;
        const buySupply = stats.partsCost - buyVat;
        stats.netProfit = revSupply - buySupply - stats.cardFee;
        
        // 카테고리별 요약 집계 (매출 등록 시 기준 6항목으로 표준화)
        const stdCats = ['AS', '업그레이드', '조립대행', 'PC 판매', '부품 판매', '기타'];
        const catMap = {};
        stdCats.forEach(c => catMap[c] = { count: 0, amount: 0 });

        stats.ledger.forEach(item => {
            if(item.type !== '매출') return;
            
            // 명칭 표준화 매핑
            let c = item.category;
            if (c === 'AS수리') c = 'AS';
            else if (c === 'PC판매') c = 'PC 판매';
            else if (c === '부품판매') c = '부품 판매';
            
            // 표준 카테고리에 없으면 '기타'로 분류
            if (!stdCats.includes(c)) c = '기타';
            
            catMap[c].count++;
            catMap[c].amount += parseInt(item.amount) || 0;
        });
        
        // 데이터가 있는 항목만 추출하여 요약 생성
        stats.categorySummary = stdCats
            .map(name => ({ name, ...catMap[name] }))
            .filter(c => c.count > 0);
        
        // 주요 거래 (금액순 상위 3건)
        stats.topTransactions = [...stats.ledger]
            .filter(x => x.type === '매출')
            .sort((a,b) => (parseInt(b.amount)||0) - (parseInt(a.amount)||0))
            .slice(0, 3);

        // 주요 매입 (금액순 상위 3건)
        stats.topPurchases = [...stats.ledger]
            .filter(x => x.type === '매입')
            .sort((a,b) => (parseInt(b.amount)||0) - (parseInt(a.amount)||0))
            .slice(0, 3);

        stats.ledger.sort((a,b) => new Date(b.date) - new Date(a.date));

        return stats;
    }

    function renderModernReport(data, type) {
        const shop = window.shopSettings || {};
        const typeLabels = { 
            daily: '일일 매출 보고서', 
            weekly: '주간 매출 보고서', 
            monthly: '월간 매출 보고서',
            custom: '지정 기간 매출 보고서'
        };
        
        document.getElementById('tpl-report-title').textContent = typeLabels[type];
        document.getElementById('tpl-report-period').textContent = data.period;
        document.getElementById('tpl-report-shop-name').textContent = shop.shopName || '매장 정보 없음';
        document.getElementById('tpl-report-shop-tel').textContent = '연락처: ' + (shop.tel || '-');
        
        document.getElementById('tpl-report-total-rev').textContent = '+' + data.totalRev.toLocaleString() + '원';
        document.getElementById('tpl-report-total-buy').textContent = '-' + data.partsCost.toLocaleString() + '원';
        document.getElementById('tpl-report-net-profit').textContent = data.netProfit.toLocaleString() + '원';
        
        const totalTaxFee = data.vat + data.cardFee;
        const taxFeeSign = totalTaxFee >= 0 ? '-' : '+';
        const taxFeeLabel = totalTaxFee >= 0 ? '세금 및 수수료 (-)' : '세금 환급 및 수수료 (+)';
        
        const taxFeeEl = document.getElementById('tpl-report-total-tax-fee');
        const taxFeeLabelEl = document.getElementById('tpl-report-tax-fee-label');
        
        if(taxFeeEl) taxFeeEl.textContent = taxFeeSign + Math.abs(totalTaxFee).toLocaleString() + '원';
        if(taxFeeLabelEl) taxFeeLabelEl.textContent = taxFeeLabel;

        const vatEl = document.getElementById('tpl-report-vat');
        if(vatEl) vatEl.textContent = (data.vat >= 0 ? '' : '-') + Math.abs(data.vat).toLocaleString() + '원';

        const feeEl = document.getElementById('tpl-report-card-fee');
        if(feeEl) feeEl.textContent = data.cardFee.toLocaleString() + '원';

        // Payment Stats
        document.getElementById('tpl-report-pay-card-count').textContent = data.payStats.card.count + '건';
        document.getElementById('tpl-report-pay-card-amt').textContent = data.payStats.card.amount.toLocaleString() + '원';
        document.getElementById('tpl-report-pay-cash-count').textContent = data.payStats.cash.count + '건';
        document.getElementById('tpl-report-pay-cash-amt').textContent = data.payStats.cash.amount.toLocaleString() + '원';
        document.getElementById('tpl-report-pay-transfer-count').textContent = data.payStats.transfer.count + '건';
        document.getElementById('tpl-report-pay-transfer-amt').textContent = data.payStats.transfer.amount.toLocaleString() + '원';

        // Service Type List
        const serviceList = document.getElementById('tpl-report-service-list');
        const totalCount = data.asCount + data.pcCount || 1;
        serviceList.innerHTML = `
            ${renderProgressItem('AS 서비스', data.asCount, totalCount, '#0071e3', data.asRev)}
            ${renderProgressItem('PC/부품 판매', data.pcCount, totalCount, '#5e5e62', data.pcRev)}
        `;

        // Inbound Route List
        const routeList = document.getElementById('tpl-report-route-list');
        const totalRoutes = Object.values(data.routeStats).reduce((a,b)=>a+b, 0) || 1;
        const sortedRoutes = Object.entries(data.routeStats).sort((a,b)=>b[1]-a[1]);
        
        // 유입 경로 압축 로직: 상위 3개 노출 + 나머지 '기타' 합산
        let routeHtml = '';
        if (sortedRoutes.length > 0) {
            const top3 = sortedRoutes.slice(0, 3);
            routeHtml += top3.map(([name, count]) => renderProgressItem(name, count, totalRoutes, '#34c759')).join('');
            
            if (sortedRoutes.length > 3) {
                const othersCount = sortedRoutes.slice(3).reduce((acc, curr) => acc + curr[1], 0);
                routeHtml += renderProgressItem('기타(소수)', othersCount, totalRoutes, '#a2a2a6');
            }
        } else {
            routeHtml = '<div style="font-size:12px; color:#86868b; text-align:center; padding:10px;">데이터 없음</div>';
        }
        routeList.innerHTML = routeHtml;

        // History Table (Category Summary + Top 7 Transactions)
        const tbody = document.getElementById('tpl-report-history-tbody');
        let html = '';
        
        // 1. 카테고리별 요약 (소계)
        if(data.categorySummary.length > 0) {
            html += `
                <tr style="background:#f9f9fb;"><td colspan="5" style="padding:8px 10px; font-weight:800; color:var(--accent);">[ 항목별 매출 요약 ]</td></tr>
                ${data.categorySummary.map(c => `
                    <tr style="border-bottom:1px solid #f5f5f7;">
                        <td colspan="2" style="padding:8px 10px; font-weight:600;">${c.name}</td>
                        <td style="padding:8px 10px; color:#86868b;">총 ${c.count}건</td>
                        <td colspan="2" style="padding:8px 10px; text-align:right; font-weight:700; color:#000;">${c.amount.toLocaleString()}원</td>
                    </tr>
                `).join('')}
                <tr style="height:15px;"><td colspan="5"></td></tr>
            `;
        }

        // 2. 주요 개별 거래 (상위 3건)
        if(data.topTransactions.length > 0) {
            html += `
                <tr style="background:#f9f9fb;"><td colspan="5" style="padding:8px 10px; font-weight:800; color:#34c759;">[ 주요 개별 매출 내역 (금액순) ]</td></tr>
                ${data.topTransactions.map(item => `
                    <tr style="border-bottom:1px solid #f5f5f7;">
                        <td style="padding:8px 10px;">${item.date.slice(5)}</td>
                        <td style="padding:8px 10px; color:#86868b;">${item.category}</td>
                        <td style="padding:8px 10px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.targetName || '-'}</td>
                        <td style="padding:8px 10px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.itemName}</td>
                        <td style="padding:8px 10px; text-align:right; font-weight:700; color:#0071e3;">+${parseInt(item.amount).toLocaleString()}</td>
                    </tr>
                `).join('')}
            `;
        }

        tbody.innerHTML = html || '<tr><td colspan="5" style="padding:30px; text-align:center; color:#86868b;">해당 기간 내역 없음</td></tr>';

        // Purchase Table (Top 3)
        const pTbody = document.getElementById('tpl-report-purchase-tbody');
        pTbody.innerHTML = data.topPurchases.length ? data.topPurchases.map(item => `
            <tr style="border-bottom:1px solid #f5f5f7;">
                <td style="padding:10px;">${item.date.slice(5)}</td>
                <td style="padding:10px; color:#86868b;">${item.category}</td>
                <td style="padding:10px; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <span style="font-weight:700; color:#1d1d1f;">${item.targetName || '-'}</span>
                    <span style="font-size:10px; color:#86868b; margin-left:6px;">(${item.itemName})</span>
                </td>
                <td style="padding:10px; text-align:right; font-weight:700; color:#ff3b30;">-${parseInt(item.amount).toLocaleString()}</td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="padding:30px; text-align:center; color:#86868b;">해당 기간 매입 내역 없음</td></tr>';

        // Seal
        const sealDiv = document.getElementById('tpl-report-seal');
        sealDiv.innerHTML = shop.seal ? `<img src="${shop.seal}" style="width:100%; height:100%; object-fit:contain; opacity:0.8;">` : '';
    }

    function renderDetailReport(data, type) {
        const shop = window.shopSettings || {};
        const typeLabels = { 
            daily: '일일 상세 보고서', 
            weekly: '주간 상세 보고서', 
            monthly: '월간 상세 보고서',
            custom: '지정 기간 상세 보고서'
        };
        
        document.getElementById('tpl-detail-period').textContent = data.period;
        document.getElementById('tpl-detail-shop-name').textContent = shop.shopName || '매장 정보 없음';
        document.getElementById('tpl-detail-shop-tel').textContent = '연락처: ' + (shop.tel || '-');
        
        document.getElementById('tpl-detail-total-rev').textContent = '+' + data.totalRev.toLocaleString() + '원';
        document.getElementById('tpl-detail-total-buy').textContent = '-' + data.partsCost.toLocaleString() + '원';
        document.getElementById('tpl-detail-net-profit').textContent = data.netProfit.toLocaleString() + '원';
        
        // 결제 수단 통계 데이터 반영
        document.getElementById('tpl-detail-pay-card-count').textContent = data.payStats.card.count;
        document.getElementById('tpl-detail-pay-card-amt').textContent = data.payStats.card.amount.toLocaleString() + '원';
        document.getElementById('tpl-detail-pay-cash-count').textContent = (data.payStats.cash.count + data.payStats.transfer.count);
        document.getElementById('tpl-detail-pay-cash-amt').textContent = (data.payStats.cash.amount + data.payStats.transfer.amount).toLocaleString() + '원';

        document.getElementById('tpl-detail-as-count').textContent = data.asCount;
        document.getElementById('tpl-detail-pc-count').textContent = data.pcCount;

        // Detail History Table (Pure Chronological List)
        const tbody = document.getElementById('tpl-detail-history-tbody');
        // Sort by date ascending for a detailed report, or descending as requested. 
        // User asked for "쭉 시간별로 매출,매입 상세 항목들이 쭉 나열", usually chronological (ascending) is better for auditing.
        // But dashboard is descending. I'll use Ascending for the detail report.
        const sortedLedger = [...data.ledger].sort((a,b) => new Date(a.date) - new Date(b.date));
        
        tbody.innerHTML = sortedLedger.map(item => {
            const isSale = item.type === '매출';
            const color = isSale ? '#0071e3' : '#ff3b30';
            const sign = isSale ? '+' : '-';
            
            let paymentText = '-';
            if(item.paymentMethod === 'card') paymentText = '카드';
            else if(item.paymentMethod === 'cash') paymentText = '현금';
            else if(item.paymentMethod === 'transfer') paymentText = '이체';

            return `
                <tr style="border-bottom:1px solid #f5f5f7;">
                    <td style="padding:10px; color:#86868b;">${item.date.slice(5)}</td>
                    <td style="padding:10px;"><span style="color:${color}; font-weight:700;">${item.type}</span></td>
                    <td style="padding:10px; color:#1d1d1f;">${item.category}</td>
                    <td style="padding:10px; font-weight:600;">${item.targetName || '-'}</td>
                    <td style="padding:10px; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.itemName}</td>
                    <td style="padding:10px; text-align:center; color:#86868b;">${paymentText}</td>
                    <td style="padding:10px; text-align:right; font-weight:700; color:${color};">${sign}${parseInt(item.amount).toLocaleString()}</td>
                </tr>
            `;
        }).join('');

        // Seal
        const sealDiv = document.getElementById('tpl-detail-seal');
        sealDiv.innerHTML = shop.seal ? `<img src="${shop.seal}" style="width:100%; height:100%; object-fit:contain; opacity:0.8;">` : '';
    }

    function renderProgressItem(label, count, total, color, revenue) {
        const pct = Math.round((count/total)*100);
        return `
            <div style="font-size:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:600;">
                    <span>${label}</span>
                    <span>${count}건 (${pct}%) ${revenue ? '| ' + revenue.toLocaleString() + '원' : ''}</span>
                </div>
                <div style="height:6px; background:#f5f5f7; border-radius:3px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${color}; border-radius:3px;"></div>
                </div>
            </div>
        `;
    }

})();
