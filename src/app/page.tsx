import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  
  // If user is logged in, redirect to dashboard, otherwise to sign-in
  if (userId) {
    redirect("/dashboard");
  } else {
    redirect("/sign-in");
  }
}
