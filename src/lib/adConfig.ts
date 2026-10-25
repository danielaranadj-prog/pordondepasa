/** The field pilot reads its bundled JSON in production, including Vercel.
 * PUBLIC_ADS_MODE=off remains an explicit build-time stop switch. Development
 * stays off unless its local environment opts in. */
export const ADS_MODE = import.meta.env.PUBLIC_ADS_MODE === 'remote' ? 'remote'
  : import.meta.env.PUBLIC_ADS_MODE === 'off' || import.meta.env.PUBLIC_ADS_ENABLED === 'false' ? 'off'
  : import.meta.env.PUBLIC_ADS_MODE === 'local' || import.meta.env.PUBLIC_ADS_ENABLED === 'true' || import.meta.env.PROD ? 'local' : 'off';
export const ADS_FEED_URL = import.meta.env.PUBLIC_ADS_FEED_URL || '';
// Public anon JWT for the gateway. Never configure a service_role/secret key here.
export const ADS_API_KEY = import.meta.env.PUBLIC_ADS_API_KEY || '';
export const ADS_EVENTS_URL = import.meta.env.PUBLIC_ADS_EVENTS_URL || '';
