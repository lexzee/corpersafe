"use client";

import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";
import { useState, useEffect, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CheckCircle,
  History,
  Lock,
  Menu,
  Navigation,
  Radio,
  Search,
  Shield,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const redirect = useRouter();
  const [trackCode, setTrackCode] = useState("");
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  const handleTrack = () => {
    if (trackCode.trim() !== "") {
      redirect.push(`/track?code=${trackCode.trim()}`);
    }
  };

  return (
    <main className="scroll-smooth">
      {/* --- Navigation --- */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl tracking-tight text-primary">
                CorperSafe
              </span>
              <ThemeSwitcher />
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-muted-foreground hover:text-primary font-medium text-sm"
              >
                Features
              </a>
              <Link
                href="/track"
                className="text-muted-foreground hover:text-primary font-medium text-sm"
              >
                For Parents
              </Link>
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Register Trip</Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-muted-foreground"
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden bg-background border-t p-4 space-y-4 shadow-lg animate-in slide-in-from-top-5 absolute w-full z-50">
            <a
              href="#features"
              onClick={() => setIsMenuOpen(false)}
              className="block text-muted-foreground font-medium p-2 hover:bg-accent rounded"
            >
              Features
            </a>
            <a
              href="#roles"
              onClick={() => setIsMenuOpen(false)}
              className="block text-muted-foreground font-medium p-2 hover:bg-accent rounded"
            >
              For Parents
            </a>
            <Button variant="ghost" asChild className="w-full justify-start">
              <Link href="/auth/login" onClick={() => setIsMenuOpen(false)}>
                Login
              </Link>
            </Button>
            <Button asChild className="w-full">
              <Link href="/register" onClick={() => setIsMenuOpen(false)}>
                Start Journey
              </Link>
            </Button>
          </div>
        )}
      </nav>

      {/* --- Hero Section --- */}
      <div className="relative overflow-hidden bg-secondary pt-16 pb-24 lg:pt-32">
        {/* BG Decor */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 opacity-10">
          <svg
            width="400"
            height="400"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="hsl(var(--primary))"
              d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.2,-19.2,95.8,-5.3C93.5,8.6,82.1,21.5,70.6,32.4C59.1,43.3,47.6,52.2,35.4,60.2C23.2,68.2,10.3,75.3,-1.8,78.4C-13.9,81.5,-25.2,80.6,-36.5,75.2C-47.8,69.8,-59.1,59.9,-68.5,48.1C-77.9,36.3,-85.4,22.6,-86.4,8.4C-87.4,-5.8,-81.9,-20.5,-73.2,-32.9C-64.5,-45.3,-52.6,-55.4,-39.9,-63.2C-27.2,-71,-13.6,-76.5,0.7,-77.7C15,-78.9,30.5,-75.7,44.7,-76.4Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left animate-in slide-in-from-left duration-700">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-primary/20">
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
                Active Nationwide
              </div>
              <h1 className="text-4xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6">
                Travel to Camp, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Arrive Safely.
                </span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0">
                The official safety companion for NYSC Corps Members. Verify
                vehicles instantly, share your live location, and get rapid
                response in emergencies.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" asChild>
                  <Link href="/register">
                    <Navigation />
                    Start a Trip
                  </Link>
                </Button>

                {/* Tracking */}
                <div className="relative w-full sm:w-auto group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input
                    type="text"
                    value={trackCode}
                    onChange={(e) => setTrackCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                    placeholder="Enter Tracking ID..."
                    className="w-full sm:w-64 pl-10 pr-20 py-4 rounded-xl border-2 focus:border-primary uppercase font-mono transition-all group-hover:border-muted-foreground"
                  />
                  <Button
                    variant="secondary"
                    className="absolute right-2 top-2 bottom-2"
                    onClick={handleTrack}
                  >
                    Track
                  </Button>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground font-medium">
                <span className="flex items-center gap-1">
                  <Lock size={14} className="text-primary" /> Secure Data
                </span>
                <span className="flex items-center gap-1">
                  <Shield size={14} className="text-primary" />
                  Verified Transport
                </span>
              </div>
            </div>

            {/* Right Visual (Mockup) */}
            <div className="relative hidden lg:block animate-in slide-in-from-right duration-700">
              <Card className="max-w-md mx-auto transform rotate-2 hover:rotate-0 transition duration-500">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                      <Radio className="text-primary" />
                    </div>
                    <div>
                      <CardTitle>Status: Active</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">
                        LAG-821-XY • 45 km/h
                      </p>
                    </div>
                    <div className="ml-auto">
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-secondary rounded-2xl h-48 w-full mb-4 relative overflow-hidden group border">
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage:
                          "radial-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                      }}
                    ></div>

                    <svg
                      className="absolute inset-0 w-full h-full"
                      style={{
                        stroke: "hsl(var(--primary))",
                        strokeWidth: 3,
                        fill: "none",
                        strokeLinecap: "round",
                      }}
                    >
                      <path
                        d="M 50 150 Q 150 100 250 50"
                        strokeDasharray="5, 5"
                      />
                    </svg>

                    <div className="absolute top-1/4 left-2/3 transform -translate-x-1/2 -translate-y-1/2 animate-bounce">
                      <div className="bg-primary text-primary-foreground p-2 rounded-full shadow-lg border-2 border-background">
                        <Navigation size={20} fill="currentColor" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary p-3 rounded-xl border">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        Vehicle
                      </p>
                      <p className="font-bold text-sm flex items-center gap-1">
                        Verified{" "}
                        <CheckCircle size={14} className="text-primary" />
                      </p>
                    </div>
                    <div className="bg-secondary p-3 rounded-xl border">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        ETA to Camp
                      </p>
                      <p className="font-bold text-sm">14:30 PM</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* --- Features Section --- */}
      <div id="features" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
              Safety at Every Mile
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              We combine simple user tools with sophisticated backend monitoring
              to ensure you are never truly alone on the road.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                icon: <CheckCircle className="w-8 h-8 text-primary" />,
                title: "Vehicle Registry",
                desc: "Don't board blindly.Verify the plate number against our national transport database before you enter.",
              },
              {
                icon: <Radio className="w-8 h-8 text-blue-600" />,
                title: "Live Tracking",
                desc: "Rea-time GPS updates. Parents can watch your movement on a map without needing an account.",
              },
              {
                icon: <BellRing className="w-8 h-8 text-destructive" />,
                title: "Instant Alerts",
                desc: "One-tap SOS triggers emails to your Next of Kin and flashes red on the State Admin's dashboard.",
              },
              {
                icon: <History className="w-8 h-8 text-destructive" />,
                title: "Trip History",
                desc: "Keep a log of all your journeys. Replay your exact route on a map to show family where you went",
              },
            ].map((feature, idx) => (
              <Card
                key={idx}
                className="hover:shadow-xl transition duration-300 group"
              >
                <CardHeader>
                  <div className="mb-4 bg-background w-14 h-14 rounded-xl flex items-center justify-center shadow-sm border group-hover:scale-110 transition">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* --- Role Selection (Audience) --- */}
      <div
        id="roles"
        className="py-24 bg-secondary text-foreground relative overflow-hidden"
      >
        {/* BG Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "radia-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        ></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: PCM */}
            <Card className="bg-background relative overflow-hidden group hover:border-primary/50 transition duration-300">
              <div className="absolute top-0 right-0 bg-primary w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-10 group-hover:opacity-20 transition"></div>
              <CardHeader>
                <Navigation className="w-10 h-10 text-primary mb-6" />
                <CardTitle>Prospective Corps Members</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Traveling to camp? Register your trip, verify your driver, and
                  share your live location link.
                </p>
                <Button variant="link" asChild>
                  <Link href="/register">
                    Start Here <ArrowRight className="ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Card 2: Family */}
            <Card className="bg-background relative overflow-hidden group hover:border-blue-500/50 transition duration-300">
              <div className="absolute top-0 right-0 bg-blue-600 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-10 group-hover:opacity-20 transition"></div>
              <CardHeader>
                <Users className="w-10 h-10 text-blue-400 mb-6" />
                <CardTitle>Parents & Guardians</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  Worried about your child? Use their unique Tracking ID to
                  monitor their journey on a map.
                </p>
                <Button
                  variant="link"
                  asChild
                  className="text-blue-400 hover:text-blue-300"
                >
                  <Link href="/track">
                    Track Now <ArrowRight className="ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Card 3: Admin */}
            <Card className="bg-background relative overflow-hidden group hover:border-amber-500/50 transition duration-300">
              <div className="absolute top-0 right-0 bg-amber-600 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-10 group-hover:opacity-20 transition"></div>
              <CardHeader>
                <Shield className="w-10 h-10 text-amber-400 mb-6" />
                <CardTitle>Security & Admins</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  State Coordinators, School Admins, and Security agencies
                  portal for monitoring active trips.
                </p>
                <Button
                  variant="link"
                  asChild
                  className="text-amber-400 hover:text-amber-300"
                >
                  <Link href="/auth/login?role=admin">
                    Access Portal <ArrowRight className="ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* --- Footer --- */}
      <footer className="bg-background text-muted-foreground py-12 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-foreground tracking-tight">
              CorperSafe
            </span>
          </div>
          <div className="text-sm text-center md:text-right">
            <p>&copy; {year && year} CorperSafe Initiative.</p>
            <p className="mt-1 opacity-50 text-xs">
              Built for National Safety • Independently Developed • Not
              affiliated with the NYSC Directorate
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
