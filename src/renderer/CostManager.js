class CostManager {
    constructor() {
        this.PRICE_PER_1M_INPUT = 0.50;
        this.PRICE_PER_1M_OUTPUT = 3.00;
        this.totalUSD = parseFloat(localStorage.getItem('totalEstimatedCostUSD')) || 0;
        this.exchangeRate = parseFloat(localStorage.getItem('exchangeRate')) || 154;
        this.rateTime = localStorage.getItem('rateTime') || "";
        this.lastRateUpdate = parseInt(localStorage.getItem('lastRateUpdate')) || 0;
    }

    async updateExchangeRate(electronAPI) {
        const now = Date.now();
        if (now - this.lastRateUpdate > 86400000) {
            const info = await electronAPI.getExchangeRate();
            this.exchangeRate = info.rate;
            this.rateTime = info.time;
            this.lastRateUpdate = now;

            localStorage.setItem('exchangeRate', this.exchangeRate.toString());
            localStorage.setItem('rateTime', this.rateTime);
            localStorage.setItem('lastRateUpdate', this.lastRateUpdate.toString());
        }
    }

    calculateSessionCost(usage) {
        if (!usage) return 0;
        const promptTokens = usage.promptTokenCount || usage.prompt_token_count || 0;
        const candidatesTokens = usage.candidatesTokenCount || usage.candidates_token_count || 0;

        const inputCost = (promptTokens / 1000000) * this.PRICE_PER_1M_INPUT;
        const outputCost = (candidatesTokens / 1000000) * this.PRICE_PER_1M_OUTPUT;
        return inputCost + outputCost;
    }

    addCost(costUSD) {
        this.totalUSD += costUSD;
        localStorage.setItem('totalEstimatedCostUSD', this.totalUSD.toString());
    }

    getFormattedDisplay(sessionCostUSD = 0) {
        const totalJPY = this.totalUSD * this.exchangeRate;
        const sessionJPY = sessionCostUSD * this.exchangeRate;

        return `
            今回の相談: 約${sessionJPY.toFixed(2)}円 / 総額: 約${totalJPY.toFixed(2)}円<br>
            (1$ = ${this.exchangeRate.toFixed(0)}円 ${this.rateTime})
        `;
    }
}
