import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          Join Rousi Book Club
        </h1>
        <SignUp 
          appearance={{
            elements: {
              formButtonPrimary: 
                "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
            },
          }}
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
} 