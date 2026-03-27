const SHOP_URL   = 'https://papastans.store';
const STORE_CODE = '13785207061556410544';

function fmtPrice(val) {
  if (!val) return '0.00';
  return parseFloat(val).toFixed(2);
}

async function fetchAllProducts() {
  let products = [];
  let page = 1;
  while (true) {
    const res  = await fetch(`${SHOP_URL}/products.json?limit=250&page=${page}`);
    const data = await res.json();
    if (!data.products || data.products.length === 0) break;
    products = products.concat(data.products);
    if (data.products.length < 250) break;
    page++;
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
    xml += `    <link>${SHOP_URL}</link>\n`;
    xml += `    <description>Local inventory feed for Papa Stan's of Iowa, Oskaloosa, Iowa</description>\n`;

    for (const product of products) {
      for (const variant of product.variants) {
        const price        = fmtPrice(variant.price);
        const comparePrice = variant.compare_at_price && parseFloat(variant.compare_at_price) > parseFloat(variant.price)
          ? fmtPrice(variant.compare_at_price) : null;
        const available    = variant.available ? 'in_stock' : 'out_of_stock';
        const quantity     = variant.available ? (variant.inventory_quantity ?? 1) : 0;

        xml += `    <item>\n`;
        xml += `      <g:id>${variant.id}</g:id>\n`;
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
