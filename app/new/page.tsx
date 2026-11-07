import type { Metadata } from "next";
import { CreateForm } from "./create-form";

export const metadata: Metadata = {
  title: "Set up dinner",
};

export default function CreatePage() {
  return <CreateForm />;
}
