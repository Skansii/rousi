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

  return (
    <main>
      {/* ... existing content ... */}
      
      {/* Add at the bottom of the main component */}
      <div className="mt-8 p-4 bg-gray-100 rounded text-center">
        <p className="text-gray-600 text-sm">Development Links:</p>
        <a 
          href="/debug/books" 
          className="text-blue-600 hover:underline text-sm"
        >
          Debug Books Page
        </a>
      </div>
    </main>
  );
}
