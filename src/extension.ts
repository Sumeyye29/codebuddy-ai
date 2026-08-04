import * as vscode from 'vscode';

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let currentCorrectAnswer: string = '';

// Her dosyanın son kaydedilen halini dosya yoluna göre hafızada tutuyoruz
const previousDocumentText = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeBuddy extension activated');
    vscode.window.showInformationMessage('CodeBuddy extension activated');

    const helloCommand = vscode.commands.registerCommand('codebuddy-ai.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from CodeBuddy');
    });

    context.subscriptions.push(helloCommand);

    // Dosya kaydedildiğinde tetiklenen event listener
    const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        // Sadece JavaScript ve TypeScript dosyalarını kontrol edelim
        if (document.languageId !== 'javascript' && document.languageId !== 'typescript') {
            return;
        }

        const yeniMetin = document.getText();
        if (!yeniMetin.trim()) {
            return;
        }

        const dosyaYolu = document.uri.toString();
        const eskiMetin = previousDocumentText.get(dosyaYolu) || '';

        // Dosyanın güncel halini hafızaya kaydediyoruz
        previousDocumentText.set(dosyaYolu, yeniMetin);

        // Eski ve yeni metin arasındaki anlamlı değişikliğin satır numaralarını tespit ediyoruz
        const degisenSatirlar = computeMeaningfulDiff(eskiMetin, yeniMetin);

        // Eğer anlamlı bir değişiklik yoksa (sadece boşluk/noktalı virgül/yorum eklenmiş) duruyoruz
        if (!degisenSatirlar) {
            console.log('Anlamlı bir kod değişikliği tespit edilmedi, atlanıyor.');
            return;
        }

        console.log('Anlamlı değişiklik tespit edildi, sembol analizi yapılıyor...');
        vscode.window.showInformationMessage('Yeni kod bloğu algılandı, quiz hazırlanıyor...');

        try {
            // VS Code'dan dosyadaki tüm sembolleri (fonksiyon, sınıf, metod vb.) alıyoruz
            const semboller = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            let gonderilecekKod: string;

            if (semboller && semboller.length > 0) {
                // Değişen satırları kapsayan sembolü buluyoruz (iç içe sembollere de bakıyoruz)
                const hedefSembol = findEnclosingSymbol(semboller, degisenSatirlar);

                if (hedefSembol) {
                    // Sembol bulunduysa tam metnini alıyoruz
                    gonderilecekKod = document.getText(hedefSembol.range);
                    console.log(`Değişiklik '${hedefSembol.name}' sembolü içinde tespit edildi.`);
                } else {
                    // Sembol bulunamazsa değişen satırları 2 satır bağlamla gönderiyoruz (yedek)
                    const yeniSatirlar = yeniMetin.split('\n');
                    const baslangic = Math.max(0, Math.min(...degisenSatirlar) - 2);
                    const bitis = Math.min(yeniSatirlar.length - 1, Math.max(...degisenSatirlar) + 2);
                    gonderilecekKod = yeniSatirlar.slice(baslangic, bitis + 1).join('\n');
                }
            } else {
                // Sembol sağlayıcı yoksa değişen satırları 2 satır bağlamla gönderiyoruz (yedek)
                const yeniSatirlar = yeniMetin.split('\n');
                const baslangic = Math.max(0, Math.min(...degisenSatirlar) - 2);
                const bitis = Math.min(yeniSatirlar.length - 1, Math.max(...degisenSatirlar) + 2);
                gonderilecekKod = yeniSatirlar.slice(baslangic, bitis + 1).join('\n');
            }

            // FastAPI backend'imize yalnızca ilgili kod bloğunu gönderiyoruz
            const response = await fetch('http://127.0.0.1:8000/analiz-et', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod: gonderilecekKod })
            });

            // Yanıt başarılı değilse (500 vb. durumlar) hatayı fırlat
            if (!response.ok) {
                const errorData: any = await response.json();
                throw new Error(errorData.detail || 'Sunucuda beklenmedik bir sorun oluştu.');
            }

            const data: any = await response.json();

            // Doğru cevabı global değişkene yazıyoruz (Kapanış hatasını/Closure bug'ını önlemek için)
            currentCorrectAnswer = data.dogru_cevap;

            if (currentPanel) {
                // Eğer panel zaten açıksa odaklanıyoruz
                currentPanel.reveal(vscode.ViewColumn.Two);
            } else {
                // Panel açık değilse yeni bir tane oluşturuyoruz
                currentPanel = vscode.window.createWebviewPanel(
                    'codeBuddyQuiz',
                    'CodeBuddy Quiz',
                    vscode.ViewColumn.Two, // Sağ taraftaki sütun
                    {
                        enableScripts: true // HTML içinde JS çalıştırmaya izin veriyoruz
                    }
                );

                // Kullanıcı paneli kapattığında referansı temizliyoruz
                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                }, null, context.subscriptions);

                // Webview içinden gelen mesajları (tıklamaları) dinliyoruz
                currentPanel.webview.onDidReceiveMessage(
                    message => {
                        if (message.command === 'cevapla') {
                            if (message.secim.startsWith(currentCorrectAnswer)) {
                                vscode.window.showInformationMessage('🎉 Harika! Kodu gerçekten anlamışsın.');
                            } else {
                                vscode.window.showErrorMessage('❌ Maalesef yanlış cevap. Kodu tekrar incele.');
                            }
                        }
                    },
                    undefined,
                    context.subscriptions
                );
            }

            // Hazırladığımız butonlu HTML içeriğini panele yüklüyoruz
            currentPanel.webview.html = getWebviewContent(data.soru, data.secenekler, data.dogru_cevap);

        } catch (error) {
            vscode.window.showErrorMessage('Backend sunucusuna bağlanılamadı!');
        }
    });

    context.subscriptions.push(saveListener);
}

