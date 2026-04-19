// [Security & Initial Display Logic]
// All functions are global to ensure stability

const TRIAL_DAYS = 30;
const APP_SALT = "PC_ADMIN_KEY_SALT"; 
const RESET_SALT = "PC_PASSWORD_RESET_SALT_2026"; 

// Helper: Secure Alert
async function safeAlert(msg) {
    if(window.showAlert) await window.showAlert(msg);
    else alert(msg);
}

// Helper: Secure Confirm
async function safeConfirm(msg) {
    if(window.showConfirm) return await window.showConfirm(msg);
    return confirm(msg);
}

function getSystemID() {
    let sid = window.DB.get('PC_SystemID');
    if (!sid) {
        sid = Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + 
              Math.random().toString(36).substring(2, 6).toUpperCase();
        window.DB.set('PC_SystemID', sid);
    }
    return sid;
}

function verifyKey(sid, key) {
    if (!sid || !key) return false;
    try {
        let hash = 0;
        const combined = sid + APP_SALT;
        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash |= 0;
        }
        const hstr1 = Math.abs(hash).toString(36);
        const hstr2 = Math.abs(hash * 31).toString(36);
        const expected = (hstr1 + hstr2).toUpperCase().substring(0, 8);
        const match = expected.match(/.{4}/g);
        if (!match) return false;
        return key.trim().toUpperCase() === match.join('-');
    } catch (e) { return false; }
}

function verifyResetKey(sid, inputCode) {
    if (!sid || !inputCode) return false;
    try {
        let hash = 0;
        const combined = sid + RESET_SALT;
        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash |= 0;
        }
        const hstr = Math.abs(hash * 97).toString(36).toUpperCase();
        return inputCode.trim().toUpperCase() === hstr.substring(0, 10);
    } catch (e) { return false; }
}

function checkLicenseStatus() {
    const isActivated = window.DB.get('PC_IsActivated') === 'true';
    const licenseKey = window.DB.get('PC_LicenseKey');
    const systemId = getSystemID();

    if (isActivated && licenseKey && verifyKey(systemId, licenseKey)) {
        return { isValid: true, type: 'activated' };
    }

    let installDate = window.DB.get('PC_InstallDate');
    let lastSeenDate = window.DB.get('PC_LastSeenDate') || installDate;
    const now = Date.now();

    if (installDate && now < Number(lastSeenDate)) return { isValid: false, type: 'manipulated' };
    window.DB.set('PC_LastSeenDate', now);

    if (!installDate) {
        installDate = now;
        window.DB.set('PC_InstallDate', installDate);
    }
    
    installDate = Number(installDate); // 반드시 숫자로 변환 (문자열 결합 방지)
    const totalTrialMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const remainingMs = (installDate + totalTrialMs) - now;
    
    if (remainingMs > 0) {
        const daysLeft = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return { isValid: true, type: 'trial', daysLeft, hoursLeft, remainingMs };
    }
    return { isValid: false, type: 'expired', remainingMs: 0 };
}

