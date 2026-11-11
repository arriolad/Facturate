/** Only aliases verified against the merchant's official billing entry point. */
export function billingEntryUrl(value: string): string {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && /^(www\.)?lacomer\.com\.mx$/i.test(url.hostname) && url.pathname === "/" && !url.search && !url.hash) {
      return "https://www.lacomer.com.mx/emision-cfdiwebangular/#/lacomer";
    }
    if (url.protocol === "https:" && /^(www\.)?soriana\.com$/i.test(url.hostname) && /^\/(?:condiciones\/?|facturacion-login\/?|)?$/i.test(url.pathname)) {
      return "https://www.soriana.com/facturacion-login";
    }
  } catch { /* The server performs URL validation before dispatch. */ }
  return value;
}
