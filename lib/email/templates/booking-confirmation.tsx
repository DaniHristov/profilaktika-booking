import { Button, Heading, Section, Text } from "@react-email/components";

import {
  AppointmentDetailsBlock,
  EmailLayout,
  emailStyles,
  type AppointmentDetails,
} from "./email-layout";

export type BookingConfirmationEmailProps = {
  fullName: string;
  campaignTitle: string;
  details: AppointmentDetails;
  /** null when the campaign does not allow online cancellation. */
  cancelUrl: string | null;
};

export function BookingConfirmationEmail({
  fullName,
  campaignTitle,
  details,
  cancelUrl,
}: BookingConfirmationEmailProps) {
  return (
    <EmailLayout preview={`Профилактичен преглед на ${details.date} от ${details.time}`}>
      <Heading as="h1" style={emailStyles.heading}>
        {campaignTitle}
      </Heading>
      <Text style={emailStyles.text}>Здравейте, {fullName},</Text>
      <Text style={emailStyles.text}>Вашият профилактичен преглед е записан успешно.</Text>

      <AppointmentDetailsBlock details={details} />

      <Text style={emailStyles.text}>
        Към този имейл е прикачен файл, с който можете да добавите прегледа в календара си.
      </Text>

      {cancelUrl ? (
        <>
          <Text style={emailStyles.text}>
            Ако не можете да дойдете, моля, отменете записването, за да освободите часа за друг
            служител:
          </Text>
          <Section style={{ margin: "8px 0 16px" }}>
            <Button href={cancelUrl} style={emailStyles.button}>
              Отмени записването
            </Button>
          </Section>
          <Text style={{ ...emailStyles.footer, wordBreak: "break-all" }}>
            Ако бутонът не работи, отворете този линк: {cancelUrl}
          </Text>
          <Text style={{ ...emailStyles.footer, marginTop: "8px" }}>
            Линкът е личен. Моля, не препращайте този имейл.
          </Text>
        </>
      ) : (
        <Text style={emailStyles.text}>
          Ако не можете да дойдете, моля, свържете се с медицинския център.
        </Text>
      )}
    </EmailLayout>
  );
}
