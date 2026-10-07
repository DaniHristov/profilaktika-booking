import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Админ панел",
};

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Админ панел</h1>
      <p className="text-base text-muted-foreground">
        Разделите за кампании, часове и записвания предстоят.
      </p>
    </div>
  );
}
