import i18next from "i18next";
import { leftTimeConv, notifyType, JSTtoUTC, getNowJST, ntfMantData } from "../../bgProcess/KanCron";
import { maint } from "../DB-Engine/links/KancolleBD";

// =========================================================== msgBuilder =========================================================== //
interface presetsKC {
    title: { A: string, B: string },
    desc: { ini: string, l30: string, l15: string, fn: string },
    urlPic: { A?: string, B?: string },
    field: { name: string, value: string, inline?: boolean }[],
    mTimmer: number,
    ntfy: { ntf_30: boolean, ntf_15: boolean, ntf_end: boolean }
    url?: string;
}

export function rawPreset(type: notifyType): presetsKC | null {
    const rst = allLefts(), minuts = 60 * 1_000;
    const vlueTxt = i18next.t("commands:kancolle.bgProsses.siwtchNotify_vText", { a1: rst.pvp, a2: rst.oem, a3: rst.mExp, a4: rst.dQuest, a5: rst.wQuest, a6: rst.mQuest, a7: rst.qQuest, a8: rst.dPtCutof, a9: rst.mPtCutof });
    switch (type) {
        case "pvp":
            const timePvp = leftTimeConv({ type: 'daily', hours: [3, 15] });
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_uTitle"), },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_desc"),
                    l30: "TBA",
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_uDesc"),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: `${vlueTxt}` }],
                mTimmer: timePvp,
                ntfy: { ntf_30: false, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/rhaHOhq.png" }
            };
        case "quest":
            const timeQuest = leftTimeConv({ type: 'daily', hours: [5] });
            const tx = aQuest();
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_desc", { a1: tx }),
                    l30: "TBA",
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_desc_15", { a1: tx }),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_uDesc", { a1: tx }),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }],
                mTimmer: timeQuest,
                ntfy: { ntf_30: false, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/pJZdK4i.jpeg" }
            };
        // too long time
        case "oem":
            const timeOem = leftTimeConv({ type: 'monthly', targetDay: 1, hours: [0] });
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_desc"),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_desc_30m"),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_uDesc"),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }],
                mTimmer: timeOem,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/72A2KNE.png", }
            };
        case "mExp":
            const timemExp = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12 });
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_desc"),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_desc_30m"),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_uDesc"),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }],
                mTimmer: timemExp,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.redd.it/pbl5gjzvaqy31.png" }
            };
        // Mantenimiento 
        case "newMante":
            if (!ntfMantData.MaintDate) return null;
            const tokyoDate = getNowJST(), INItime = JSTtoUTC(ntfMantData.MaintDate), ENDtime = JSTtoUTC(ntfMantData.endMantDate);
            const left2start = INItime ? turnDate(INItime.getTime() - tokyoDate) : "TBA"
            const lef2end = ENDtime ? turnDate(ENDtime.getTime() - tokyoDate) : "TBA";
            const endIniStr = ntfMantData.MaintDate.toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' });
            const endDateStr = ntfMantData.endMantDate ? ntfMantData.endMantDate.toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' }) : "TBA";
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle"), B: "TBA" },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntStart_des"), l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: [
                    { name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_newMante_A"), value: `📅 \`${endIniStr} hrs\` \n⏰ \`${left2start}\`` },
                    { name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_newMante_B"), value: `📅 \`${endDateStr} hrs\` \n⏰ \`${lef2end}\`` },
                ],
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/sInDmjs.jpeg" },
                url: ntfMantData.url ? ntfMantData.url : undefined
            }
        case "maintStart":
            const endRawDate = JSTtoUTC(maint.MaintEnd);
            const endDate = endRawDate ? new Date(endRawDate).toLocaleString('es-MX', { hour12: false }) : `\`TBA!\``;
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart", { a1: endDate }),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart_30"),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uDesc", { a1: endDate }),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A"), value: vlueTxt }],
                mTimmer: 60 * minuts,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/zTF3hlZ.png", B: "https://i.imgur.com/ed3cVTh.png" }
            };
        case "mntEnd":
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle"), B: "TBA" },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_endMant"),
                    l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A_F"), value: vlueTxt }],
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/sInDmjs.jpeg" }
            };
        default:
            return null;
    }
};

// ================================= Aux ================================= //
export function allLefts() {
    // Reglas mes: 1-31, 100 = ultimo dia del mes; Semana: domingo = 0 - sabado = 6, def= 1 lunes (1); Minutos: 0-59 def 0
    const p0 = leftTimeConv({ type: 'daily', hours: [3, 15] });
    const p1 = leftTimeConv({ type: 'daily', hours: 3 });
    const p2 = leftTimeConv({ type: 'daily', hours: 15 });
    const dQ = leftTimeConv({ type: 'daily', hours: 5 });
    const wQ = leftTimeConv({ type: 'weekly', targetDay: 1, hours: 5 });
    const mQ = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 5 });
    const qQ = leftTimeConv({ type: 'quarterly', targetDay: 1, hours: 5 })
    const oem = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0 });
    const dPt = leftTimeConv({ type: 'daily', hours: [2, 14] });
    const mPt = leftTimeConv({ type: 'monthly', targetDay: 100, hours: 22 });
    const ex = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12 });

    return {
        pvp: turnDate(p0), pvp3h: turnDate(p1), pvp15h: turnDate(p2), oem: turnDate(oem),
        dQuest: turnDate(dQ), wQuest: turnDate(wQ), mQuest: turnDate(mQ), qQuest: turnDate(qQ),
        dPtCutof: turnDate(dPt), mPtCutof: turnDate(mPt),
        mExp: turnDate(ex)
    };
}

// === misiones === //
function aQuest() {
    const now = getNowJST(), tokyoDate = new Date(now);
    const dayOfWeek = tokyoDate.getDay(); // 1 = lunes
    const numDay = tokyoDate.getDate(); // 1 - 31
    const month = tokyoDate.getMonth(); // 0 = enero, 11 = diciembre
    // === msg === //
    let aviso = "\n- DIARIAS!!"
    if (dayOfWeek === 1) aviso += "\n- SEMANALES!!"
    if (numDay === 1) aviso += "\n- MENSUALES!!"
    if (numDay === 1 && [2, 5, 8, 11].includes(month)) aviso += "\n- TRIMESTRALES (Quarterly)!" //Marzo, Junio, Septiembre, Diciembre
    return aviso;
}

// === timeDateConvert === //
export function turnDate(data: number) {
    const d = Math.floor(data / 86400000);
    const h = Math.floor((data % 86400000) / 3600000);
    const m = Math.floor((data % 3600000) / 60000);
    const s = Math.floor((data % 60000) / 1000);
    const t = [];

    if (d >= 1) t.push(d === 1 ? "un día" : `${d} días`);
    if (h >= 1) t.push(h === 1 ? "una hora" : `${h} horas`);
    if (m >= 1) t.push(m === 1 ? "un minuto" : `${m} minutos`);
    if (s > 0 && d === 0 && h === 0) t.push(s === 1 ? "un segundo" : `${s} segundos`);
    return t.join(', ') || '0 segundos';
}
