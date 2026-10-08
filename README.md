# 🧠 CodeBuddy AI — Smart Code Verification & Quiz Extension

**CodeBuddy AI**, özellikle yapay zeka araçları (ChatGPT, GitHub Copilot, Cursor, Claude Dev vb.) tarafından üretilen veya sıfırdan yazılan kodların geliştirici tarafından gerçekten anlaşılıp anlaşılmadığını denetleyen akıllı bir **VS Code Eklentisi** ve **FastAPI Backend** mimarisidir.

Günümüz yazılım geliştirme süreçlerinde artan "blind copy-paste" (anlamadan kod yapıştırma) ve kontrolsüz AI kod üretimi alışkanlığına karşı; geliştiricinin koda olan hakimiyetini, farkındalığını ve kod kalitesini artırmayı hedefler.

Not: Proje tamamlanmamış olup geliştirme aşamasındadır.

## 🌟 Öne Çıkan Özellikler

* 🎯 **Seçim Odaklı Quiz Üretimi (Manuel Mod):** Editörde istediğin kod bloğunu seçip (Highlight) sağ tık menüsünden veya kısayolla anında o koda özel test ürettirebilirsin.
* ⚡ **Akıllı Kod Analizi (Smart Diff):** Kod farklarını anlamsal olarak analiz eder; yorum satırları, boşluklar veya formatlama değişikliklerini eleyerek sadece kritik mantıksal değişimlere odaklanır.
* 🤖 **AI Code Auditor:** Gemini 3.1 Flash-Lite altyapısını kullanarak kodun değişken adlarını ezbere sormak yerine; **asenkron davranışları**, **iş mantığını**, **edge case'leri** ve **performans/güvenlik açıklarını** sorgulayan Türkçe, 3 seçenekli teknik quizler üretir.
* 🚀 **Non-Blocking & Performanslı:** VS Code düzenleme akışını asla kesintiye uğratmaz, arka planda asenkron çalışır ve yanıtları duruma göre Webview panelinde veya bildirimlerde sunar.

---

## 🛠️ Mimari ve Teknolojiler

Proje modüler bir **Client-Server** yapısında kurgulanmıştır:

### 1. Frontend / Extension (VS Code)
* **Dil:** TypeScript
* **Editör Entegrasyonu:** VS Code Extension API (`vscode.window`, `vscode.commands`, `vscode.workspace`)
* **Arayüz:** Webview Panel (HTML, CSS, Message Passing API)

### 2. Backend API
* **Framework:** Python / FastAPI
* **AI SDK:** `google-genai` (Google AI Studio)
* **Model:** `gemini-3.1-flash-lite`
* **Veri Doğrulama:** Pydantic (Structured Outputs ile JSON şeması garantisi)

---

## ⚙️ Nasıl Çalışır? (İş Akışı)

```text
[ Geliştirici Kod Yazar / Seçer ]
               │
               ▼
[ VS Code Eklentisi (TypeScript) ] ── (Anlamlı Kod Bloğu & AST Ayıklama)
               │
               ▼
   [ POST /analiz-et İsteği ]
               │
               ▼
 [ FastAPI Backend + Pydantic ] ── (Structured Output JSON Şeması)
               │
               ▼
[ Gemini 3.1 Flash-Lite Modeli ] ── (Teknik Türkçe Quiz Üretimi)
               │
               ▼
[ Interactive Webview Paneli ] ── (Kullanıcı Doğru/Yanlış Yanıtlar)
```

## 🚀 Yerel Kurulum ve Çalıştırma

> **Dil desteği:** Bu aşamada otomatik quiz üretimi yalnızca JavaScript ve TypeScript dosyalarında çalışır. Diğer programlama dilleri için destek ilerleyen geliştirme aşamalarında eklenecektir.

### Gereksinimler

- [Visual Studio Code](https://code.visualstudio.com/) (1.125 veya üzeri)
- [Node.js](https://nodejs.org/) (22 veya üzeri) ve npm
- Python (3.10 veya üzeri) ve `venv`
- Quiz oluşturmak için [Google AI Studio](https://aistudio.google.com/apikey) üzerinden alınmış bir Gemini API anahtarı

### 1. Depoyu klonlayın ve eklenti bağımlılıklarını yükleyin

```bash
git clone https://github.com/Sumeyye29/codebuddy-ai.git
cd codebuddy-ai
npm install
```

### 2. Backend'i hazırlayın

Depo kök dizinindeyken sanal ortam oluşturup bağımlılıkları yükleyin:

**Windows PowerShell**

```powershell
py -3 -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

PowerShell sanal ortam etkinleştirmeyi engellerse, yalnızca geçerli terminal oturumu için şu komutu çalıştırıp etkinleştirme adımını tekrarlayın:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

**macOS / Linux**

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

`backend/.env` dosyasını açıp `GEMINI_API_KEY` değerini kendi anahtarınızla değiştirin. Bu dosya Git tarafından yok sayılır; API anahtarınızı asla kaynak koda veya depoya eklemeyin.

### 3. Backend'i başlatın

Depo kök dizininde:

```bash
python -m uvicorn main:app --app-dir backend --reload
```

Sunucunun çalıştığını doğrulamak için ikinci bir terminalde `http://127.0.0.1:8000/` adresini açın. Başarılı yanıtta `FastAPI + Gemini Sunucusu Aktif!` mesajı görünür. Backend terminalini açık bırakın.

### 4. VS Code eklentisini çalıştırın

Depoyu VS Code'da açın, `F5` tuşuna basarak Extension Development Host penceresini başlatın. Bir JavaScript veya TypeScript dosyasını açıp değişiklik yaptıktan sonra kaydedin; quiz, backend çalışıyorsa ve API anahtarı geçerliyse oluşturulur.

### Kontroller

Eklenti derlemesi ve lint kontrolü:

```bash
npm run compile
npm run lint
```

Testler (VS Code test ortamını da indirip çalıştırır):

```bash
npm test
```

Backend API belgelerine `http://127.0.0.1:8000/docs` adresinden ulaşabilirsiniz.

## 🧩 Sorun Giderme

- **Backend başlatılırken API anahtarı hatası:** `backend/.env` dosyasının bulunduğunu ve `GEMINI_API_KEY` değerinin doğru olduğunu kontrol edin.
- **Eklenti backend'e bağlanamıyor:** Backend terminalinde hata olup olmadığını ve `http://127.0.0.1:8000/` adresinin açıldığını kontrol edin.
- **`F5` derleme görevi bulunamadı:** Depo kökünde `npm install` çalıştırdığınızdan emin olun ve VS Code penceresini depo kökünden açın.
