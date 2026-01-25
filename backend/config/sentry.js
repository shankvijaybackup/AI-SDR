/**
 * Sentry Error Monitoring Configuration
 * Provides real-time error tracking and performance monitoring
 */

import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for error monitoring
 */
export function initSentry(app) {
    // Only initialize if DSN is provided
    if (!process.env.SENTRY_DSN) {
        console.log('[Sentry] Skipping initialization (no SENTRY_DSN provided)');
        return;
    }

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',

        // Performance monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Sanitize sensitive data before sending
        beforeSend(event, hint) {
            // Remove sensitive headers and cookies
            if (event.request) {
                delete event.request.cookies;
                delete event.request.headers?.authorization;
                delete event.request.headers?.cookie;

                // Redact API keys from query params
                if (event.request.query_string) {
                    event.request.query_string = event.request.query_string
                        .replace(/api[_-]?key=[^&]*/gi, 'api_key=REDACTED')
                        .replace(/token=[^&]*/gi, 'token=REDACTED');
                }
            }

            // Remove sensitive data from extra context
            if (event.extra) {
                delete event.extra.apiKey;
                delete event.extra.password;
                delete event.extra.token;
            }

            return event;
        },

        // Ignore common errors
        ignoreErrors: [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'Network request failed',
            'AbortError'
        ]
    });

    // Request handler must be the first middleware
    app.use(Sentry.Handlers.requestHandler());

    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());

    console.log(`✅ [Sentry] Initialized for ${process.env.NODE_ENV} environment`);
}

/**
 * Error handler middleware (must be added after all routes)
 */
export function sentryErrorHandler() {
    // Return no-op middleware if Sentry not initialized
    if (!process.env.SENTRY_DSN) {
        return (err, req, res, next) => next(err);
    }

    return Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
            // Capture all errors with status code >= 500
            if (error.status >= 500) {
                return true;
            }
            // Also capture specific error types
            return error.isOperational === false;
        }
    });
}

/**
 * Manually capture an exception
 */
export function captureException(error, context = {}) {
    if (!process.env.SENTRY_DSN) return;

    Sentry.captureException(error, {
        extra: context
    });
}

/**
 * Capture a message
 */
export function captureMessage(message, level = 'info', context = {}) {
    if (!process.env.SENTRY_DSN) return;

    Sentry.captureMessage(message, {
        level,
        extra: context
    });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message, category = 'custom', data = {}) {
    if (!process.env.SENTRY_DSN) return;

    Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info'
    });
}

export default Sentry;
