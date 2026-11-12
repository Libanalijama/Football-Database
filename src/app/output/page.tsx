import { Suspense } from "react";
import { Output } from "@/components/Output";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Output />
    </Suspense>
  );
}
