import { Suspense } from "react";
import TrackPageContent from "./pageContent";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full justify-center">
      <div className="w-full">
        <Suspense fallback={<div>Loading...</div>}>
          <TrackPageContent />
        </Suspense>
      </div>
    </div>
  );
}