export function deactivate() { }

/**
 * İki metin arasındaki anlamlı kod değişikliğini tespit eder.
 * Yalnızca boşluk, noktalı virgül veya yorum satırı değişikliklerini yok sayar.
 * @returns Değişen anlamlı satırların indeksleri (0-indexed), yoksa null
 */
function computeMeaningfulDiff(eskiMetin: string, yeniMetin: string): number[] | null {
    const eskiSatirlar = eskiMetin.split('\n');
    const yeniSatirlar = yeniMetin.split('\n');

    // Eklenen satırları tespit ediyoruz (yeni metinde olup eskisinde olmayan satırlar)
    const eskiSet = new Set(eskiSatirlar.map(s => s.trim()));

    // Önemsiz değişiklik kalıplarını tanımlıyoruz
    const onemsizKalip = /^[\s;,{}()]*$|^\/\/.*$|^\/\*.*\*\/$/;

    // Yeni satırları tarayarak anlamlı değişikliklerin indekslerini topluyoruz
    const anlamliIndeksler: number[] = [];

    yeniSatirlar.forEach((satir, indeks) => {
        const temizSatir = satir.trim();
        // Eski metinde olmayan, boş olmayan ve önemsiz olmayan satırları bul
        if (!eskiSet.has(temizSatir) && temizSatir.length > 0 && !onemsizKalip.test(temizSatir)) {
            anlamliIndeksler.push(indeks);
        }
    });

    if (anlamliIndeksler.length === 0) {
        return null; // Anlamlı bir değişiklik yok
    }

    return anlamliIndeksler;
}

/**
 * Değişen satırları kapsayan en dar sembolü (fonksiyon, sınıf vb.) bulur.
 * İç içe sembollere de bakar (örn: sınıf içindeki metod).
 * @returns Kapsayan sembol, bulunamazsa undefined
 */
