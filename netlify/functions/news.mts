declare const Netlify: {
  env: {
    get: (name: string) => string | undefined;
  };
};

type NewsItem = {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string[];
  imageUrl: string | null;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
};

type NewsPayload = {
  tunisia: NewsItem[];
  worldCup2026: NewsItem[];
  sports: NewsItem[];
  world: NewsItem[];
  politics: NewsItem[];
  arts: NewsItem[];
  updatedAt: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function buildPrompt() {
  return `أنت محرر أخبار عربي محترف. اجلب أخبارًا حديثة قدر الإمكان باستعمال البحث، ثم أعد صياغتها بالكامل باللغة العربية بأسلوب صحفي واضح ومفهوم.

الأقسام المطلوبة:
1. أخبار تونس => key: tunisia
2. أخبار كأس العالم 2026 => key: worldCup2026
3. أخبار الرياضة => key: sports
4. الأخبار العالمية => key: world
5. الأخبار السياسية => key: politics
6. أخبار الفن => key: arts

لكل قسم أرجع 8 أخبار قدر الإمكان.

شروط صارمة:
- لا تكرر نفس الخبر في أكثر من قسم.
- أخبار تونس خاصة بتونس فقط.
- أخبار كأس العالم 2026 خاصة بكأس العالم فقط.
- أخبار الرياضة عامة ولا تكرر أخبار كأس العالم إلا للضرورة.
- أعد صياغة الخبر كاملًا ولا تنسخ النص الأصلي حرفيًا.
- لا تذكر اسم المصدر داخل العنوان أو الملخص أو جسم الخبر.
- لا تكتب عبارات مثل: حسب المصدر، قال الموقع، أفادت الصحيفة.
- حافظ على الوقائع والأسماء والتواريخ والنتائج والأرقام دون اختراع.
- لا تنشر خبرًا بلا sourceUrl.
- imageUrl يكون رابط الصورة الأصلية المباشرة إن وجد، وإلا null.

أرجع JSON صالحًا فقط بهذا الشكل:
{
  "tunisia": [],
  "worldCup2026": [],
  "sports": [],
  "world": [],
  "politics": [],
  "arts": [],
  "updatedAt": "ISO_DATE"
}

كل خبر يجب أن يحتوي:
{
  "id": "short-english-id",
  "category": "tunisia | worldCup2026 | sports | world | politics | arts",
  "title": "عنوان عربي جديد",
  "summary": "ملخص قصير",
  "body": ["4 إلى 7 فقرات عربية كاملة"],
  "imageUrl": null,
  "publishedAt": "تاريخ النشر إن وجد",
  "sourceName": "اسم المصدر داخليًا فقط",
  "sourceUrl": "رابط الخبر الأصلي داخليًا فقط"
}`;
}

function parseJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned) as NewsPayload;
}

function normalize(input: NewsPayload): NewsPayload {
  const keys = ["tunisia", "worldCup2026", "sports", "world", "politics", "arts"] as const;
  const output: NewsPayload = {
    tunisia: [],
    worldCup2026: [],
    sports: [],
    world: [],
    politics: [],
    arts: [],
    updatedAt: input.updatedAt || new Date().toISOString(),
  };

  for (const key of keys) {
    output[key] = Array.isArray(input[key])
      ? input[key]
          .filter((item) => item && item.title && item.sourceUrl)
          .slice(0, 8)
          .map((item, index) => ({
            id: String(item.id || `${key}_${Date.now()}_${index}`).replace(/[^a-zA-Z0-9_-]/g, "_"),
            category: key,
            title: String(item.title || ""),
            summary: String(item.summary || ""),
            body: Array.isArray(item.body) ? item.body.map(String).filter(Boolean) : [String(item.summary || "")],
            imageUrl: item.imageUrl || null,
            publishedAt: String(item.publishedAt || ""),
            sourceName: String(item.sourceName || ""),
            sourceUrl: String(item.sourceUrl || ""),
          }))
      : [];
  }
  return output;
}

export default async (req: Request) => {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY is missing in Netlify environment variables" }, 500);
  }

  const model = "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt() }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.45,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return jsonResponse({ error: data?.error?.message || `Gemini HTTP ${response.status}` }, response.status);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
  if (!text) {
    return jsonResponse({ error: "Gemini returned an empty response" }, 502);
  }

  try {
    return jsonResponse(normalize(parseJson(text)));
  } catch (error) {
    return jsonResponse({ error: "Failed to parse Gemini JSON", raw: text }, 502);
  }
};

export const config = {
  path: "/api/news",
};
