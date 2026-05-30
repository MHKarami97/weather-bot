# weather-bot 🌤️

A Persian Telegram weather bot built with TypeScript on Cloudflare Workers.

## مقدمه

ربات وضعیت هوا برای تلگرام:
- کاربر نام شهر را می‌فرستد
- ربات وضعیت هوای امروز را فارسی برمی‌گرداند
- طلب می‌کند که کاربر در کانال‌های مشخص عضو باشد
- کاملاً در Cloudflare Workers اجرا می‌شود (بدون server)

## ویژگی‌ها

✅ **چک عضویت کانال** — دکمه‌های inline برای پیوند  
✅ **متن‌های فارسی** — تمام پیام‌ها و شرایط هوا فارسی  
✅ **Emoji** — نمایش بصری برای هر داده  
✅ **معمارری مرتب** — بخش‌ها جداگانه و توسعه‌پذیر  
✅ **API رایگان** — Open-Meteo برای جغرافیایی و وضعیت هوا  
✅ **GitHub Actions** — CI/CD خودکار

---

## 📁 ساختار فایل‌ها

```
src/
├── index.ts          → Worker main + webhook handler + routing
├── messages.ts       → تمام متن‌ها و شرایط هوا (فارسی)
├── channels.ts       → چک عضویت کانال + دکمه‌ها
├── weather.ts        → دریافت و فرمت وضعیت هوا
└── utils.ts          → توابع مشترک Telegram API
```

### تفصیل فایل‌ها

#### `src/index.ts` — نقطه ورود اصلی
- Worker `fetch` handler
- Webhook routing (`/webhook`, `/set-webhook`, `/delete-webhook`, `/health`)
- پردازش پیام‌های معمولی و callback queries (دکمه‌ها)
- چک عضویت کانال
- هدایت به ماژول‌های تخصصی

#### `src/messages.ts` — تمام متن‌های بات
```typescript
messages:
  start              // پیام استقبال /start
  notMemberText      // درخواست عضویت
  checkButton        // دکمه بررسی
  channelJoined      // تایید عضویت
  stillNotMember     // هشدار عدم عضویت
  cityEmpty          // شهر خالی
  cityNotFound       // شهر پیدا نشد
  ...

weatherConditions:   // 30+ WMO weather codes فارسی
  0: "آسمان صاف"
  1: "عمدتاً صاف"
  ...
```

#### `src/channels.ts` — مدیریت عضویت کانال
```typescript
REQUIRED_CHANNELS = ["@mhkarami_97"]     // لیست کانال‌های الزامی

checkMembership(userId, botToken)         // بررسی عضویت
getChannelInlineButtons()                 // دکمه‌های Telegram
```

#### `src/weather.ts` — وضعیت هوا (قابل جایگزینی)
```typescript
buildWeatherMessage(city)      // ایجاد پیام فرمت‌شده
geocodeCity(city)              // جست‌وجوی شهر
getForecast(lat, lon)          // دریافت پیش‌بینی
weatherCodeToText(code)        // WMO code → فارسی
```

#### `src/utils.ts` — توابع مشترک
- Types: `TelegramUpdate`, `TelegramMessage`, `TelegramCallbackQuery`
- `sendTelegramMessage()` - ارسال پیام
- `editTelegramMessage()` - ویرایش پیام
- `answerCallbackQuery()` - پاسخ دکمه
- `telegramApi()` - فراخوانی API Telegram
- `extractCity()` - استخراج نام شهر
- `json()` - ساخت Worker response

---

## 🚀 راه‌اندازی

### پیش‌نیازها
- Node.js 20+
- حساب Cloudflare رایگان
- Telegram bot token (از `@BotFather`)

### مراحل

#### 1️⃣ نصب وابستگی‌ها
```powershell
cd D:\Local\weather-bot
npm install --registry=https://registry.npmjs.org
```

اگر TLS error:
```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\path\to\ca.pem"
npm install
```

#### 2️⃣ تولید کلید‌های سری
```powershell
# TELEGRAM_BOT_TOKEN (از @BotFather)
# مثال: 1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ADMIN_TOKEN (رشته تصادفی طولانی)
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# TELEGRAM_WEBHOOK_SECRET (رشته تصادفی)
[BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('-','').ToLower()
```

#### 3️⃣ ثبت اسرار در Cloudflare
```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

#### 4️⃣ Deploy
```powershell
npm run deploy
```

اگر خطای proxy/TLS:
```powershell
$env:CLOUDFLARE_API_TOKEN = "your-api-token"
npm run deploy
```

#### 5️⃣ ثبت Webhook
```powershell
curl.exe -X POST "https://<your-worker>.workers.dev/set-webhook" `
  -H "Authorization: Bearer <admin-token>"
```

پاسخ موفق:
```json
{ "ok": true, "webhookUrl": "https://...", "telegram": true }
```

---

## 🧪 تست کردن

1. ربات خود را در تلگرام پیدا کنید
2. `/start` بفرستید
3. روی دکمه کانال کلیک و عضو شوید
4. دکمه "✅ بررسی عضویت" را کلیک کنید
5. شهری بفرستید: `London`, `Tehran`, `Paris`

خروجی نمونه:
```
📍 موقعیت: London, England, United Kingdom
🌤️ وضعیت امروز: ابری
🌡️ دما: 15°C
🤔 دمای احساسی: 13°C
📊 بازه دمایی امروز: 10°C - 18°C
💧 رطوبت: 72%
💨 سرعت باد: 12.5 km/h
```

---

## 🔧 توسعه و گسترش

### اضافه‌کردن کانال جدید

