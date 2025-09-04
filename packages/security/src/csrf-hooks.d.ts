/**
 * React hook for managing CSRF tokens in client components
 */
export declare function useCSRFToken(): {
    token: any;
    loading: any;
    error: any;
    refreshToken: any;
};
/**
 * React hook for making CSRF-protected API requests
 */
export declare function useCSRFProtectedFetch(): {
    csrfFetch: any;
    token: any;
    loading: any;
    error: any;
    refreshToken: any;
};
/**
 * Enhanced form submission hook with built-in CSRF protection
 */
export declare function useCSRFProtectedForm<T extends Record<string, any>>(): {
    submit: any;
    isSubmitting: any;
    submitError: any;
    tokenLoading: any;
    tokenError: any;
};
//# sourceMappingURL=csrf-hooks.d.ts.map