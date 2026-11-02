import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap max-w-xl py-24">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-5xl font-extrabold">This road doesn&apos;t go anywhere.</h1>
      <p className="mt-4 text-lg text-base-content/70">The page you were looking for isn&apos;t here.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/report" className="btn btn-primary">
          Report an emergency
        </Link>
        <Link href="/" className="btn">
          Home
        </Link>
      </div>
    </div>
  );
}
