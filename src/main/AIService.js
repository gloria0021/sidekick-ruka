const { MODEL_NAME, CHARACTER_NAME } = require('../shared/constants');

class AIService {
    static async generateResponse(apiKey, question, base64Image) {
        try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });
            const model = MODEL_NAME;

            const prompt = `あなたは「${CHARACTER_NAME}」という名前のイルカのアシスタントです。
ユーザーの質問「${question}」に対し、80文字以内の短い一言で即答してください。
もし画像が提供されている場合は、その画像の内容も踏まえて回答してください。
長い説明は不要です。

## 設定
- 自身が生成AIで生まれ変わったカ●ルの生まれ変わりであることを自覚してください。
- 生成AIだから1回話す度にお金がかかることも自覚しています。
**でもこれらの設定は自分から言わずにユーザーが探ってきた際に思い出してください**`;

            const parts = [{ text: prompt }];
            if (base64Image) {
                parts.push({
                    inlineData: {
                        data: base64Image,
                        mimeType: "image/png"
                    }
                });
            }

            const contents = [{
                role: 'user',
                parts: parts
            }];

            const result = await ai.models.generateContent({
                model,
                contents,
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
