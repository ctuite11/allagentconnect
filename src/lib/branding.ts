/**
 * Branding utilities for AAC vs DCMLS route detection and dynamic branding
 */

import { isDcmlsHost } from "@/lib/host";

export type BrandType = 'aac' | 'dcmls';

export interface BrandConfig {
  name: string;
  title: string;
  favicon: string;
  themeColor: string;
  description: string;
  siteName: string;
  siteUrl: string;
  ogImage: string;
}

export const AAC_BRAND: BrandConfig = {
  name: 'aac',
  title: 'All Agent Connect',
  favicon: '/aac-monogram-green.svg',
  themeColor: '#22c55e', // green-500
  description: 'All Agent Connect is a professional collaboration platform for real estate agents to connect, share listings, manage buyers, and close deals faster.',
  siteName: 'All Agent Connect',
  siteUrl: 'https://allagentconnect.com',
  ogImage: 'https://allagentconnect.com/og-image.jpg?v=20260902',
};

export const DCMLS_BRAND: BrandConfig = {
  name: 'dcmls',
  title: 'Direct Connect MLS',
  favicon: '/dcmls-favicon.svg', // Need to create this
  themeColor: '#0E56F5', // blue-600
  description: 'A private, high-end real estate experience for homebuyers and sellers with pre-market access and expert agent connections.',
  siteName: 'Direct Connect MLS',
  siteUrl: 'https://directconnectmls.com',
  ogImage: 'https://directconnectmls.com/og-image.jpg',
};

const AGENT_DIRECTORY_ROUTES = ["/our-agents", "/agents", "/find-agent"];

/**
 * Public agent directory — DCMLS branding only on the DCMLS consumer host.
 */
function isAgentDirectoryRoute(pathname: string): boolean {
  return AGENT_DIRECTORY_ROUTES.includes(pathname);
}

/**
 * Routes that are considered DCMLS consumer-facing
 */
const DCMLS_ROUTES = [
  "/browse",
  "/search",
  "/consumer-property",
  "/consumer",
];

/** Shared paths whose brand follows the active hostname (AAC vs DCMLS). */
const HOST_BRANDED_ROUTES = ["/", "/homepage-v2"];

/**
 * Routes that are considered AAC agent-facing
 */
const AAC_ROUTES = [
  '/agent-dashboard',
  '/agent',
  '/success-hub',
  '/messages',
  '/communications',
  '/client',
  '/admin',
  '/auth',
  '/register',
  '/pending-verification',
  '/password-reset',
  '/agent-setup',
  '/seller',
  '/vendor',
  '/network',
  '/listing-search',
  '/listing-results',
  '/listing-intel',
  '/client-needs',
  '/hot-sheets',
  '/my-clients',
  '/showing-requests',
  '/favorites',
  '/my-favorites',
  '/analytics',
  '/market-insights',
  '/manage-team',
  '/manage-coverage-areas',
  '/add-rental-listing',
  '/our-members',
  '/members',
  '/agent-search',
];

/**
 * Determine if a route path is DCMLS consumer-facing
 */
export function isDcmlsRoute(pathname: string): boolean {
  if (isAgentDirectoryRoute(pathname)) {
    return isDcmlsHost();
  }

  if (HOST_BRANDED_ROUTES.includes(pathname)) {
    return isDcmlsHost();
  }

  // Exact matches
  if (DCMLS_ROUTES.includes(pathname)) return true;

  // Prefix matches for DCMLS routes
  return DCMLS_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Determine if a route path is AAC agent-facing
 */
export function isAacRoute(pathname: string): boolean {
  // Exact matches
  if (AAC_ROUTES.includes(pathname)) return true;

  // Prefix matches for AAC routes
  return AAC_ROUTES.some(route =>
    route !== '/' && pathname.startsWith(route)
  );
}

/**
 * Get the appropriate brand config for a route
 */
export function getBrandForRoute(pathname: string): BrandConfig {
  if (isDcmlsRoute(pathname)) {
    return DCMLS_BRAND;
  }
  return AAC_BRAND; // Default to AAC for agent/auth routes
}

/**
 * Get the brand type for a route
 */
export function getBrandType(pathname: string): BrandType {
  return isDcmlsRoute(pathname) ? 'dcmls' : 'aac';
}