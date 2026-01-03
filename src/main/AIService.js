const { MODEL_NAME, CHARACTER_NAME, DEFAULT_SYSTEM_PROMPT, CORE_SYSTEM_PROMPT } = require('../shared/constants');

class AIService {
    static async generateResponse(apiKey, question, base64Image, history = [], systemInstruction = null) {
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

            const result = await ai.models.generateContent({
                model: MODEL_NAME,
                contents,
                config: {
                    thinkingConfig: {
                        thinkingLevel: 'MINIMAL',
                    },
                    mediaResolution: 'MEDIA_RESOLUTION_LOW',
                    systemInstruction: fullSystemInstruction
                }
            });

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
