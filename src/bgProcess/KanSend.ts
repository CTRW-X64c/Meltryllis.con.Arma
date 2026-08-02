import { Role, EmbedBuilder, TextChannel } from "discord.js"
import { error } from "../sys/logging";
import { leftTimeConv, leftTime, notifyType } from "./KanCron"
import i18next from "i18next";
import { maint } from '../sys/DB-Engine/links/KancolleBD';

const minuts = 60 * 1_000, TZjp = 'Asia/Tokyo';
interface Params { ch: TextChannel, rol: Role | null, type: notifyType }
interface msgData { ch: TextChannel, title: string, fields: any[], desc: string, pic: string | undefined, roleContent: string | undefined, color: number }
interface CConf {
    title: { A: string, B: string },
    desc: { ini: string, l30: string, l15: string, fn: string },
    urlPic: { A: string, B?: string },
    field: { name: string, value: string, inline?: boolean }[],
    mTimmer: number,
    ntfy: { ntf_30: boolean, ntf_15: boolean, ntf_end: boolean }
}

const configs = (type: notifyType): CConf | null => {
    const tx = aQuest(), rst = leftTime();
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
                    l30: "TBA",
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_uDesc"),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }],
                mTimmer: timeOem,
                ntfy: { ntf_30: false, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/72A2KNE.png", }
            };
        case "mExp":
            const timemExp = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12 });
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_desc"),
                    l30: "TBA",
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_uDesc"),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }],
                mTimmer: timemExp,
                ntfy: { ntf_30: false, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.redd.it/pbl5gjzvaqy31.png" }
            }
        // Mantenimiento 
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

async function sendAutoDelete(dta: msgData) {
    const emb = new EmbedBuilder().setColor(dta.color).setTitle(dta.title).setDescription(dta.desc)
    if (dta.pic) emb.setImage(dta.pic);
    if (dta.fields && dta.fields.length > 0) emb.addFields(dta.fields);
    try {
        const msg = await dta.ch.send({ content: dta.roleContent, embeds: [emb] });
        if (msg.deletable) {
            setTimeout(() => {
                msg.delete().catch(err => error(`Error al borrar msg: ${err}`, "KanCron"));
            }, 10 * minuts);
        }
    } catch (e) {
        error(`Error enviando notificación: ${e}`, "KanCron");
    }
}

export async function sendMSG(dat: Params) {
    const preset = configs(dat.type);
    if (!preset) return;

    const roleMention = dat.rol ? `AVISO: ${dat.rol}!` : undefined;
    await sendAutoDelete({ ch: dat.ch, title: preset.title.A, fields: preset.field, desc: preset.desc.ini, pic: preset.urlPic.A, roleContent: roleMention, color: 0xFFA500 });

    if (preset.ntfy.ntf_30 && preset.mTimmer > (30 * minuts)) {
        setTimeout(async () => {
            await sendAutoDelete({ ch: dat.ch, title: preset.title.A, fields: [], desc: preset.desc.l30, pic: preset.urlPic.A, roleContent: undefined, color: 0xFFA500 });
        }, preset.mTimmer - (30 * minuts));
    }

    if (preset.ntfy.ntf_15 && preset.mTimmer > (15 * minuts)) {
        setTimeout(async () => {
            await sendAutoDelete({ ch: dat.ch, title: preset.title.A, fields: [], desc: preset.desc.l15, pic: preset.urlPic.A, roleContent: undefined, color: 0xFFA500 });
        }, preset.mTimmer - (15 * minuts));
    }

    if (preset.ntfy.ntf_end && preset.mTimmer > 0) {
        setTimeout(async () => {
            await sendAutoDelete({ ch: dat.ch, title: preset.title.B, fields: [], desc: preset.desc.fn, pic: preset.urlPic.B, roleContent: roleMention, color: 0x00AA00 });
        }, preset.mTimmer);
    }
}

// === misiones === //
function aQuest() {
    const now = new Date();
    const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TZjp }));
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

// == dateCore == //
export function JSTtoUTC(dateInput: string | Date | null | undefined): Date | null {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return new Date(dateInput.getTime());
    const match = dateInput.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
        const [_, year, month, day, hours, minutes, seconds] = match.map(Number);
        return new Date(Date.UTC(year, month - 1, day, hours - 9, minutes, seconds));
    }

    try {
        const parsed = new Date(dateInput);
        return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
        return null;
    }
}

export function getNowJST(): number {
    const now = new Date();
    return now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (9 * 60 * 60 * 1000);
}
