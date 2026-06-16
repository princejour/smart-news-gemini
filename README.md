# بوابة الأخبار الذكية - Netlify Functions

موقع أخبار عربي تجريبي يعتمد على `gemini-2.5-flash` مع Google Search Grounding، لكن عبر Netlify Function حتى يبقى مفتاح Gemini في إعدادات Netlify وليس داخل كود الواجهة.

## التبويبات

- أخبار تونس
- كأس العالم 2026
- أخبار الرياضة
- الأخبار العالمية
- الأخبار السياسية
- أخبار الفن

## الملفات المهمة

- `index.html`: الواجهة.
- `app.js`: منطق العرض والتبويبات والكاش المحلي.
- `netlify/functions/news.mts`: Backend يجلب الأخبار من Gemini.

## طريقة النشر على Netlify

1. ادخل إلى Netlify.
2. اختر Add new site.
3. اختر Import an existing project.
4. اربط GitHub واختر المستودع:

```text
princejour/smart-news-gemini
```

5. في Build settings اجعل:

```text
Build command: فارغ
Publish directory: .
Functions directory: netlify/functions
```

6. بعد إنشاء الموقع، ادخل إلى:

```text
Site configuration > Environment variables
```

7. أضف متغيرًا جديدًا:

```text
Name: GEMINI_API_KEY
Value: مفتاح Gemini الحقيقي
```

8. أعد النشر Deploy.

بعدها الموقع سيطلب الأخبار من:

```text
/api/news
```

ولن يظهر مفتاح Gemini داخل GitHub أو داخل كود المتصفح.
