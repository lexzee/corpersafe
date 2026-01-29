"use client";

import { sendEmergencyEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

export default function PanicButton({ tripId }: { tripId: string }) {
  const [activating, setActivating] = useState(false);
  const supabase = createClient();

  const triggerPanic = async () => {
    if (!confirm("Are you sure? This will alert security agencies.")) return;

    setActivating(true);

    // // 1. Update Trip Status
    // const { error } = await supabase
    //   .from("trips")
    //   .update({
    //     status: "danger",
    //     last_updated: new Date().toISOString(),
    //   })
    //   .eq("id", tripId);

    // // 2. (Optional) You could trigger an Edge Function here to send SMS
    // // await supabase.functions.invoke('send-sms-alert', { body: { tripId } })

    // if (error) {
    //   alert("Network Error: Keep pressing!");
    //   setActivating(false);
    // }

    try {
      await supabase
        .from("trips")
        .update({
          status: "danger",
          last_updated: new Date().toISOString(),
        })
        .eq("id", tripId);

      // GEt Info
      const { data: trip } = await supabase
        .from("trips")
        .select("*, profiles(full_name, next_of_kin_email)")
        .eq("id", tripId)
        .single();

      // Send Email
      if (trip && trip.profiles?.next_of_kin_email) {
        const link = `${window.location.origin}/track?code=${trip.tracking_code}`;

        const res = await sendEmergencyEmail(
          trip.id,
          trip.profiles.next_of_kin_email,
          trip.profiles.full_name,
          link,
          trip.plate_number,
        );
        if (res.success) {
          console.log("Email Sent Successfully");
          alert("Email Alert Sent!");
        } else {
          console.error(res.error);
          alert("Failed to send Email Alert: " + res.error);
        }
      } else {
        alert("Alert Status Updated (No Kin Email found).");
      }
    } catch (e) {
      console.error(e);
      alert("Error sending alert");
    } finally {
      setActivating(false);
    }
  };

  return (
    <button
      onClick={triggerPanic}
      disabled={activating}
      className="fixed bottom-6 right-6 z-50 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full p-6 shadow-2xl border-4 border-destructive-foreground/30 animate-pulse active:scale-95 transition-transform flex flex-col items-center justify-center disabled:bg-muted disabled:border-border disabled:animate-none"
    >
      {activating ? (
        <Loader2 className="animate-spin" size={32} />
      ) : (
        <>
          <AlertTriangle size={32} />
          <span className="text-xs font-black uppercase mt-1">SOS</span>
        </>
      )}
    </button>
  );
}
