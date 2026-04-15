const STORE_CODE   = '13785207061556410544';
const SHOP_DOMAIN  = process.env.SHOPIFY_SHOP_DOMAIN || 'papastans.myshopify.com';
const ADMIN_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION  = '2024-10';

function fmtPrice(val) {
  if (!val) return '0.00';
  return parseFloat(val).toFixed(2);
}

async function fetchAllProducts() {
  if (!ADMIN_TOKEN) throw new Error('SHOPIFY_ADMIN_TOKEN env var is not set');

  let products = [];
  let url = `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=250&fields=id,variants,status`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json',
      }
    });

    if (!res.ok) throw new Error(`Admin API error: ${res.status} ${res.statusText}`);

    const data = await res.json();
    const active = (data.products || []).filter(p => p.status === 'active');
    products = products.concat(active);

    // Pagination via Link header
    const linkHeader = res.headers.get('link') || '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return products;
}

export default async function handler(req, res) {
  try {
    const products = await fetchAllProducts();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n`;
    xml += `  <channel>\n`;
    xml += `    <title>Papa Stan's of Iowa — Local Inventory</title>\n`;
    xml += `    <link>https://papastans.store</link>\n`;
    xml += `    <description>Local inventory feed for Papa Stan's of Iowa, Oskaloosa, Iowa</description>\n`;

    for (const product of products) {
      for (const variant of product.variants) {
        const price        = fmtPrice(variant.price);
        const comparePrice = variant.compare_at_price && parseFloat(variant.compare_at_price) > parseFloat(variant.price)
          ? fmtPrice(variant.compare_at_price) : null;

        // Use real inventory_quantity from Admin API
        const qty          = variant.inventory_quantity ?? 0;
        const available    = qty > 0 ? 'in_stock' : 'out_of_stock';
        const quantity     = Math.max(0, qty);

        xml += `    <item>\n`;
        xml += `      <g:id>shopify_ZZ_${product.id}_${variant.id}</g:id>\n`;
        xml += `      <g:store_code>${STORE_CODE}</g:store_code>\n`;
        xml += `      <g:availability>${available}</g:availability>\n`;
        xml += `      <g:quantity>${quantity}</g:quantity>\n`;
        xml += `      <g:price>${price} USD</g:price>\n`;
        if (comparePrice) {
          xml += `      <g:sale_price>${price} USD</g:sale_price>\n`;
          xml += `      <g:original_price>${comparePrice} USD</g:original_price>\n`;
        }
        xml += `      <g:pickup_method>buy</g:pickup_method>\n`;
        xml += `      <g:pickup_sla>same_day</g:pickup_sla>\n`;
        xml += `    </item>\n`;
      }
    }

    xml += `  </channel>\n</rss>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(xml);

  } catch (err) {
    console.error(err);
    res.status(500).send('Feed generation failed: ' + err.message);
  }
}
