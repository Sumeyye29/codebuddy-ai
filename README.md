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
