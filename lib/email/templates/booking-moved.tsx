import { Button, Heading, Section, Text } from "@react-email/components";

import {
  AppointmentDetailsBlock,
  EmailLayout,
  emailStyles,
  type AppointmentDetails,
} from "./email-layout";

export type BookingMovedEmailProps = {
  fullName: string;
  campaignTitle: string;
  details: AppointmentDetails;
  cancelUrl: string | null;
};

export function BookingMovedEmail({ fullName, campaignTitle, details, cancelUrl }: BookingMovedEmailProps) {
  return (
    <EmailLayout preview={`Нов час: ${details.date} от ${details.time}`}>
      <Heading as="h1" style={emailStyles.heading}>
        {campaignTitle}
      </Heading>
      <Text style={emailStyles.text}>Здравейте, {fullName},</Text>
      <Text style={emailStyles.text}>
        Часът на Вашия профилактичен преглед беше променен от медицинския център. Новият час е:
      </Text>

      <AppointmentDetailsBlock details={details} />

      <Text style={{ ...emailStyles.text, fontWeight: 600 }}>
        Ако сте добавили прегледа в календара си, моля, изтрийте стария час.
      </Text>
      <Text style={emailStyles.text}>
        Към този имейл е прикачен файл с новия час за календара.
      </Text>

      {cancelUrl ? (
        <>
          <Text style={emailStyles.text}>Ако не можете да дойдете в новия час, моля, отменете записването:</Text>
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
          Ако не можете да дойдете в новия час, моля, свържете се с медицинския център.
        </Text>
      )}
    </EmailLayout>
  );
}