function findEnclosingSymbol(
    semboller: vscode.DocumentSymbol[],
    degisenSatirlar: number[]
): vscode.DocumentSymbol | undefined {
    let enDarSembol: vscode.DocumentSymbol | undefined;

    for (const sembol of semboller) {
        // Bu sembol değişen satırlardan en az birini kapsıyor mu?
        const kapsiyorMu = degisenSatirlar.some(
            satir => satir >= sembol.range.start.line && satir <= sembol.range.end.line
        );

        if (kapsiyorMu) {
            enDarSembol = sembol;

            // İç içe (children) sembollere de bakıyoruz, daha dar bir eşleşme olabilir
            if (sembol.children && sembol.children.length > 0) {
                const icSembol = findEnclosingSymbol(sembol.children, degisenSatirlar);
                if (icSembol) {
                    enDarSembol = icSembol; // Daha dar olan iç sembolü tercih et
                }
            }
        }
    }

    return enDarSembol;
}

function getWebviewContent(soru: string, secenekler: string[], dogruCevap: string): string {
    const parts = soru.split('\n\n');
    const soruMetni = parts[0];
    const kodMetni = parts.slice(1).join('\n\n');

    return `<!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                padding: 24px;
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
            }
            .quiz-container {
                max-width: 600px;
                margin: 0 auto;
            }
            h3 { 
                color: var(--vscode-textLink-foreground);
                font-size: 18px;
                margin-top: 0;
                margin-bottom: 8px;
            }
            .question-text {
                font-size: 15px;
                line-height: 1.6;
                margin-bottom: 16px;
                opacity: 0.9;
            }
            pre {
                background: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
                border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
                margin-bottom: 24px;
            }
            code {
                font-family: var(--vscode-editor-font-family, Consolas, Monaco, monospace);
                font-size: 13px;
            }
            .options-header {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 12px;
                opacity: 0.8;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .option-btn {
                display: block;
                width: 100%;
                margin: 10px 0;
                padding: 14px 18px;
                background: var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.05));
                color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
                border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.15));
                border-radius: 6px;
                cursor: pointer;
                text-align: left;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            .option-btn:hover:not(:disabled) {
                background: var(--vscode-button-secondaryHoverBackground, rgba(255, 255, 255, 0.1));
                transform: translateY(-1px);
                border-color: var(--vscode-focusBorder);
            }
            .option-btn:disabled {
                cursor: not-allowed;
                opacity: 0.5;
            }
            /* Doğru Cevap Stili */
            .option-btn.correct {
                background-color: #27ae60 !important;
                color: #ffffff !important;
                border-color: #2ecc71 !important;
                font-weight: bold;
                opacity: 1 !important;
                box-shadow: 0 0 10px rgba(39, 174, 96, 0.3);
            }
            /* Yanlış Cevap Stili */
            .option-btn.incorrect {
                background-color: #c0392b !important;
                color: #ffffff !important;
                border-color: #e74c3c !important;
                opacity: 1 !important;
                box-shadow: 0 0 10px rgba(192, 57, 43, 0.3);
            }
        </style>
    </head>
    <body>
        <div class="quiz-container">
            <h3>CodeBuddy Quiz</h3>
            <p class="question-text">${soruMetni}</p>
            
            ${kodMetni ? `<pre><code>${escapeHtml(kodMetni)}</code></pre>` : ''}

            <div class="options-header">Seçenekler</div>
            <div id="options-container">
                ${secenekler.map(s => `<button class="option-btn" onclick="secimYap(this, '${s.replace(/'/g, "\\'")}')">${s}</button>`).join('')}
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const dogruCevap = '${dogruCevap}';

            function secimYap(btn, secim) {
                const buttons = document.querySelectorAll('.option-btn');
                buttons.forEach(b => b.disabled = true);

                if (secim.startsWith(dogruCevap)) {
                    btn.classList.add('correct');
                } else {
                    btn.classList.add('incorrect');
                    // Doğru olan seçeneği de yeşil olarak vurgulayalım
                    buttons.forEach(b => {
                        const text = b.textContent || '';
                        if (text.trim().startsWith(dogruCevap)) {
                            b.classList.add('correct');
                        }
                    });
                }

                vscode.postMessage({
                    command: 'cevapla',
                    secim: secim
                });
            }
        </script>
    </body>
    </html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}