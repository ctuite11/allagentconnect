import Footer from "@/components/Footer";
import { Seo } from "@/components/Seo";
import { SoroBlogEmbed } from "@/components/blog/SoroBlogEmbed";

export default function Blog() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Blog | All Agent Connect"
        description="Insights and updates for real estate professionals on All Agent Connect."
        canonical="https://allagentconnect.com/blog"
        brandType="aac"
      />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-12">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Blog</h1>
            <p className="mt-1 text-sm text-neutral-600">Insights and updates from All Agent Connect.</p>
          </header>
          <SoroBlogEmbed />
        </div>
      </main>
      <Footer />
    </div>
  );
}
