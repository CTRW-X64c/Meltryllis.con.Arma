import i18next from "i18next";
import { leftTimeConv, leftTime, aQuest, notifyType, JSTtoUTC, getNowJST, turnDate, ntfMantData } from "../../bgProcess/KanCron";
import { maint } from "../DB-Engine/links/KancolleBD";

// =========================================================== msgBuilder =========================================================== //

interface CConf {
    title: { A: string, B: string },
    desc: { ini: string, l30: string, l15: string, fn: string },
    urlPic: { A?: string, B?: string },
    field: { name: string, value: string, inline?: boolean }[],
    mTimmer: number,
    ntfy: { ntf_30: boolean, ntf_15: boolean, ntf_end: boolean }
    url?: string;
}

export function configs(type: notifyType): CConf | null {
    const tx = aQuest(), rst = leftTime(), minuts = 60 * 1_000;
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
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart", { a1: endDate }),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart_30"),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uDesc"),
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
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A"), value: vlueTxt }],
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/sInDmjs.jpeg" }
            };
        default:
            return null;
    }
};

