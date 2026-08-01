"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle,
  Loader2,
  MapPin,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "./ui/combobox";
import { InputGroupAddon } from "./ui/input-group";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// allowed_states rows: the camp's host state + its display name
type StateOption = { state: string; campName: string };
// Base UI needs to know how to render the selected object into the input —
// without itemToStringLabel it stringifies the object ("[object Object]")
const stateToInputText = (item: StateOption) => item.state;

export function RegisterTripForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState<any>(null);
  const [nextOfKin, setNextOfKin] = useState("");
  const [nextOfKinEmail, setNextOfKinEmail] = useState("");
  const [institution, setInstitution] = useState("");

  const [step, setStep] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [startCoords, setStartCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [stateList, setStateList] = useState<StateOption[]>([]);
  const [schoolList, setSchoolList] = useState<
    { category: string; items: string[] }[]
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch User
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUser(user);

      // Pre-fill the emergency contact from the profile (captured at signup
      // or edited in Profile Settings), so it doesn't have to be typed again.
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("next_of_kin, next_of_kin_email")
          .eq("id", user.id)
          .single();
        if (profile) {
          setNextOfKin(profile.next_of_kin || "");
          setNextOfKinEmail(profile.next_of_kin_email || "");
        }
      }

      // Fetch States
      const { data: states } = await supabase
        .from("allowed_states")
        .select("state, campName")
        .order("state");
      if (states) setStateList(states);

      // Fetch Schools
      const { data: schools } = await supabase
        .from("allowed_institutions")
        .select("*")
        .order("name");
      if (schools) {
        // setSchoolList(schools)
        const universities = schools.filter((s) => s.category === "University");
        const polytechnics = schools.filter(
          (s) => s.category === "Polytechnic",
        );
        const other = schools.filter((s) => s.category === "Other");
        setSchoolList([
          { category: "Universities", items: universities.map((s) => s.name) },
          { category: "Polytechnics", items: polytechnics.map((s) => s.name) },
          { category: "Other", items: other.map((s) => s.name) },
        ]);
      }
    };
    fetchData();
  }, []);

  // Auto detect location
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setDetecting(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setStartCoords({ lat: latitude, lng: longitude });

        try {
          // Reverse Geocode to get State Name
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          );
          const data = await res.json();

          // Construct a readable string (e.g. "Lagos, Nigeria")
          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.county ||
            data.address.suburb ||
            "";
          const state = data.address.state;
          const address = [city, state].filter(Boolean).join(", ");

          setOrigin(address);
        } catch (err) {
          console.error("Geocoding failed", err);
          // Fallback if API fails
          setOrigin(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        console.error(err);
        setError("Unable to retrieve location. Please enter it manually.");
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleTripRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!user) {
      setError("User not authenticated");
      setIsLoading(false);
      return;
    }

    const userId = user.id;

    try {
      // Save next-of-kin onto the profile. If the profile row doesn't
      // exist yet (e.g. no handle_new_user trigger in this project), the
      // trips insert below would fail its pcm_id foreign key (409), so
      // create the row from the auth metadata as a fallback. The insert is
      // ignore-duplicates: if the row exists but the UPDATE was blocked by
      // a broken RLS policy, we don't fight it — the SQL migration fixes
      // the policies properly.
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update({
          next_of_kin: nextOfKin,
          next_of_kin_email: nextOfKinEmail,
        })
        .eq("id", userId)
        .select("id");

      if (profileError) {
        console.warn("Profile update error:", profileError);
      }

      if (profileError || !updatedProfile || updatedProfile.length === 0) {
        const { error: insertError } = await supabase.from("profiles").upsert(
          {
            id: userId,
            full_name: user.user_metadata?.full_name || "",
            phone: user.user_metadata?.phone || "",
            role: "pcm",
            next_of_kin: nextOfKin,
            next_of_kin_email: nextOfKinEmail,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
        if (insertError)
          console.warn("Profile fallback insert error:", insertError);
      }

      const trackingCode = "NYSC-" + Math.floor(10000 + Math.random() * 90000);

      // Leave coordinates null when there is no GPS fix — fabricating a
      // position (e.g. the centre of Nigeria) misleads parents and admins
      // watching the map. The trip starts broadcasting real coordinates
      // from the device once the journey begins.
      const { error: tripError } = await supabase.from("trips").insert({
        pcm_id: userId,
        plate_number: "",
        origin,
        destination_state: destination?.state || "",
        destination_camp: destination?.campName || "",
        institution,
        status: "pending",
        tracking_code: trackingCode,
        current_lat: startCoords?.lat ?? null,
        current_lng: startCoords?.lng ?? null,
      });
      if (tripError) throw tripError;

      router.push("/pcm");
    } catch (e: any) {
      console.error(e.message);
      setError(e.message || "Error creating trip");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center animate-in slide-in-from-top duration-500">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-primary font-bold text-xl mb-2"
          >
            <div className="bg-background p-2 rounded-lg">
              <Shield className="fill-primary text-secondary-foreground w-6 h-6" />
            </div>
            CorperSafe
          </Link>
          <CardTitle className="text-2xl">Register Your Trip</CardTitle>
          <CardDescription>
            Safety monitoring for NYSC deployment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="flex h-1.5 bg-secondary rounded-full">
            <div
              className={`transition-all duration-500 bg-primary rounded-full ${
                step === 1 ? "w-1/2" : "w-full"
              }`}
            ></div>
          </div>

          {/* error rendering */}
          {error && (
            <div className="mb-6 bg-destructive/10 text-destructive p-3 rounded-lg text-sm flex items-center gap-2 border border-destructive/20">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleTripRegister}>
            {/* Step1: Vehicle Verification {future update} */}

            {/* Step 2: Trip Details */}
            {step === 2 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-4">
                  <h2 className="font-bold text-lg">Trip Details</h2>
                  <p className="text-sm text-muted-foreground">
                    Where are you headed?
                  </p>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="origin">Origin / Take-off Point</Label>
                    <div className="flex gap-2">
                      <Input
                        id="origin"
                        type="text"
                        placeholder="e.g. Jibowu Park, Lagos"
                        required
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                      />
                      <Button size={"icon"} onClick={detectLocation}>
                        {detecting ? (
                          <Loader2 className="animate-spin" size={20} />
                        ) : (
                          <MapPin size={20} />
                        )}
                      </Button>
                    </div>
                    {startCoords && (
                      <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle size={10} /> GPS Coordinates captured
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="destination">
                      Destination State (Camp)
                    </Label>
                    <Combobox
                      items={stateList}
                      autoHighlight
                      itemToStringLabel={stateToInputText}
                      itemToStringValue={stateToInputText}
                      onValueChange={(e: StateOption | null) => {
                        setDestination(e);
                      }}
                      filter={(item: StateOption, search: string) =>
                        item.state
                          .toLowerCase()
                          .includes(search.toLowerCase()) ||
                        item.campName.toLowerCase().includes(search.toLowerCase())
                      }
                      required
                      highlightItemOnHover
                      id="destination"
                    >
                      <ComboboxInput
                        placeholder={
                          stateList.length
                            ? "Select Destination Camp"
                            : "Loading destinations…"
                        }
                        disabled={!stateList.length}
                        id="destination"
                        showClear
                      >
                        <InputGroupAddon>
                          <MapPin size={20} />
                        </InputGroupAddon>
                      </ComboboxInput>
                      <ComboboxContent
                        alignOffset={-28}
                        className="w-72 max-h-60 overflow-y-auto"
                      >
                        <ComboboxEmpty>No states found.</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem
                              key={item.state}
                              value={item}
                              className="py-2"
                            >
                              <div className="flex flex-col text-left">
                                <span className="font-bold">{item.state}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.campName}
                                </span>
                              </div>
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="nextOfKin">
                      Next of Kin&apos;s phone (optional)
                    </Label>
                    <Input
                      id="nextOfKin"
                      type="tel"
                      placeholder="Parent/Guardian's phone"
                      value={nextOfKin}
                      onChange={(e) => setNextOfKin(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Pre-filled from your profile — update here if needed.
                      They&apos;ll be alerted if you press the panic button.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="nextOfKinEmail">
                      Next of Kin&apos;s email (optional)
                    </Label>
                    <Input
                      id="nextOfKinEmail"
                      type="email"
                      placeholder="parent@example.com"
                      value={nextOfKinEmail}
                      onChange={(e) => setNextOfKinEmail(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="institution">Graduated Institution</Label>
                    <Combobox
                      items={schoolList}
                      autoHighlight
                      inputValue={institution}
                      onInputValueChange={(e: string | null) =>
                        setInstitution(e || "")
                      }
                      onValueChange={(e: string | null) => {
                        e && setInstitution(e);
                      }}
                      highlightItemOnHover
                      id="institution"
                    >
                      <ComboboxInput
                        placeholder={
                          schoolList.length
                            ? "Select Institution"
                            : "Loading institutions…"
                        }
                        disabled={!schoolList.length}
                      >
                        <InputGroupAddon>
                          <Building2 size={20} />
                        </InputGroupAddon>
                      </ComboboxInput>
                      <ComboboxContent
                        alignOffset={-28}
                        className="w-72 max-h-60 overflow-y-auto"
                      >
                        <ComboboxEmpty>No institutions found.</ComboboxEmpty>
                        <ComboboxList>
                          {(group) => (
                            <ComboboxGroup
                              key={group.category}
                              items={group.items}
                            >
                              <ComboboxLabel>{group.category}</ComboboxLabel>
                              <ComboboxCollection>
                                {(name) => (
                                  <ComboboxItem key={name} value={name}>
                                    {name}
                                  </ComboboxItem>
                                )}
                              </ComboboxCollection>
                            </ComboboxGroup>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Allows your school admin to track you.
                    </p>
                  </div>

                  <div className="flex w-full justify-center gap-3">
                    {/* <Button
                      variant={"secondary"}
                      onClick={() => setStep(1)}
                      className="flex-1"
                    >
                      Back
                    </Button> */}
                    <Button
                      type="submit"
                      variant={"default"}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>
                          Start Journey <ArrowRight size={18} />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
      <div className="text-center">
        <p className="text-muted-foreground">
          Already registered for this trip?
        </p>
        <Link href="/pcm" className="text-primary font-bold hover:underline">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