window.initAuth = () => {
    console.log("initAuth Execution Started");
    const licStatus = checkLicenseStatus();
    const masterPw = window.DB.get('PC_MasterPassword');

    const setupView = document.getElementById('setup-view');
    const loginView = document.getElementById('login-view');
    const licView = document.getElementById('lic-view');
    const authOverlay = document.getElementById('auth-overlay');
    const appLayout = document.getElementById('app-layout');
    
    // [CRITICAL] 보안을 위해 초기 로딩 시 앱 화면을 강제로 숨김
    if(appLayout) appLayout.style.display = 'none';
    if(authOverlay) authOverlay.style.display = 'flex';

    // [CRITICAL] 중복 노출 방지를 위해 모든 뷰 초기화
    if(setupView) setupView.style.display = 'none';
    if(loginView) loginView.style.display = 'none';
    if(licView) licView.style.display = 'none';

    // [CRITICAL FIX] 고정 레이어 순위 및 표시 설정 강화
    if(authOverlay) {
        authOverlay.style.zIndex = '1000000';
        authOverlay.style.pointerEvents = 'auto';
    }
    
    updateSettingsLicenseUI(licStatus);
    startBackgroundLicenseCheck();

    if (!licStatus.isValid) {
        // 만료 시 라이선스 뷰만 노출
        if(licView) licView.style.display = 'block';
        // [FIX] 만료 시에는 닫기(X) 버튼을 숨겨서 우회 차단
        const btnClose = document.getElementById('btn-close-lic-view');
        if(btnClose) btnClose.style.display = 'none';
        
        const sidInput = document.getElementById('lic-system-id');
        if(sidInput) sidInput.value = getSystemID();
    } else if (masterPw) {
        // 암호 설정 시 로그인 뷰만 노출
        if(loginView) loginView.style.display = 'block';
        initializeAuthBranding();
    } else {
        // [FIX] 암호가 없는 경우 초기 설정 화면 노출
        if(setupView) setupView.style.display = 'block';
    }

    // [New] 모든 검증 시점이 끝나면 레이어를 즉시 표시 (지연 제거 핵심)
    if (authOverlay) {
        authOverlay.style.display = 'flex';
        console.log("Auth UI Displayed Instantly");
    }

    // [New] Voluntary Activation Modal Logic
    const btnOpenActivation = document.getElementById('btn-open-activation');
    if(btnOpenActivation) {
        btnOpenActivation.onclick = () => {
            // Hide other views within auth-overlay to prevent duplication
            if(setupView) setupView.style.display = 'none';
            if(loginView) loginView.style.display = 'none';
            
            if(licView) {
                const title = licView.querySelector('h2');
                const msg = document.getElementById('lic-status-msg');
                if(title) title.textContent = '정품 인증';
                if(msg) msg.innerHTML = '발급받으신 제품 인증키를 입력하여<br>영구 라이선스로 전환해 주세요.';
                
                // [FIX] 기기 고유 식별코드 주입
                const sidInput = document.getElementById('lic-system-id');
                if(sidInput) sidInput.value = getSystemID();
                
                licView.style.display = 'block';
            }
            if(authOverlay) {
                authOverlay.style.background = 'rgba(0,0,0,0.85)'; // Darken overlay
                authOverlay.style.display = 'flex';
                authOverlay.style.zIndex = '50000'; // Make sure it sits on top of settings
            }
        };
    }

    const btnCloseLic = document.getElementById('btn-close-lic-view');
    if(btnCloseLic) {
        btnCloseLic.onclick = () => {
            if(authOverlay) authOverlay.style.display = 'none';
        };
    }

    // --- Buttons Event Binding ---
    const btnLogin = document.getElementById('btn-login');
    if(btnLogin) btnLogin.onclick = () => {
        const input = document.getElementById('login-pw');
        if(input.value === window.DB.get('PC_MasterPassword')) {
            // 1. 보안을 위해 입력값을 즉시 비움
            input.value = '';

            // 2. [흰 화면 방지 핵심] 앱 화면을 배경에 먼저 'flex'로 깔아둠 (아직 로그인 창에 가려져 있음)
            if(appLayout) appLayout.style.display = 'flex';

            // 3. 브라우저가 앱 화면을 뒤에 그릴 시간을 확보한 뒤 로그인 창을 즉시 걷어냄
            setTimeout(() => {
                if(authOverlay) authOverlay.style.display = 'none';
                
                // 4. [데이터 로드] 대시보드만 즉시 로드 (최적화되어 매우 빠름)
                if(window.ipcRenderer) window.ipcRenderer.send('manual-update-check');
                if(typeof window.performInitialDataLoad === 'function') window.performInitialDataLoad();
                console.log("Login transition verified and completed.");
            }, 0);
        } else {
            input.value = '';
            input.placeholder = '암호 오류';
            setTimeout(() => { input.placeholder = '••••••••'; }, 1000);
        }
    };

    const btnSetup = document.getElementById('btn-setup');
    if(btnSetup) btnSetup.onclick = async () => {
        const pw = document.getElementById('setup-pw').value;
        const confirm = document.getElementById('setup-pw-confirm').value;
        if(pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
            await safeAlert('8자 이상의 영문+숫자 조합 필수');
            return;
        }
        if(pw !== confirm) {
            await safeAlert('비밀번호 불일치');
            return;
        }
        window.DB.set('PC_MasterPassword', pw);
        
        // [Premium] 새로고침 대신 부드러운 전환 효과 적용
        if(authOverlay) {
            authOverlay.classList.add('fade-out');
            setTimeout(() => {
                authOverlay.style.display = 'none';
                if(appLayout) appLayout.style.display = 'flex';
                // [FIX] 암호 설정 후 초기 데이터 로드 및 업데이트 체크 실행
                if(window.ipcRenderer) window.ipcRenderer.send('manual-update-check');
                if(typeof window.performInitialDataLoad === 'function') window.performInitialDataLoad();
            }, 500);
        }
    };

    const btnForgot = document.getElementById('btn-forgot-pw');
    if(btnForgot) btnForgot.onclick = () => {
        document.getElementById('login-form-area').style.display = 'none';
        document.getElementById('recovery-form-area').style.display = 'block';
        document.getElementById('recovery-sys-id').textContent = getSystemID();
    };

    const btnRecovery = document.getElementById('btn-use-recovery');
    if(btnRecovery) btnRecovery.onclick = async () => {
        const key = document.getElementById('recovery-key-input').value.trim().toUpperCase();
        if(verifyResetKey(getSystemID(), key)) {
            const ok = await safeConfirm('인증 성공! 초기화하시겠습니까?');
            if(ok) {
                window.DB.remove('PC_MasterPassword');
                location.reload();
            }
        } else {
            await safeAlert('잘못된 코드입니다.');
        }
    };

    const btnBack = document.getElementById('btn-back-to-login');
    if(btnBack) btnBack.onclick = () => {
        document.getElementById('login-form-area').style.display = 'block';
        document.getElementById('recovery-form-area').style.display = 'none';
    };

    // New: Show Support from Recovery Screen
    const btnShowSupportRec = document.getElementById('btn-show-support-recovery');
    if(btnShowSupportRec) btnShowSupportRec.onclick = () => {
        const supportModal = document.getElementById('modal-support-info');
        if(supportModal) supportModal.style.display = 'flex';
    };

    // Close Support Modal
    const btnCloseSupport = document.getElementById('btn-close-support-info');
    if(btnCloseSupport) btnCloseSupport.onclick = () => {
        const supportModal = document.getElementById('modal-support-info');
        if(supportModal) supportModal.style.display = 'none';
    };

    const btnActivate = document.getElementById('btn-activate-product');
    if(btnActivate) btnActivate.onclick = async () => {
        const key = document.getElementById('lic-key-input').value.trim();
        if(verifyKey(getSystemID(), key)) {
            window.DB.set('PC_IsActivated', 'true');
            window.DB.set('PC_LicenseKey', key);
            await safeAlert('인증 완료! 재시작합니다.');
            location.reload();
        } else {
            await safeAlert('인증 실패');
        }
    };

    // [FIX] 인증창 내 담당자 연락처 보기 버튼 기능 연결
    const btnContactLic = document.getElementById('btn-contact-lic');
    if(btnContactLic) {
        btnContactLic.onclick = () => {
            const supportModal = document.getElementById('modal-support-info');
            if(supportModal) supportModal.style.display = 'flex';
        };
    }

    // [FIX] 기기 고유 식별코드 복사 기능 추가
    const btnCopySysId = document.getElementById('btn-copy-sysid');
    if(btnCopySysId) {
        btnCopySysId.onclick = (e) => {
            if(e) { e.preventDefault(); e.stopPropagation(); }
            console.log("Copy button clicked - Execution started");
            
            const sidInput = document.getElementById('lic-system-id');
            if(sidInput && sidInput.value) {
                navigator.clipboard.writeText(sidInput.value).then(() => {
                    console.log("Clipboard copy successful");
                    if(window.showToast) {
                        window.showToast('기기 고유 식별코드가 복사되었습니다.', 'success');
                    } else {
                        alert('복사되었습니다.');
                    }
                }).catch(err => {
                    console.error('Copy failed:', err);
                });
            }
        };
    }
};

