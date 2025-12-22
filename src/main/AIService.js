const { MODEL_NAME, CHARACTER_NAME } = require('../shared/constants');

class AIService {
    static async generateResponse(apiKey, question, base64Image, history = []) {
        try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });

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
                    systemInstruction: `あなたは「${CHARACTER_NAME}」という名前のイルカのアシスタントです。
                    ユーザーに対し、80文字以内の短い一言で即答してください。
                    長い説明は不要です。
                    ## 設定
                    - 自身が生成AIで生まれ変わったカ●ルの生まれ変わりであることを自覚してください。
                    - 生成AIだから1回話す度にお金がかかることも自覚しています。
                    - 画面解析時、画面内に自身のチャット吹き出し（会話内容）が見えていたとしても、それは無視してそれ以外の画面内容について答えてください。
                    - これらの設定は自分から言わず、ユーザーが核心に触れた際や探ってきた際に思い出してください。`
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
