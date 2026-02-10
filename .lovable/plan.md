

# License Upload for Rejected Agents

## Overview

When an agent's license can't be verified, they'll see a clear message explaining why, with the option to upload a copy of their license directly. Admins will see when a rejected agent has uploaded a document, making re-review easy.

## What Gets Built

### 1. Database and Storage Setup

- **New table**: `agent_license_uploads` to track each uploaded file (who uploaded it, file location, review status, admin notes)
- **New private storage bucket**: `agent-license-docs` for the actual files
- **Security rules**: Agents can only upload/view their own files. Admins can see and update everything.

### 2. Rejected Agent Experience (PendingVerification page)

When an agent's status is "rejected":
- Polling stops (no need to keep checking)
- They see a clear message: "We couldn't verify your license"
- Explanation of common reasons (name mismatch, expired, lookup issue)
- A drag-and-drop style upload area for JPG, PNG, or PDF (max 10MB)
- After upload: confirmation message saying "License received -- we'll review it shortly"
- If they already uploaded previously, they see the confirmation right away

### 3. Updated Rejection Email

The rejection email currently just says "reply to this email." The updated version:
- Keeps the same explanation of why verification failed
- Adds an "Upload Your License" button linking back to the app
- Matches the approved email's premium template design (globe header, branded CTA button)
- Still includes the "reply to this email" option as a fallback

### 4. Admin Visibility

On the Admin Approvals page, rejected agents who have uploaded a license document will show a small "License uploaded" indicator next to their name, so admins know to re-review.

## Files Changed

| File | What Changes |
|------|-------------|
| New migration SQL | Creates `agent_license_uploads` table, `agent-license-docs` bucket, and security policies |
| `src/pages/PendingVerification.tsx` | Adds rejected state detection, file upload UI, and upload-complete confirmation |
| `supabase/functions/send-agent-approval-email/index.ts` | Updates `buildRejectedHtml()` with premium template and "Upload Your License" CTA |
| `src/pages/AdminApprovals.tsx` | Adds license-uploaded indicator for rejected agents |

## What Does NOT Change

- Approval flow (already working)
- Authentication system
- Other email templates
- Existing agent statuses

