/**
 * Native PDF Generation Utility for PCSHOP
 * 
 * [V5 - Engine Replacement]
 * iframe.contentWindow.print() 방식을 완전히 폐기하고,
 * Electron의 webContents.printToPDF() 네이티브 API를 사용합니다.
 * 
 * 이 방식을 사용하면 Chromium PDF 엔진이 텍스트를 100% 벡터 데이터로 보존하여
 * 생성된 PDF에서 텍스트 드래그(선택), 복사, 검색이 완벽하게 지원됩니다.
 */

// utils.js와의 전역변수 충돌(SyntaxError)을 피하기 위해 별도 이름 사용
const ipcPrint = typeof window !== 'undefined' && window.ipc ? window.ipc : require('electron').ipcRenderer;

// 중복 호출 방지 가드
let isPrinting = false;

window.isolatedPrint = async function(elementId, customTitle) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // 이미 인쇄 중이면 무시
    if (isPrinting) {
        if (typeof showAlert === 'function') showAlert('PDF 생성이 이미 진행 중입니다.');
        return;
    }
    isPrinting = true;
    if (typeof window.showLoading === 'function') {
        window.showLoading('PDF 생성 및 저장창 준비 중입니다...');
    }

    try {
        // 1. 인쇄 전용 CSS (자체 포함형 - 외부 style.css 참조 없음)
        const printCSS = `
            @page {
                margin: 0;
                size: A4;
            }

            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                padding: 0;
                width: 210mm;
                min-height: 297mm;
                background: white;
                color: #1d1d1f;
                font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                line-height: 1.4;
            }

            /* outerHTML로 복사 시 원본 위치/표시 속성 덮어쓰기 */
            #${elementId} {
                display: block !important;
                visibility: visible !important;
                position: static !important;
                left: auto !important;
                top: auto !important;
                z-index: auto !important;
            }

            table {
                border-collapse: collapse;
            }

            img {
                max-width: 100%;
            }
        `;

        // 2. 완전 자체 포함형 HTML 문서 생성
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${customTitle || 'PCSHOP_Print'}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
    <style>${printCSS}</style>
</head>
<body>
    ${element.outerHTML}
</body>
</html>`;

        // 3. 메인 프로세스에 PDF 생성 요청 (IPC 통신)
        const result = await ipcPrint.invoke('print-to-pdf', {
            html: htmlContent,
            title: customTitle || 'PCSHOP_Document'
        });

        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }

        // 4. 결과 처리
        if (result.success) {
            if (typeof showAlert === 'function') {
                showAlert('PDF가 저장되었습니다.');
            }
        } else if (result.canceled) {
            // 사용자가 저장 대화상자를 취소한 경우 - 아무 알림 없음
        } else if (result.error) {
            console.error('PDF generation error:', result.error);
            if (typeof showAlert === 'function') {
                showAlert('PDF 저장 중 오류가 발생했습니다.');
            }
        }
    } catch (err) {
        console.error('Print to PDF IPC failed:', err);
        if (typeof showAlert === 'function') {
            showAlert('PDF 생성 중 오류가 발생했습니다.');
        }
    } finally {
        isPrinting = false;
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    }
};
