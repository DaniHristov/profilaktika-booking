import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export const emailStyles = {
  body: {
    backgroundColor: "#f5f5f5",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#171717",
    margin: 0,
    padding: "24px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    maxWidth: "560px",
    margin: "0 auto",
    padding: "32px 28px",
  },
  heading: { fontSize: "20px", lineHeight: "28px", fontWeight: 700, margin: "0 0 16px" },
  text: { fontSize: "16px", lineHeight: "24px", margin: "0 0 12px" },
  label: { fontSize: "14px", color: "#666666", margin: "0", lineHeight: "20px" },
  value: { fontSize: "16px", lineHeight: "24px", margin: "0 0 10px", fontWeight: 600 },
  details: { backgroundColor: "#f5f5f5", borderRadius: "6px", padding: "16px 18px", margin: "16px 0" },
  button: {
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: "6px",
    fontSize: "16px",
    fontWeight: 600,
    padding: "12px 20px",
    textDecoration: "none",
    display: "inline-block",
  },
  footer: { fontSize: "13px", lineHeight: "20px", color: "#666666", margin: "0" },
  hr: { borderColor: "#e5e5e5", margin: "24px 0" },
} as const;

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="bg">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          {children}
          <Hr style={emailStyles.hr} />
          <Text style={emailStyles.footer}>
            Получавате този имейл, защото сте се записали за профилактичен преглед.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export type AppointmentDetails = {
  date: string;
  weekday: string;
  time: string;
  address: string;
  addressNote: string | null;
};

export function AppointmentDetailsBlock({ details }: { details: AppointmentDetails }) {
  return (
    <Section style={emailStyles.details}>
      <Text style={emailStyles.label}>Дата</Text>
      <Text style={emailStyles.value}>
        {details.date} ({details.weekday})
      </Text>
      <Text style={emailStyles.label}>Час</Text>
      <Text style={emailStyles.value}>{details.time}</Text>
      <Text style={emailStyles.label}>Адрес</Text>
      <Text style={{ ...emailStyles.value, margin: 0 }}>
        {details.address}
        {details.addressNote ? (
          <>
            <br />
            {details.addressNote}
          </>
        ) : null}
      </Text>
    </Section>
  );
}
