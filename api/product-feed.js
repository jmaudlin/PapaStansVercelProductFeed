const SHOP_URL = 'https://papastans.store';
const STORE_NAME = "Papa Stan's of Iowa";
const BRAND = "Papa Stan's of Iowa";

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fmtPrice(val) {
  if (!val) return '0.00';
  return parseFloat(val).toFixed(2);
}

function getCategory(type, title) {
  const c = (type + ' ' + title).toLowerCase();
  if (c.includes('candle'))    return { label: 'Candles',                  id: '588'  };
  if (c.includes('scrub'))     return { label: 'Body Scrubs',              id: '2592' };
  if (c.includes('lotion') || c.includes('butter') || c.includes('cream') ||
      c.includes('moisturizer') || c.includes('aloe') || c.includes('almond coconut'))
                               return { label: 'Lotions & Moisturizers',   id: '2592' };
  return                              { label: 'Handcrafted Bar Soap',      id: '2279' };
}

function getVariantImage(product, variant) {
  if (variant.image_id) {
    const img = product.images.find(i => i.id === variant.image_id);
    if (img) return img.src;
  }
  return product.images.length > 0 ? product.images[0].src : '';
}

async function fetchAllProducts() {
  // Fetch products from public endpoint
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

  // Fetch Google metafields from public Shopify theme endpoint
  let metafieldMap = {};
  try {
    const mfRes  = await fetch(`${SHOP_URL}/pages/google-metafields`);
    const mfText = await mfRes.text();
    // Strip any HTML wrapper Shopify might add
    const jsonStart = mfText.indexOf('[');
    const jsonEnd   = mfText.lastIndexOf(']') + 1;
    if (jsonStart !== -1) {
      const mfData = JSON.parse(mfText.slice(jsonStart, jsonEnd));
      for (const row of mfData) {
        metafieldMap[row.id] = row;
      }
    }
  } catch (e) {
    console.warn('Could not load metafields endpoint:', e.message);
  }

  // Merge metafields onto each product
  for (const p of products) {
    const mf = metafieldMap[p.id] || {};
    p.metafields = {};
    for (const k of ['gender','age_group','color','material','pattern','size_type','multipack','is_bundle']) {
      if (mf[k] && mf[k] !== 'null') p.metafields[k] = mf[k];
    }
  }

  return products;
}


