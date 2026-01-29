import { createClient } from "./supabase/client";
import emailjs from "@emailjs/browser";

const SERVICE_ID = process.env.NEXT_EMAILJS_SERVICE_ID!;
const TEMPLATE_ID = process.env.NEXT_EMAILJS_TEMPLATE_ID!;
const PUBLIC_KEY = process.env.NEXT_EMAILJS_PUBLIC_KEY!;

export const sendEmergencyEmail = async (
  tripId: string,
  recipientEmail: string,
  pcmName: string,
  trackingLink: string,
  plateNumber: string,
) => {
  console.log(`Sending Email to ${recipientEmail}...`);
  const supabase = createClient();

  try {
    emailjs.init(PUBLIC_KEY);
    const res = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: recipientEmail,
        pcm_name: pcmName,
        plate_number: plateNumber,
        tracking_link: trackingLink,
        reply_to: "support@nysc.gov.ng",
      },
      // PUBLIC_KEY
    );

    if (res.status !== 200) throw new Error("EmailJS Failed");

    await supabase.from("alert_logs").insert({
      trip_id: tripId,
      recipient_contact: recipientEmail,
      message_body: "SOS Email Sent",
      status: "sent",
      provider_id: "emailjs",
    });

    return { success: true };
  } catch (e: any) {
    console.log("Email Error: ", e);

    await supabase.from("alert_logs").insert({
      trip_id: tripId,
      recipient_contact: recipientEmail,
      message_body: "Failed: " + e.text,
      status: "failed",
    });

    return { success: false, error: e };
  }
};
