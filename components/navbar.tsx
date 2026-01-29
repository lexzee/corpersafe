"use client";

import { History, Navigation, User } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "./theme-switcher";

export function UserNavbar({
  status,
  currentLoc,
}: {
  status: string;
  currentLoc: number[];
}) {
  const router = useRouter();
  return (
    <div className="bg-primary text-primary-foreground p-4 shadow-lg">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-primary-foreground/20 p-2 rounded-full">
            <Navigation
              size={20}
              className={status === "active" ? "animate-pulse" : ""}
            />
          </div>
          <div>
            <h1 className="font-bold text-sm">Monitoring</h1>
            <p className="text-[10px] text-primary-foreground/80">
              GPS: {currentLoc[0].toFixed(4)}, {currentLoc[1].toFixed(4)}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <Button variant={"ghost"} onClick={() => router.push("/history")}>
            <History size={20} />
          </Button>
          <Button variant={"ghost"} onClick={() => router.push("/profile")}>
            <User size={20} />
          </Button>
          <ThemeSwitcher />
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
