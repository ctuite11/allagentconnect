import Footer from "@/components/Footer";

export default function Contact() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">Contact DCMLS</h1>
          <p className="mt-6 text-base text-muted-foreground leading-7">
            Have a question about listings, agent matching, or your account?
          </p>
          <p className="mt-4 text-base text-muted-foreground leading-7">
            Reach us at support@directconnectmls.com and our team will get back to you.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