export default async function handler(req, res) {
  try {
    const products = await fetchAllProducts();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n`;
    xml += `  <channel>\n`;
    xml += `    <title>${esc(STORE_NAME)}</title>\n`;
    xml += `    <link>${SHOP_URL}</link>\n`;
    xml += `    <description>Handcrafted soaps, lotions &amp; candles from Oskaloosa, Iowa — Veteran Owned</description>\n`;

    for (const product of products) {
      const cat  = getCategory(product.product_type, product.title);
      const desc = stripHtml(product.body_html).slice(0, 500);

      for (const variant of product.variants) {
        const price        = fmtPrice(variant.price);
        const comparePrice = variant.compare_at_price && parseFloat(variant.compare_at_price) > parseFloat(variant.price)
          ? fmtPrice(variant.compare_at_price) : null;
        const imgSrc    = getVariantImage(product, variant);
        const available = variant.available ? 'in_stock' : 'out_of_stock';
        const link      = `${SHOP_URL}/products/${product.handle}${product.variants.length > 1 ? '?variant=' + variant.id : ''}`;
        const title     = product.variants.length > 1
          ? `${esc(product.title)} - ${esc(variant.title)}`
          : esc(product.title);
        const descFinal = desc
          ? esc(desc)
          : `${esc(product.title)} — Handcrafted by Papa Stan's of Iowa, a veteran-owned small business in Oskaloosa, Iowa.`;
        const shippingPrice = parseFloat(variant.price) >= 55 ? '0.00' : '5.99';

        xml += `    <item>\n`;
        xml += `      <g:id>${variant.id}</g:id>\n`;
        xml += `      <g:item_group_id>${product.id}</g:item_group_id>\n`;
        xml += `      <g:title>${title}</g:title>\n`;
        xml += `      <g:description>${descFinal}</g:description>\n`;
        xml += `      <g:link>${esc(link)}</g:link>\n`;
        if (imgSrc) xml += `      <g:image_link>${esc(imgSrc)}</g:image_link>\n`;

        for (let i = 1; i < Math.min(product.images.length, 10); i++) {
          xml += `      <g:additional_image_link>${esc(product.images[i].src)}</g:additional_image_link>\n`;
        }

        xml += `      <g:availability>${available}</g:availability>\n`;
        xml += `      <g:condition>new</g:condition>\n`;
        xml += `      <g:price>${price} USD</g:price>\n`;
        if (comparePrice) {
          xml += `      <g:sale_price>${price} USD</g:sale_price>\n`;
          xml += `      <g:original_price>${comparePrice} USD</g:original_price>\n`;
        }
        xml += `      <g:brand>${esc(BRAND)}</g:brand>\n`;
        if (variant.sku) xml += `      <g:mpn>${esc(variant.sku)}</g:mpn>\n`;
        xml += `      <g:identifier_exists>no</g:identifier_exists>\n`;
        xml += `      <g:product_type>${esc(cat.label)}</g:product_type>\n`;
        xml += `      <g:google_product_category>${cat.id}</g:google_product_category>\n`;

        // Google metafields — only output if set on the product
        const mf = product.metafields || {};
        if (mf.gender)     xml += `      <g:gender>${esc(mf.gender)}</g:gender>\n`;
        if (mf.age_group)  xml += `      <g:age_group>${esc(mf.age_group)}</g:age_group>\n`;
        if (mf.material)   xml += `      <g:material>${esc(mf.material)}</g:material>\n`;
        if (mf.pattern)    xml += `      <g:pattern>${esc(mf.pattern)}</g:pattern>\n`;
        if (mf.size_type)  xml += `      <g:size_type>${esc(mf.size_type)}</g:size_type>\n`;
        if (mf.size_system)xml += `      <g:size_system>${esc(mf.size_system)}</g:size_system>\n`;
        if (mf.multipack && parseInt(mf.multipack) > 1) xml += `      <g:multipack>${esc(mf.multipack)}</g:multipack>\n`;
        if (mf.is_bundle === 'true') xml += `      <g:is_bundle>yes</g:is_bundle>\n`;

        // Variant options
        for (let oi = 0; oi < product.options.length; oi++) {
          const optName = product.options[oi].name.toLowerCase();
          const optVal  = variant[`option${oi + 1}`];
          if (optVal && optVal !== 'Default Title') {
            if (optName === 'scent' || optName === 'fragrance') {
              xml += `      <g:scent>${esc(optVal)}</g:scent>\n`;
            } else if (optName === 'size' || optName === 'weight' || optName === 'volume') {
              xml += `      <g:size>${esc(optVal)}</g:size>\n`;
            } else if (optName === 'color' || optName === 'colour') {
              xml += `      <g:color>${esc(optVal)}</g:color>\n`;
            }
          }
        }

        // Shipping weight
        if (variant.weight > 0) {
          const weightKg = variant.weight_unit === 'lb'  ? (variant.weight * 0.453592).toFixed(3)
                         : variant.weight_unit === 'oz'  ? (variant.weight * 0.0283495).toFixed(3)
                         : variant.weight.toFixed(3);
          xml += `      <g:shipping_weight>${weightKg} kg</g:shipping_weight>\n`;
        }

        xml += `      <g:shipping>\n`;
        xml += `        <g:country>US</g:country>\n`;
        xml += `        <g:service>Standard Shipping</g:service>\n`;
        xml += `        <g:price>${shippingPrice} USD</g:price>\n`;
        xml += `      </g:shipping>\n`;
        xml += `      <g:custom_label_0>${esc(cat.label.toLowerCase().replace(/ /g, '-'))}</g:custom_label_0>\n`;
        xml += `      <g:custom_label_1>veteran-owned</g:custom_label_1>\n`;
        xml += `      <g:custom_label_2>handcrafted-iowa</g:custom_label_2>\n`;
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
