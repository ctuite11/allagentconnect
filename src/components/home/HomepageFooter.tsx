import VersionStamp from "@/components/VersionStamp";

export default function HomepageFooter() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-sm font-semibold tracking-tight">
              <span className="text-white">All Agent</span>{" "}
              <span className="text-zinc-500">Connect</span>
            </span>
            <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
              Professional agent collaboration infrastructure for off-market opportunities and private matching.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li><a href="/register" className="hover:text-zinc-300 transition-colors">Request Access</a></li>
              <li><a href="/our-agents" className="hover:text-zinc-300 transition-colors">Our Agents</a></li>
              <li><a href="/browse" className="hover:text-zinc-300 transition-colors">Browse Properties</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li><a href="/our-agents" className="hover:text-zinc-300 transition-colors">Our Story</a></li>
              <li><a href="/our-agents" className="hover:text-zinc-300 transition-colors">Agents</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li><a href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</a></li>
              <li><a href="/agent-rules" className="hover:text-zinc-300 transition-colors">Agent Network Rules</a></li>
              <li><a href="/fair-housing" className="hover:text-zinc-300 transition-colors">Fair Housing</a></li>
              <li><a href="/disclosures" className="hover:text-zinc-300 transition-colors">Disclosures</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-4">Contact</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li>
                <a href="mailto:hello@allagentconnect.com" className="hover:text-zinc-300 transition-colors">
                  hello@allagentconnect.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-800 mb-6">
          <p className="text-xs text-zinc-600 text-center max-w-3xl mx-auto">
            This platform is not a multiple listing service and is not affiliated with any MLS or REALTOR® association.
            Certain platform features are protected by issued and pending U.S. patents. Unauthorized use is prohibited.
          </p>
        </div>

        <div className="pt-4 border-t border-zinc-800 text-center">
          <p className="text-sm text-zinc-600">© {new Date().getFullYear()} All Agent Connect. All rights reserved.</p>
          <VersionStamp className="mt-2 opacity-40" />
        </div>
      </div>
    </footer>
  );
}
