import { SignUpForm } from "@/components/sign-up-form";
import { Suspense } from "react";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {/* Suspense is required because SignUpForm reads URL search params */}
        <Suspense>
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}
