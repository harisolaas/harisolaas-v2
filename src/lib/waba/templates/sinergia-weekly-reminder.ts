import type { WabaTemplateDefinition } from "../types";

/**
 * Day-of reminder for Sinergia, sent the morning of every Wednesday
 * session via the existing `/api/sinergia/send-reminders` cron.
 *
 * Spanish, voseo, gender-agnostic per CLAUDE.md.
 *
 * UTILITY category — this is a transactional reminder for an event
 * the recipient already RSVP'd to. Marketing-recategorization risk
 * is low so long as we keep the body strictly informational (no
 * promotional language, no "limited time" framing).
 */
export const SINERGIA_WEEKLY_REMINDER: WabaTemplateDefinition = {
  name: "sinergia_weekly_reminder",
  category: "utility",
  language: "es_AR",
  components: [
    {
      type: "BODY",
      text:
        "Hola {{name}}, te recordamos que esta noche es Sinergia: nos juntamos a las {{time}}. " +
        "Si no podés venir, respondé este mensaje y liberamos tu lugar para alguien de la lista de espera. ¡Te esperamos!",
      example: {
        body_text_named_params: [
          { param_name: "name", example: "Ana" },
          { param_name: "time", example: "19:30" },
        ],
      },
    },
    {
      type: "FOOTER",
      text: "harisolaas.com · Sinergia",
    },
  ],
};

export type SinergiaWeeklyReminderVariables = {
  name: string;
  time: string;
};
