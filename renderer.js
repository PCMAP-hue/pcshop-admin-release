/**
 * renderer.js - Entry Point for PCSHOP Management System
 * 
 * 모든 로직은 js/ 폴더의 각 모듈로 분리되었습니다.
 * 이 파일은 앱 초기화 및 전역적인 이벤트 연결만 담당합니다.
 */

window.addEventListener('DOMContentLoaded', async () => {
    console.log('PCSHOP Renderer Initializing...');

    // Get and Display App Version
    try {
        const version = await ipcRenderer.invoke('get-app-version');
        const titleVersion = document.getElementById('app-version-display');
        const settingsVersion = document.getElementById('settings-app-version');
        
        if (titleVersion) titleVersion.innerText = `v${version}`;
        if (settingsVersion) settingsVersion.innerText = `v${version}`;
        console.log(`Current App Version: ${version}`);
    } catch (err) {
        console.error('Failed to get app version:', err);
    }

    // 1. 보안/인증 레이어 초기화 (즉시 실행하여 지연 제거)
    if(typeof window.initAuth === 'function') {
        window.initAuth();
    }

    // 2. 앱 코어 및 네비게이션 초기화
    if(typeof window.initApp === 'function') {
        window.initApp();
    }

    // [New] 데이터 로드 및 초기 렌더링 통합 함수 (인증 성공 후 호출됨)
    window.performInitialDataLoad = () => {
        console.log('Optimized loading: Dashboard priority mode.');
        try {
            // 1. 데이터 파싱 (필요한 데이터만 메모리에 로드)
            [window.loadCustomerData, window.loadVendorData, window.loadStockData, 
             window.loadLedgerData, window.loadAsData, window.loadQuoteData, 
             window.loadPcSalesData, window.loadShopSettings].forEach(fn => {
                if(typeof fn === 'function') fn();
            });

            // 2. 대시보드 위젯 및 리스트만 즉시 업데이트 (사용자가 바로 보는 화면)
            if(typeof window.updateDashboardWidgets === 'function') {
                window.updateDashboardWidgets();
            }

            // 3. 무거운 전체 목록 렌더링은 루프를 돌지 않도록 지연 처리
            // 각 탭 클릭 시 렌더링하도록 유도하거나, 아주 작은 단위로 백그라운드 처리
            setTimeout(() => {
                if(typeof lucide !== 'undefined') lucide.createIcons();
            }, 100);

        } catch (e) {
            console.error('Initial load failed:', e);
        }
    };

    // 전역 아이콘 생성 (Lucide)
    if(typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// ============================================================
// Auto-Update UI Logic
// ============================================================

const updateModal = document.getElementById('update-modal');
const updateStartBtn = document.getElementById('update-start-btn');
const updateCancelBtn = document.getElementById('update-cancel-btn');
const updateNotes = document.getElementById('update-notes');
const updateVersionTag = document.getElementById('update-version-tag');
const updateProgressContainer = document.getElementById('update-progress-container');
const updateProgressFill = document.getElementById('update-progress-fill');
const updatePercent = document.getElementById('update-percent');

// 업데이트 확인 상태 추적 (수동 확인인지 여부)
let isManualUpdateCheck = false;

// 업데이트가 가능할 때
window.ipcRenderer.on('update-available', (event, info) => {
    // 공통 정보 업데이트
    updateVersionTag.innerText = `Ver ${info.version}`;
    if (info.releaseNotes) {
        updateNotes.innerHTML = info.releaseNotes.replace(/\n/g, '<br>');
    } else {
        updateNotes.innerHTML = '<li>시스템 성능 및 안정성 향상을 위한 패치가 포함되어 있습니다.</li><li>보안 취약점 수정 및 데이터베이스 최적화</li>';
    }

    // [개선] 수동 확인 시에는 배너 대신 즉시 모달(상세 창) 노출
    if (isManualUpdateCheck) {
        // 배너가 혹시라도 떠 있다면 강제로 숨김
        const banner = document.getElementById('top-update-banner');
        if (banner) banner.style.display = 'none';

        updateModal.style.display = 'flex';
        // 버튼 상태 복구
        if (btnManualUpdate) {
            btnManualUpdate.disabled = false;
            btnManualUpdate.innerText = '업데이트 확인';
        }
        isManualUpdateCheck = false; // 플래그 초기화
    } else {
        // 자동 확인 시에는 기존처럼 상단 배너 노출
        const banner = document.getElementById('top-update-banner');
        if (banner) {
            banner.style.display = 'block';
        }
    }
});

// 배너의 업데이트 버튼 클릭 시 상세 모달 표시
const btnBannerUpdate = document.getElementById('btn-banner-update-start');
if (btnBannerUpdate) {
    btnBannerUpdate.onclick = () => {
        updateModal.style.display = 'flex';
    };
}

// 배너 닫기 버튼
const btnBannerClose = document.getElementById('btn-banner-close');
if (btnBannerClose) {
    btnBannerClose.onclick = () => {
        document.getElementById('top-update-banner').style.display = 'none';
    };
}

// 기급 업데이트 버튼 클릭 시
updateStartBtn.addEventListener('click', () => {
    if (updateStartBtn.innerText.includes('지금 즉시 업데이트')) {
        // 다운로드 시작 신호
        window.ipcRenderer.send('start-download');
        updateStartBtn.disabled = true;
        updateStartBtn.style.opacity = '0.5';
        updateStartBtn.querySelector('.btn-text').innerText = '지침에 따라 대기 중...';
        updateCancelBtn.style.display = 'none'; // 취소 불가
        updateProgressContainer.style.display = 'block';
    } else if (updateStartBtn.innerText.includes('설치 및 재시작')) {
        // 설치 및 재시작 신호
        window.ipcRenderer.send('install-update');
    }
});

// 수동 업데이트 확인 버튼
const btnManualUpdate = document.getElementById('btn-manual-update-check');
if (btnManualUpdate) {
    btnManualUpdate.onclick = () => {
        // [강제 조치] 수동 확인 시에는 기존에 배너가 떠 있다면 즉시 숨깁니다.
        const banner = document.getElementById('top-update-banner');
        if (banner) banner.style.display = 'none';

        isManualUpdateCheck = true; // 수동 확인 시작표시
        btnManualUpdate.disabled = true;
        btnManualUpdate.innerText = '확인 중...';
        window.ipcRenderer.send('manual-update-check');
    };
}

// 업데이트가 없을 때
window.ipcRenderer.on('update-not-available', () => {
    if (btnManualUpdate) {
        btnManualUpdate.disabled = false;
        btnManualUpdate.innerText = '업데이트 확인';
    }
    if (typeof window.showToast === 'function') {
        window.showToast('현재 최신 버전을 사용 중입니다.', 'info');
    }
});

// 업데이트 체크 중 에러 발생 시
window.ipcRenderer.on('update-error', (event, message) => {
    if (btnManualUpdate) {
        btnManualUpdate.disabled = false;
        btnManualUpdate.innerText = '업데이트 확인';
    }
    console.error('Update Check Error:', message);
    if (typeof window.showToast === 'function') {
        window.showToast('업데이트 확인 중 오류가 발생했습니다.', 'error');
    }
});

// 나중에 하기 클릭 시
updateCancelBtn.addEventListener('click', () => {
    updateModal.style.display = 'none';
});

// 다운로드 진행률 업데이트
window.ipcRenderer.on('update-progress', (event, percent) => {
    const p = Math.floor(percent);
    updateProgressFill.style.width = `${p}%`;
    updatePercent.innerText = `${p}%`;
});

// 다운로드 완료 시
window.ipcRenderer.on('update-downloaded', () => {
    updateStartBtn.disabled = false;
    updateStartBtn.style.opacity = '1';
    updateStartBtn.classList.add('success');
    updateStartBtn.querySelector('.btn-text').innerText = '설치 및 재시작';
    
    updatePercent.innerText = '준비 완료';
    updateProgressFill.style.background = 'linear-gradient(90deg, #34c759, #32ade6)';
    
    // 강제 안내
    updateNotes.innerHTML = '<div style="color:#34c759; font-weight:700; text-align:center; padding:10px;">패치 파일 준비가 완료되었습니다.<br>지금 재시작하여 적용하세요!</div>';
});

