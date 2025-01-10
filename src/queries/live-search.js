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
const query = `
  query ($phrase: String!, $pageSize: Int!, $currentPage: Int!) {
    productSearch(
      phrase: $phrase
      page_size: $pageSize
      current_page: $currentPage
    ) {
      page_info {
        current_page
        total_pages
        page_size
      }
      items {
        productView {
          name
          sku
          urlKey
        }
      }
    }
  }
`;

export default function fetchProducts(pageSize, currentPage) {
  return fetch(process.env.CATALOG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CATALOG_API_KEY,
      'Magento-Environment-Id': process.env.MAGENTO_ENVIRONMENT_ID,
      'Magento-Website-Code': process.env.MAGENTO_WEBSITE_CODE,
      'Magento-Store-Code': process.env.MAGENTO_STORE_CODE,
      'Magento-Store-View-Code': process.env.MAGENTO_STORE_VIEW_CODE,
    },
    body: JSON.stringify({
      query,
      variables: {
        phrase: '',
        pageSize,
        currentPage,
      },
    }),
  });
}
