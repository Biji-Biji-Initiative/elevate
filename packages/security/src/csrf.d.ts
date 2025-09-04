import { NextRequest, NextResponse } from 'next/server';
export declare const CSRF_TOKEN_HEADER = "X-CSRF-Token";
export declare const CSRF_COOKIE_NAME = "_csrf";
export declare const CSRF_SECRET_HEADER = "X-CSRF-Secret";
interface CsrfConfig {
    cookieName?: string;
    headerName?: string;
    tokenLength?: number;
    maxAge?: number;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    ignoreMethods?: string[];
}
export declare class CSRFError extends Error {
    readonly name = "CSRFError";
    readonly status = 403;
    constructor(message?: string);
}
export declare class CSRFManager {
    private config;
    constructor(config?: CsrfConfig);
    /**
     * Generates a cryptographically secure random token
     */
    generateToken(): string;
    /**
     * Creates a double-submit token pair (secret + token)
     * The secret is stored in httpOnly cookie, token is returned for forms
     */
    generateTokenPair(): {
        secret: string;
        token: string;
    };
    /**
     * Creates a token that includes both secret and token for single-value usage
     */
    generateSingleToken(): string;
    /**
     * Validates a token pair using double-submit cookie pattern
     */
    validateTokenPair(secret: string, token: string): boolean;
    /**
     * Validates a single token (includes both secret and token)
     */
    validateSingleToken(singleToken: string): boolean;
    /**
     * Sets CSRF cookie in response
     */
    setCsrfCookie(response: NextResponse, secret: string): void;
    /**
     * Gets CSRF cookie from request
     */
    getCsrfCookie(request: NextRequest): string | null;
    /**
     * Gets CSRF token from request headers or form data
     */
    getCsrfToken(request: NextRequest): Promise<string | null>;
    /**
     * Validates CSRF token against cookie
     */
    validateRequest(request: NextRequest): Promise<boolean>;
    /**
     * Middleware function for automatic CSRF protection
     */
    middleware(): (request: NextRequest) => Promise<NextResponse | null>;
    /**
     * Generates a new CSRF token for forms
     * Can be called from API routes or Server Components
     */
    generateTokenForResponse(): Promise<{
        token: string;
        response: NextResponse;
    }>;
}
export declare const csrfManager: CSRFManager;
/**
 * Server-side function to generate CSRF token for forms
 * Use this in Server Components or API routes
 */
export declare function generateCSRFToken(): Promise<string>;
/**
 * Higher-order function to protect API routes with CSRF validation
 */
export declare function withCSRFProtection<T extends any[]>(handler: (request: NextRequest, ...args: T) => Promise<NextResponse>): (request: NextRequest, ...args: T) => Promise<NextResponse>;
/**
 * Utility function to check if request needs CSRF protection
 */
export declare function requiresCSRFProtection(request: NextRequest): boolean;
/**
 * Extract CSRF token from various sources in request
 */
export declare function extractCSRFToken(request: NextRequest): Promise<string | null>;
/**
 * Validate CSRF token manually
 */
export declare function validateCSRFToken(request: NextRequest): Promise<boolean>;
export {};
//# sourceMappingURL=csrf.d.ts.map