ویرایش `src/channels.ts`:
```typescript
export const REQUIRED_CHANNELS = [
  "@mhkarami_97",
  "@channel_2",
  "@channel_3"
];
```
Deploy دوباره کنید.

### تغییر متن‌های بات

تمام متن‌ها در `src/messages.ts`:
```typescript
export const messages = {
  start: "سلام! برای شروع نام یک شهر بفرستید.",
  cityEmpty: "لطفاً نام شهر را بفرستید.",
  // ...
};
```

### جایگزینی API وضعیت هوا

کل `src/weather.ts` را جایگزین کنید:

```typescript
// src/weather.ts
import { weatherLabels } from "./messages";

export async function buildWeatherMessage(city: string): Promise<string> {
  // API خودتان (OpenWeatherMap، WeatherAPI، ...)
  const response = await fetch(`https://your-api.com/weather?city=${city}`);
  const data = await response.json();
  
  // فرمت به فارسی
  return `${weatherLabels.location}: ${city}\n...`;
}
```

**باقی کد بدون تغییر!** — `src/index.ts` و سایر فایل‌ها در جای خود باقی می‌مانند.

### اضافه‌کردن دستور جدید

مثال: دستور `/joke` برای خنده‌داری

1. `src/messages.ts`:
```typescript
export const messages = {
  randomJoke: "این یک خنده است! 😄",
};
```

2. `src/index.ts` (قبل از weather logic):
```typescript
if (text === "/joke") {
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messages.randomJoke);
  return new Response("ok");
}
```

3. Deploy کنید.

---

## 📤 GitHub و CI/CD

### Push به GitHub
```powershell
git config --global user.email "you@example.com"
git config --global user.name "Your Name"

git add .
git commit -m "initial weather bot setup"
git remote add origin https://github.com/YOUR_USER/weather-bot.git
git branch -M main
git push -u origin main
```

### GitHub Secrets
در تنظیمات Repository، اضافه کنید:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**نکته:** اسرار Telegram (`TELEGRAM_BOT_TOKEN`، `ADMIN_TOKEN`، `TELEGRAM_WEBHOOK_SECRET`) باید در Cloudflare ثبت شوند، نه GitHub.

### Deploy خودکار
هر push به `main` خودکار deploy می‌کند (`.github/workflows/deploy.yml`).

---

## 📝 npm اسکریپت‌ها

```powershell
npm run dev      # اجرای محلی
npm run deploy   # Deploy به Cloudflare
npm run check    # Type check بدون build
npm run types    # تولید Wrangler types
```

---

## 🔐 متغیرهای محیطی

| متغیر | الزامی | مثال |
|-------|--------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | `1234567890:AAHxxx...` |
| `ADMIN_TOKEN` | ✅ | secret رشته طولانی |
| `TELEGRAM_WEBHOOK_SECRET` | ✅ | secret رشته طولانی |
| `BOT_NAME` | ❌ | weather-bot |

---

## 🐛 حل مشکلات

### ❌ "Worker name missing"
✅ حل: `wrangler.toml` میں `name = "weather-bot"` موجود است.

### ❌ TLS/Certificate Error
```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\your\ca.pem"
npm install
```
یا استفاده از API token Cloudflare.

### ❌ "City not found"
✅ حل: نام شهر را انگلیسی وارد کنید
- `London` ✓
- `لندن` ✗

### ❌ Webhook response خطا
- Bot token صحیح؟ (چک `@BotFather`)
- Webhook secret وارد شدند؟
- Worker URL accessible؟

### ❌ npm install ناموفق
```powershell
$env:NODE_EXTRA_CA_CERTS = "path-to-ca"
npm install --registry=https://registry.npmjs.org
```

---

## 🏗️ معمارری

### Separation of Concerns
```
index.ts    → Routing و lifecycle
messages.ts → تمام متن‌های کاربرپسند
channels.ts → کنترل دسترسی
weather.ts  → Business logic (قابل جایگزینی)
utils.ts    → توابع مشترک
```

### قابلیت توسعه برای بات‌های جدید
```
weather-bot (فعلی)
├── translation-bot (آینده)
│   └── src/translation.ts
├── news-bot (آینده)
│   └── src/news.ts
└── shared: utils, messages, channels
```

هر بات جدید می‌تواند:
- `utils.ts` را مشترک کند
- `messages.ts` خودش را داشته باشد
- بخش business logic خودش را داشته باشد

---

## 📚 مرجع API

### Telegram Methods (استفاده‌شده)
- `sendMessage` – ارسال پیام
- `editMessageText` – ویرایش پیام
- `setWebhook` – ثبت webhook
- `deleteWebhook` – حذف webhook
- `getChatMember` – بررسی عضویت کانال
- `answerCallbackQuery` – پاسخ نوتیفیکیشن دکمه

### Open-Meteo API
- `https://geocoding-api.open-meteo.com/v1/search` – جست‌وجوی شهر
- `https://api.open-meteo.com/v1/forecast` – وضعیت هوا (WMO codes)

---

## 📄 لایسنس

رایگان برای استفاده شخصی و تجاری.

---

## 🎯 Quick Reference

| کار | فایل | دستور |
|-----|------|--------|
| متن‌ها تغییر | `src/messages.ts` | edit + deploy |
| کانال جدید | `src/channels.ts` | edit + deploy |
| API تغییر | `src/weather.ts` | replace + deploy |
| دستور جدید | `src/index.ts` | edit + deploy |
| Deploy | - | `npm run deploy` |
| Local test | - | `npm run dev` |

---

**سوالات؟**
- Telegram: `@BotFather` برای ایجاد bot
- Cloudflare: [dash.cloudflare.com](https://dash.cloudflare.com)
- Open-Meteo: [open-meteo.com](https://open-meteo.com)