let hasShownWarning = false;

function startBackgroundLicenseCheck() {
    // 실시간성 향상을 위해 10초마다 체크 (기존 10분)
    setInterval(() => {
        const licStatus = checkLicenseStatus();
        updateSettingsLicenseUI(licStatus);
        
        const authOverlay = document.getElementById('auth-overlay');
        const computedDisplay = window.getComputedStyle(authOverlay).display;
        const isOverlayVisible = authOverlay && computedDisplay !== 'none';
        
        if (licStatus.isValid && licStatus.type === 'trial') {
            // 만료 1분(60,000ms) 미만일 때 경고 (현재 인증화면이 열려있지 않을 때만)
            if (licStatus.remainingMs < 60000 && !hasShownWarning && !isOverlayVisible) {
                hasShownWarning = true;
                safeAlert("⚠️ 체험판 만료가 1분 미만 남았습니다.\n진행 중인 모든 작업을 저장하고 정품 인증을 준비해 주세요.")
                .then(() => {
                    const input = document.getElementById('lic-key-input');
                    if(input) input.focus();
                });
            }
        } 
        else if (!licStatus.isValid) {
            // 이미 만료되었는데 인증 화면이 떠 있지 않은 경우에만 알림 후 리로드
            if (!isOverlayVisible) {
                safeAlert('🔴 라이선스가 만료되었습니다. 보안을 위해 초기 화면으로 이동합니다.')
                .then(() => {
                    location.reload();
                });
            }
        }
    }, 10000);
}

