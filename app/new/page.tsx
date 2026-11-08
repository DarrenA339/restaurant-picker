import type { Metadata } from "next";
import { CreateForm } from "./create-form";

export const metadata: Metadata = {
  title: "Set up a meal",
};

export default function CreatePage() {
  return <CreateForm />;
}
