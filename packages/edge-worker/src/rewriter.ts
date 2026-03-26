const WEBFLOW_CDN = 'cdn.prod.website-files.com';
const ASSET_PREFIX = '/wf-assets';

/**
 * Rewrite Webflow CDN URLs in HTML to use the local /wf-assets/ proxy path.
 * Also strips SRI integrity and crossorigin attributes since the content is rewritten.
 */
export function rewriteHTML(html: string): string {
  let rewritten = html.replaceAll(
    `https://${WEBFLOW_CDN}/`,
    `${ASSET_PREFIX}/`
  );
  return stripSRI(rewritten);
}

/**
 * Rewrite Webflow CDN URLs in CSS (e.g., url() references).
 */
export function rewriteCSS(css: string): string {
  if (!css.includes(WEBFLOW_CDN)) return css;
  return css.replaceAll(`https://${WEBFLOW_CDN}/`, `${ASSET_PREFIX}/`);
}

/**
 * Strip SRI integrity and crossorigin attributes from HTML.
 * These become invalid after URL rewriting.
 */
function stripSRI(html: string): string {
  return html
    .replace(/\s+integrity="[^"]*"/g, '')
    .replace(/\s+crossorigin="[^"]*"/g, '');
}

export { WEBFLOW_CDN, ASSET_PREFIX };