function updateSettingsLicenseUI(status) {
    const statusText = document.getElementById('st-lic-status');
    const badge = document.getElementById('st-lic-badge');
    const activateArea = document.getElementById('div-activate-btn-area');
    const infoArea = document.getElementById('div-license-info-area');
    const keyDisplay = document.getElementById('st-lic-key-display');

    if (!statusText || !badge) return;

    if (status.type === 'activated') {
        statusText.textContent = '정품 인증 완료 (영구 라이선스)';
        badge.style.background = 'rgba(52, 199, 89, 0.1)';
        badge.style.color = '#34c759';
        badge.textContent = '인증됨';
        if(activateArea) activateArea.style.display = 'none';
        if(infoArea) {
            infoArea.style.display = 'block';
            if(keyDisplay) keyDisplay.textContent = window.DB.get('PC_LicenseKey') || '기본 인증';
        }
    } else if (status.type === 'trial') {
        const timeStr = `${status.daysLeft}일 ${status.hoursLeft}시간`;
        statusText.innerHTML = `<span style="font-size:15px; font-weight:700; color:var(--text-color);">남은 체험 기간: <span style="color:#ff3b30; font-size:17px;">${timeStr}</span></span>`;
        badge.style.background = 'rgba(255, 159, 10, 0.1)';
        badge.style.color = '#ff9f0a';
        badge.textContent = '미인증';
        if(activateArea) activateArea.style.display = 'block';
        if(infoArea) infoArea.style.display = 'none';
    } else {
        statusText.textContent = '라이선스가 만료되었습니다.';
        badge.style.background = 'rgba(255, 59, 48, 0.1)';
        badge.style.color = '#ff3b30';
        badge.textContent = '만료됨';
        if(activateArea) activateArea.style.display = 'block';
        if(infoArea) infoArea.style.display = 'none';
    }
}

function initializeAuthBranding() {
    const savedLogo = window.DB.get('PC_ShopLogo');
    const savedName = window.DB.get('PC_ShopName');
    const logoImg = document.getElementById('auth-logo-img');
    const nameText = document.getElementById('auth-shop-name');
    const defHeader = document.getElementById('login-default-header');
    const shopHeader = document.getElementById('login-shop-header');

    if (savedLogo) {
        if(defHeader) defHeader.style.display = 'none';
        if(shopHeader) shopHeader.style.display = 'flex';
        if(logoImg) logoImg.src = savedLogo;
        if(nameText) nameText.textContent = savedName || 'PCSHOP';
    }
}
