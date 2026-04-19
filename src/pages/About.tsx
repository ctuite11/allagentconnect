import Footer from "@/components/Footer";

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">About DCMLS</h1>
          <p className="mt-6 text-base text-muted-foreground leading-7">
            DCMLS is a consumer-facing real estate marketplace experience built on trusted agent collaboration.
          </p>
          <p className="mt-4 text-base text-muted-foreground leading-7">
            We connect buyers and sellers with verified professionals while preserving high-quality listing intelligence,
            communication, and matching workflows.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
