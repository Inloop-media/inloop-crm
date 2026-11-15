"use client";
// Amigo keeps its conversation in this device's storage, so it renders in the browser only.
import dynamic from "next/dynamic";

const Amigo = dynamic(() => import("@/components/Amigo"), {
  ssr: false,
  loading: () => <div className="h-[calc(100svh-9.5rem)] min-h-[520px] animate-pulse rounded-[24px] bg-panel-2 md:h-[calc(100svh-13rem)]" />,
});

export default function AmigoLoader(props) {
  return <Amigo {...props} />;
}
