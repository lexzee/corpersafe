import { createClient } from "./supabase/client";
import emailjs from "@emailjs/browser";

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
// Optional reply-to shown in the SOS email template. Configure per
// deployment — this must NOT impersonate the NYSC Directorate.
const REPLY_TO = process.env.NEXT_PUBLIC_EMAILJS_REPLY_TO;

export const sendEmergencyEmail = async (
  tripId: string,
  recipientEmail: string,
  pcmName: string,
  trackingLink: string,
  plateNumber: string,
) => {
  // Best-effort: failures are reported to the caller and alert_logs
  const supabase = createClient();

  // Guard: these run in the browser, so misconfiguration produces an
  // actionable error instead of a silent EmailJS failure.
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    const error =
      "Email service is not configured (missing NEXT_PUBLIC_EMAILJS_* environment variables).";
    console.error(error);

    await supabase.from("alert_logs").insert({
      trip_id: tripId,
      recipient_contact: recipientEmail,
      message_body: error,
      status: "failed",
      provider_id: "emailjs",
    });

    return { success: false, error };
  }

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
        ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
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
    console.error("Email Error:", e);

    await supabase.from("alert_logs").insert({
      trip_id: tripId,
      recipient_contact: recipientEmail,
      message_body: "Failed: " + e.text,
      status: "failed",
    });

    return { success: false, error: e };
  }
};
