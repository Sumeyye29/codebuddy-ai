import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List
from dotenv import load_dotenv
from google import genai
from google.genai import types

# .env dosyasındaki değişkenleri yüklüyoruz
load_dotenv()

app = FastAPI()

# Gemini istemcisini oluşturuyoruz (API anahtarını otomatik olarak çevre değişkeninden okur)
client = genai.Client()

# VS Code'dan gelecek olan istek formatı
class KodAnalizIstegi(BaseModel):
    kod: str

# Gemini'dan dönmesini garanti ettiğimiz JSON şeması (Structured Output)
class QuizSorusu(BaseModel):
    soru: str = Field(description="Kod bloğunu test eden teknik, çoktan seçmeli Türkçe soru metni. Soruda kodun kendisi olmamalı, sadece soru cümlesi olmalı.")
    secenekler: List[str] = Field(description="Soru için tam olarak 3 adet seçenek. Her seçenek 'A) ', 'B) ' veya 'C) ' ile başlamalıdır.")
    dogru_cevap: str = Field(description="Doğru seçeneğin sadece harfi (Örn: A, B veya C).")

@app.get("/")
def ana_sayfa():
    return {"mesaj": "FastAPI + Gemini Sunucusu Aktif!"}

@app.post("/analiz-et")
def analiz_et(istek: KodAnalizIstegi):
    # Gemini modeline vereceğimiz komut (prompt)
    prompt = f"""
Aşağıdaki kod bloğunu analiz et ve geliştiricinin bu kodu gerçekten anlayıp anlamadığını test edecek 3 seçenekli, Türkçe teknik bir soru üret.

Kod Bloğu:
```javascript
{istek.kod}
```
"""
    try:
        # Gemini API çağrısını yapıyoruz
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json", # JSON yanıt istiyoruz
                response_schema=QuizSorusu,            # Yapılandırılmış çıktıyı zorluyoruz
            ),
        )
        
        # Yanıtı JSON nesnesine dönüştürüyoruz
        quiz_data = json.loads(response.text)
        
        # VS Code eklentimizin kod kutusunu çizebilmesi için 
        # soru metnini ve orijinal kod bloğunu "\n\n" ile birleştiriyoruz
        full_soru = f"{quiz_data['soru']}\n\n{istek.kod}"
        
        return {
            "soru": full_soru,
            "secenekler": quiz_data["secenekler"],
            "dogru_cevap": quiz_data["dogru_cevap"]
        }
        
    except Exception as e:
        # Geliştirici için detaylı hatayı backend konsoluna yazdır
        print(f"[LOG] Gemini API hatası: {e}")
        
        # Kullanıcıya sızma yapmayacak şekilde güvenli ve genel bir hata fırlat
        raise HTTPException(
            status_code=500, 
            detail="Gemini servisiyle bağlantı kurulamadı. Lütfen API anahtarınızı veya internet bağlantınızı kontrol edin."
        )