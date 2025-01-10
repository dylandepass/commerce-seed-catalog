/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

function getProductQuery(sku) {
  return `{
    products(
      skus: ["${sku}"]
    ) {
      id
      sku
      name
    }
  }`;
}

export async function fetchCatalogProduct(sku) {
  const query = getProductQuery(sku);
  // console.debug(query);

  const resp = await fetch(`${process.env.CATALOG_ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: {
      'x-api-key': process.env.CATALOG_API_KEY,
      'Magento-Environment-Id': process.env.MAGENTO_ENVIRONMENT_ID,
      'Magento-Website-Code': process.env.MAGENTO_WEBSITE_CODE,
      'Magento-Store-View-Code': process.env.MAGENTO_STORE_VIEW_CODE,
      'Magento-Store-Code': process.env.MAGENTO_STORE_CODE,
    },
  });
  if (!resp.ok) {
    console.warn('failed to fetch product: ', resp.status, resp.statusText);
    try {
      console.info('body: ', await resp.text());
    } catch { /* noop */ }
    throw new Error(`failed to fetch product: ${resp.status} ${resp.statusText}`);
  }

  try {
    const json = await resp.json();
    const [productData] = json?.data?.products ?? [];
    if (!productData) {
      throw new Error(`could not find product: ${json.errors}`);
    }
    return productData;
  } catch (e) {
    throw new Error(`failed to parse product response: ${e.message}`);
  }
}
