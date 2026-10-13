import type { Metadata } from "next";

import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = {
  title: "Private",
};

export default function SettingsPage() {
  return <SettingsView />;
}
