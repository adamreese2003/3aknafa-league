import Image from "next/image";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto grid min-h-[80vh] max-w-7xl items-center px-4 py-10 sm:px-6 lg:grid-cols-2">
      <div className="relative hidden h-full min-h-[28rem] overflow-hidden rounded-3xl lg:block">
        <Image
          src="/backgrounds/ucl-trophy.jpg"
          alt="Champions League trophy"
          fill
          priority
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/40 to-transparent" />
        <div className="absolute inset-0 bg-pitch-800/30 mix-blend-multiply" />
        <div className="absolute bottom-0 p-10">
          <p className="badge mb-3 border-volt-400/40 text-volt-300">Hall of legends</p>
          <h2 className="heading-display text-3xl text-white">
            Somebody has to lift the trophy.
          </h2>
          <p className="mt-2 max-w-sm text-sm text-white/60">
            Admins record the matches. The league does the math. History decides the rest.
          </p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md lg:px-8">
        <LoginForm />
      </div>
    </div>
  );
}
