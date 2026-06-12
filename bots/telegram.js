// TELEGRAM BOT — 2-Layer Signal Delivery
const TelegramBot = require("node-telegram-bot-api");

class TelegramSignalBot {
  constructor(token, channelId) {
    if (!token) throw new Error("Telegram token required");
    this.bot = new TelegramBot(token, { polling:false });
    this.channelId = channelId;
  }

  formatSignalMessage(symbol, timeframe, decision, smcData, riskData) {
    const verdict = decision.verdict?.toUpperCase() || "WAIT";
    const signal  = decision.signal?.toUpperCase()  || "NEUTRAL";
    const vEm = verdict==="TAKE"?"✅":verdict==="SKIP"?"❌":"⏳";
    const sEm = signal==="BUY"?"🟢":signal==="SELL"?"🔴":"🟡";
    const qEm = {"A+":"💎","A":"🥇","B":"🥈","C":"🥉","INVALID":"🚫"}[decision.setupQuality]||"📊";
    const now = new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"});
    const ms  = smcData.marketStructure||{};
    const ema = smcData.emaData||{};
    const l1  = decision.layer1||{};

    let msg = `${vEm} *${verdict} — ${symbol}* ${sEm}
━━━━━━━━━━━━━━━━━━━━
📊 *TF:* ${timeframe} | *AI:* ${decision.aiSource||"Gemini"}
⏰ *IST:* ${now}

${sEm} *SIGNAL: ${signal}* | ${vEm} *VERDICT: ${verdict}*
${qEm} *Quality: ${decision.setupQuality||"—"}* | Conf: ${decision.confidence}%
━━━━━━━━━━━━━━━━━━━━
💰 *Price:* ${smcData.currentPrice}
📍 *ENTRY:* \`${decision.entry}\`
🎯 *T1:* \`${decision.target1}\` | *T2:* \`${decision.target2}\`
🛑 *SL:* \`${decision.stopLoss}\` | *R:R:* ${decision.rrRatio}

━━━━━━━━━━━━━━━━━━━━
✅ *WHY ENTER:* ${decision.entryReason||"—"}
⚠️ *RISK:* ${decision.riskWarning||"—"}
⏰ *ENTER WHEN:* ${decision.bestTimeToEnter||"—"}

━━━━━━━━━━━━━━━━━━━━
📈 *HTF: ${ms.trend||"—"}*
📊 EMA: 5=${ema.ema5}|10=${ema.ema10}|20=${ema.ema20}|30=${ema.ema30}
`;

    (ms.structure||[]).forEach(s => {
      const em=s.type==="HH"?"📈":s.type==="HL"?"🟢":s.type==="LL"?"📉":"🔴";
      msg += `${em} *${s.type}* — ${s.level}\n`;
    });

    if (smcData.bos?.length>0)        msg += `🔷 *BOS:* ${smcData.bos[0].description}\n`;
    if (smcData.choch?.length>0)       msg += `🔄 *CHoCH:* ${smcData.choch[0].description}\n`;
    if (smcData.orderBlocks?.length>0) msg += `🧱 *OB:* ${smcData.orderBlocks[smcData.orderBlocks.length-1].description}\n`;
    if (smcData.liquidity?.length>0)   msg += `💧 *Liq:* ${smcData.liquidity[smcData.liquidity.length-1].description}\n`;
    if (smcData.fvg?.length>0)         msg += `⬜ *FVG:* ${smcData.fvg[smcData.fvg.length-1].description}\n`;
    if (smcData.slHunts?.length>0)     msg += `🎯 *SL Hunt:* ${smcData.slHunts[smcData.slHunts.length-1].description}\n`;

    const vol = smcData.volumeData||{};
    msg += `⚪ *Vol:* ${vol.volumeSignal} (${vol.ratio}x)`;
    if (l1.confluences?.length>0) msg += `\n📋 *Confluences(${l1.confluenceCount}):* ${l1.confluences.join(" · ")}`;
    msg += `\n🔑 *Key:* ${decision.smcKey||"—"}`;
    msg += `\n❌ *Invalidation:* ${decision.invalidation||"—"}`;
    if (riskData) msg += `\n━━━━━━━━━━━━━━━━━━━━\n💼 *RISK(1%)*: Size:${riskData.positionSize} | Profit:$${riskData.potentialProfit} | Valid:${riskData.isValidSetup?"✅":"❌"}`;
    msg += `\n\n_⚠️ Educational only. Not financial advice._`;
    return msg;
  }

  async sendSignal(symbol, timeframe, decision, smcData, riskData=null) {
    try {
      await this.bot.sendMessage(this.channelId, this.formatSignalMessage(symbol, timeframe, decision, smcData, riskData), { parse_mode:"Markdown", disable_web_page_preview:true });
      console.log(`✅ TG sent: ${symbol} ${decision.verdict} ${decision.signal}`);
      return true;
    } catch(e) { console.error("TG error:", e.message); return false; }
  }

  async sendScanSummary(results) {
    const takes = results.filter(r=>r.verdict==="TAKE");
    const waits = results.filter(r=>r.verdict==="WAIT"||!r.verdict);
    const now   = new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"});
    let msg = `🔍 *SCAN SUMMARY* | ⏰ ${now}\n━━━━━━━━━━━━━━━━━━━━\n📊 Scanned:${results.length} ✅TAKE:${takes.length} ⏳WAIT:${waits.length}\n`;
    if (takes.length>0) { msg+="\n✅ *TOP SETUPS:*\n"; takes.slice(0,5).forEach(r=>{const em=r.signal==="BUY"?"🟢":"🔴";msg+=`${em}*${r.symbol}*(${r.timeframe}) ${r.setupQuality||"—"}|${r.confidence}%|E:${r.entry} SL:${r.stopLoss} T1:${r.target1}\n`;}); }
    if (waits.length>0) { msg+="\n⏳ *WATCH:*\n"; waits.slice(0,3).forEach(r=>{msg+=`• *${r.symbol}* — ${r.bestTimeToEnter||"Wait"}\n`;}); }
    msg+="\n_TradeSignal AI — SMC v3.1_";
    try { await this.bot.sendMessage(this.channelId, msg, {parse_mode:"Markdown"}); } catch(e) { console.error("TG summary error:", e.message); }
  }

  async testConnection() {
    try {
      await this.bot.sendMessage(this.channelId, "✅ *TradeSignal AI SMC v3.1 Connected!*\nLayer 1: Signal Engine 🔧\nLayer 2: Gemini+Claude 🤖\nReady! 🚀", {parse_mode:"Markdown"});
      return true;
    } catch(e) { return false; }
  }
}

module.exports = TelegramSignalBot;
