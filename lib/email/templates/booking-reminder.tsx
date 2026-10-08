import { Button, Heading, Section, Text } from "@react-email/components";

import {
  AppointmentDetailsBlock,
  EmailLayout,
  emailStyles,
  type AppointmentDetails,
} from "./email-layout";

export type BookingReminderEmailProps = {
  fullName: string;
  campaignTitle: string;
  details: AppointmentDetails;
  cancelUrl: string | null;
};

export function BookingReminderEmail({ fullName, campaignTitle, details, cancelUrl }: BookingReminderEmailProps) {
  return (
    <EmailLayout preview={`Напомняне: утре в ${details.time}`}>
      <Heading as="h1" style={emailStyles.heading}>
        {campaignTitle}
      </Heading>
      <Text style={emailStyles.text}>Здравейте, {fullName},</Text>
      <Text style={emailStyles.text}>Напомняме Ви, че утре имате профилактичен преглед.</Text>

      <AppointmentDetailsBlock details={details} />

      {cancelUrl ? (
        <>
          <Text style={emailStyles.text}>
            Ако не можете да дойдете, моля, отменете записването, за да освободите часа:
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
