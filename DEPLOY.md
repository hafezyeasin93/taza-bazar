# 🚀 tazabazar.bd.com — Render.com ডিপ্লয় গাইড

## ধাপ ১: GitHub-এ আপলোড করুন

1. https://github.com/new — নতুন রিপোজিটরি তৈরি করুন (নাম: `taza-bazar`)
2. নিচের কমান্ডগুলো চালান:

```bash
cd taza-bazar
git init
git add .
git commit -m "tazabazar.bd.com - রুপালি আম অর্ডার ওয়েবসাইট"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/taza-bazar.git
git push -u origin main
```

## ধাপ ২: Render.com-এ ডিপ্লয়

1. https://render.com — সাইন আপ / লগইন করুন (GitHub দিয়ে)
2. **New +** → **Web Service**
3. আপনার `taza-bazar` রিপোজিটরি সিলেক্ট করুন
4. নিচের সেটিংস দিন:

| সেটিং | মান |
|--------|-----|
| **Name** | `taza-bazar` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

5. **Environment Variables** যোগ করুন:

| Key | Value |
|-----|-------|
| `OWNER_PHONE` | `01629518850` |
| `OWNER_EMAIL` | `hafezyeasin93@gmail.com` |

6. **Create Web Service** ক্লিক করুন

⏳ ২-৩ মিনিট অপেক্ষা করুন। ডিপ্লয় হয়ে গেলে একটি URL পাবেন:
`https://taza-bazar.onrender.com`

## ধাপ ৩ (ঐচ্ছিক): ইমেইল ও SMS নোটিফিকেশন

Render.com-এ Environment Variable হিসেবে যোগ করুন:

> গুরুত্বপূর্ণ: Admin settings, uploaded images, price changes এবং password যেন restart/deploy-এর পরও থাকে, Render Persistent Disk mount path `/var/data` ব্যবহার করুন এবং `DATA_DIR=/var/data` রাখুন।

**ইমেইলের জন্য (Gmail):**
| Key | Value |
|-----|-------|
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_SECURE` | `false` |
| `EMAIL_USER` | `আপনার-ইমেইল@gmail.com` |
| `EMAIL_PASS` | `আপনার-app-password` |

**SMS এর জন্য (Twilio):**
| Key | Value |
|-----|-------|
| `TWILIO_ACCOUNT_SID` | `আপনার-sid` |
| `TWILIO_AUTH_TOKEN` | `আপনার-token` |
| `TWILIO_PHONE_NUMBER` | `+1234567890` |

---

**অ্যাডমিন প্যানেল:** `https://taza-bazar.onrender.com/admin`
**ডিফল্ট ইউজারনেম:** `admin`  
**ডিফল্ট পাসওয়ার্ড:** `Tazabazar@2026` (সাথে সাথে বদলে ফেলুন!)

প্রশ্ন থাকলে: ০১৬২৯৫১৮৮৫০ | hafezyeasin93@gmail.com
