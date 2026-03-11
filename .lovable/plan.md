

## Replace Hero Placeholder with Uploaded Agent Photo

The uploaded image is a professional photo of an agent working on a laptop in a dark blue-paneled room — this is the hero image asset for the Home page.

### Changes

**Copy asset**
- Copy `user-uploads://1d211dd3ac54b1483519e8feeec3108e171c6c53.jpg` to `src/assets/hero-agent.jpg`

**`src/pages/Home.tsx`**
- Import the hero image: `import heroAgent from "@/assets/hero-agent.jpg"`
- Replace the placeholder div (lines 93-99) with an `<img>` tag using the imported asset, styled with `object-cover rounded-3xl aspect-[4/5]`

### Also fix pre-existing build errors

**`src/components/PropertyMap.tsx`**
- Add `declare global { interface Window { google: any } }` or use `(window as any).google`
- Use proper type assertions for google maps references

**`src/pages/AuthCallback.tsx`** and **`src/pages/PendingVerification.tsx`**
- Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>`

