"use client";
import { useState, useEffect } from "react";
import { User, Phone, Mail, ArrowLeft, Save, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useRouter } from "next/navigation";
import { User as UserType } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ProfileContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    next_of_kin: "",
    next_of_kin_email: "",
  });

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUser(user);
      else router.push("/auth/login");
      setLoading(false);
    };

    fetchUser();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          setFormData({
            full_name: data.full_name || "",
            phone: data.phone || "",
            next_of_kin: data.next_of_kin || "",
            next_of_kin_email: data.next_of_kin_email || "",
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          next_of_kin: formData.next_of_kin,
          next_of_kin_email: formData.next_of_kin_email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) throw error;

      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setMessage({
        type: "error",
        text: "Failed to update profile. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-foreground">
              Profile Settings
            </h1>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Details Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                <User size={16} className="text-primary" /> Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Your Name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="080..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                <Phone size={16} className="text-primary" /> Emergency Contact
                (Next of Kin)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-500/10 p-3 rounded-lg text-xs text-yellow-600 dark:text-yellow-400 mb-2 border border-yellow-500/20">
                This person will receive alerts if you press the Panic Button.
                Ensure details are correct.
              </div>
              <div className="grid gap-2">
                <Label htmlFor="next_of_kin">Next of Kin Phone</Label>
                <Input
                  id="next_of_kin"
                  type="tel"
                  name="next_of_kin"
                  value={formData.next_of_kin}
                  onChange={handleChange}
                  placeholder="Parent/Guardian Phone"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="next_of_kin_email">Next of Kin Email</Label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-3 text-muted-foreground"
                    size={18}
                  />
                  <Input
                    id="next_of_kin_email"
                    type="email"
                    name="next_of_kin_email"
                    value={formData.next_of_kin_email}
                    onChange={handleChange}
                    className="pl-10"
                    placeholder="parent@example.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feedback Message */}
          {message.text && (
            <div
              className={`p-4 rounded-lg text-sm font-medium text-center ${
                message.type === "success"
                  ? "bg-green-500/10 text-green-600 border border-green-500/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Save Button */}
          <Button
            type="submit"
            disabled={saving}
            className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20"
          >
            {saving ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              <Save size={20} className="mr-2" />
            )}
            Save Changes
          </Button>
        </form>
      </main>
    </div>
  );
}
