/**
 * FSMJwtValidator.js
 * 
 * Validates FSM-issued JWTs against FSM's public JWKS endpoint.
 * Used for Web UI Shell flow authentication: the Shell SDK provides
 * an access_token (JWT) signed by FSM's cloud-authentication-service,
 * and we verify its signature here before issuing a session cookie.
 * 
 * Key safety properties:
 * - Uses jsonwebtoken with explicit algorithms list (RS256 only) to
 *   prevent the classic `alg: none` JWT attack.
 * - Uses jwks-rsa with caching (24h) and rate limiting to avoid
 *   re-fetching public keys on every request.
 * - Verifies signature, expiration, and notBefore (jsonwebtoken's
 *   defaults). Does not enforce audience/issuer claims because
 *   FSM's tokens don't set them consistently.
 * 
 * @file utils/FSMJwtValidator.js
 * @requires jsonwebtoken
 * @requires jwks-rsa
 */
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Default JWKS URL for the EU/DE region. Override via env var for other regions.
const JWKS_URL = process.env.FSM_JWKS_URL ||
                 'https://de.fsm.cloud.sap/api/oauth2/v2/.well-known/jwks.json';

console.log(`FSMJwtValidator: using JWKS endpoint ${JWKS_URL}`);

const client = jwksClient({
    jwksUri: JWKS_URL,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 24 * 60 * 60 * 1000, // 24h — FSM keys rotate rarely
    rateLimit: true,
    jwksRequestsPerMinute: 10
});

/**
 * jwks-rsa key callback adapter for jsonwebtoken.verify().
 * Looks up the signing key by `kid` from the JWT header.
 */
function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) {
            return callback(err);
        }
        callback(null, key.getPublicKey());
    });
}

/**
 * Verify an FSM-issued JWT.
 * 
 * @param {string} token - The JWT string (three base64url-encoded parts joined by dots)
 * @returns {Promise<Object>} The decoded payload if valid
 * @throws {Error} If the token is missing, malformed, signed by an unknown key,
 *                 expired, not yet valid, or uses an unsupported algorithm
 */
function validateJwt(token) {
    return new Promise((resolve, reject) => {
        if (!token || typeof token !== 'string') {
            return reject(new Error('JWT is missing or not a string'));
        }
        // Reject the obvious "alg: none" attack at the parse level too,
        // even though `algorithms: ['RS256']` below is the real defense.
        const parts = token.split('.');
        if (parts.length !== 3) {
            return reject(new Error('JWT does not have three parts'));
        }

        jwt.verify(
            token,
            getKey,
            {
                algorithms: ['RS256']  // CRITICAL: do not allow `none` or `HS256`
            },
            (err, decoded) => {
                if (err) {
                    return reject(err);
                }
                resolve(decoded);
            }
        );
    });
}

module.exports = {
    validateJwt,
    JWKS_URL
};