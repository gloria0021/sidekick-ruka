const { MODEL_NAME, CHARACTER_NAME, DEFAULT_SYSTEM_PROMPT, CORE_SYSTEM_PROMPT, DEBUG_FLG } = require('../shared/constants');

class AIService {
    static async generateResponse(apiKey, question, base64Image, history = [], systemInstruction = null, thinkingLevel = 'MINIMAL', googleSearch = false) {
        try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });

            // 厳守ルールを先頭に付与
            const fullSystemInstruction = `${CORE_SYSTEM_PROMPT}\n\n${systemInstruction || DEFAULT_SYSTEM_PROMPT}`;

            // 今回の入力を構築
            const currentParts = [{ text: question || "この画面について教えてください" }];
            if (base64Image) {
                currentParts.push({
                    inlineData: {
                        data: base64Image,
                        mimeType: "image/png"
                    }
                });
            }

            // 履歴と現在の入力を結合
            const contents = [
                ...history,
                { role: 'user', parts: currentParts }
            ];

            const tools = [];
            if (googleSearch) {
                tools.push({ googleSearch: {} });
            }

            const request = {
                model: MODEL_NAME,
                contents,
                config: {
                    thinkingConfig: {
                        thinkingLevel: thinkingLevel || 'MINIMAL',
                    },
                    tools: tools.length > 0 ? tools : undefined,
                    mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
                    systemInstruction: fullSystemInstruction
                }
            };

            // 実際に投げられるJSONをデバッグ出力
            if (DEBUG_FLG) {
                console.log("--- AI API Request (JSON) ---");
                console.log(JSON.stringify(request, (key, value) => {
                    // 画像（base64）は長すぎてログを埋め尽くすので省略
                    if (key === 'data' && typeof value === 'string' && value.length > 100) {
                        return value.substring(0, 20) + "...(truncated)";
                    }
                    return value;
                }, 2));
                console.log("-----------------------------");
            }

            const result = await ai.models.generateContent(request);

            const text = result.response?.text?.() ||
                (result.candidates && result.candidates[0]?.content?.parts[0]?.text) ||
                "ごめんなさい、うまく言葉が出てこないみたいです🐬💦";

            const usage = result.usageMetadata ||
                result.response?.usageMetadata ||
                (result.candidates && result.candidates[0]?.usageMetadata);

            return { text, usage };

        } catch (err) {
            console.error("AI Service Error:", err);
            throw err;
        }
    }
}

module.exports = AIService;
