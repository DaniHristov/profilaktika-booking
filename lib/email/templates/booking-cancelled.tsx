import { Heading, Text } from "@react-email/components";

import {
  AppointmentDetailsBlock,
  EmailLayout,
  emailStyles,
  type AppointmentDetails,
} from "./email-layout";

export type BookingCancelledEmailProps = {
  fullName: string;
  campaignTitle: string;
  details: AppointmentDetails;
};

export function BookingCancelledEmail({ fullName, campaignTitle, details }: BookingCancelledEmailProps) {
  return (
    <EmailLayout preview={`Записването за ${details.date} от ${details.time} е отменено`}>
      <Heading as="h1" style={emailStyles.heading}>
        {campaignTitle}
      </Heading>
      <Text style={emailStyles.text}>Здравейте, {fullName},</Text>
      <Text style={emailStyles.text}>Вашето записване за профилактичен преглед беше отменено.</Text>

      <AppointmentDetailsBlock details={details} />

      <Text style={{ ...emailStyles.text, fontWeight: 600 }}>
        Ако сте добавили прегледа в календара си, моля, изтрийте го.
      </Text>
      <Text style={emailStyles.text}>
        Ако желаете да запишете нов час, използвайте линка за записване, който сте получили от
        работодателя си.
      </Text>
    </EmailLayout>
  );
}
