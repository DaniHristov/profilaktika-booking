import { z } from "zod";

const hours = (label: string) =>
  z.coerce
    .number({ error: `${label}: въведете число.` })
    .int(`${label}: въведете цяло число.`)
    .min(0, `${label}: не може да е отрицателно.`)
    .max(720, `${label}: най-много 720 часа.`);

export const campaignSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Въведете адрес на линка.")
    .max(80, "Адресът на линка може да е до 80 знака.")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Само малки латински букви, цифри и тирета между тях (напр. firma-2026).",
    ),
  title: z.string().trim().min(1, "Въведете заглавие.").max(200, "Заглавието може да е до 200 знака."),
  locationAddress: z
    .string()
    .trim()
    .min(1, "Въведете адрес.")
    .max(300, "Адресът може да е до 300 знака."),
  locationNote: z.string().trim().max(300, "Уточнението може да е до 300 знака."),
  isActive: z.boolean(),
  bookingClosesHoursBefore: hours("Краен срок за записване"),
  allowPublicCancel: z.boolean(),
  cancelClosesHoursBefore: hours("Краен срок за отмяна"),
});

export type CampaignFormInput = z.input<typeof campaignSchema>;
export type CampaignFormData = z.output<typeof campaignSchema>;
