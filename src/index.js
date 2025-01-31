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
import fs from 'fs';
import fetchProductsCore from './queries/core.js';
import fetchProductsLiveSearch from './queries/live-search.js';
import { fetchCatalogProduct } from './queries/catalog.js';
import { callPreviewPublish } from './utils/admin.js';

const USE_LIVE_SEARCH = true;
const BATCH_SIZE = 5;
const DELAY_MS = 2000;
const SHOULD_PUBLISH = true;

// Utility function to pause execution for given milliseconds
// eslint-disable-next-line no-promise-executor-return
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to fetch a single batch of products
const fetchProductBatch = async (pageSize, currentPage) => {
  try {
    const response = USE_LIVE_SEARCH ? await fetchProductsLiveSearch(pageSize, currentPage) : await fetchProductsCore(pageSize, currentPage);

    if (!response.ok) {
      console.error(`Network response was not ok: ${response.status} ${response.statusText}`);
      return null;
    }

    const responseData = await response.json();

    if (responseData.errors) {
      console.error('GraphQL Errors:', responseData.errors);
      return null;
    }

    let productsData = USE_LIVE_SEARCH
      ? responseData.data.productSearch
      : responseData.data.products;

    if (USE_LIVE_SEARCH) {
      productsData = {
        ...productsData,
        items: productsData.items.map((item) => item.productView),
      };
    }

    return productsData;
  } catch (error) {
    console.error(`Error fetching page ${currentPage}:`, error.message);
    return null;
  }
};

const listAllProducts = async () => {
  const results = [];
  let currentPage = 1;
  let totalPages = 2;

  while (currentPage <= totalPages) {
    console.log(`Fetching page ${currentPage} of ${totalPages}...`);

    const productsData = await fetchProductBatch(500, currentPage);
    results.push(...productsData.items);

    totalPages = productsData.page_info.total_pages;
    currentPage += 1;
  }

  fs.writeFileSync('all-products.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('Data successfully written to output.txt');
};

const seedAllProducts = async () => {
  const results = [];
  const previewErrors = [];
  const catalogErrors = [];
  const startTime = Date.now();
  const allPromises = [];

  let currentPage = 1;
  let totalPages = 2;

  const siteConfig = JSON.parse(fs.readFileSync('site-config.json', 'utf8'));

  while (currentPage <= totalPages) {
    console.log(`Fetching page ${currentPage} of ${totalPages}...`);

    const productsData = await fetchProductBatch(BATCH_SIZE, currentPage);

    if (!productsData) {
      console.error('Failed to fetch data. Exiting.');
      break;
    }

    // Process the fetched products
    const batchRequests = [];
    const products = productsData.items;
    for (const product of products) {
      try {
        console.log(`Fetching product ${product.sku}...`);

        // Make sure the product exists in the catalog before calling preview/publish
        await fetchCatalogProduct(product.sku);
        console.log(`Publishing product ${product.sku}...`);

        batchRequests.push(callPreviewPublish(siteConfig, 'POST', product.sku, product.url_key || product.urlKey, SHOULD_PUBLISH));
      } catch (error) {
        console.log('catalog error', error.message);
        catalogErrors.push({
          error: error.message,
          product,
        });
        console.error(`Error fetching product ${product.sku}:`);
      }
    }

    allPromises.push(...batchRequests);

    Promise.allSettled(batchRequests).then((batchResults) => {
      for (const [index, result] of batchResults.entries()) {
        if (result.status === 'fulfilled') {
          results.push({
            ...result.value,
          });
        } else {
          console.log('preview error', result.reason.message);
          previewErrors.push({
            reason: result.reason.message,
            product: products[index],
          });
        }
      }
    });

    // Update pagination info
    totalPages = productsData.page_info.total_pages;
    currentPage += 1;

    if (currentPage <= totalPages) {
      console.log(`Waiting for ${DELAY_MS / 1000} seconds before next batch...\n`);
      await delay(DELAY_MS);
    }
  }

  await Promise.allSettled(allPromises);

  const endTime = Date.now();
  const elapsedTime = endTime - startTime; // milliseconds

  const minutes = Math.floor(elapsedTime / 60000);
  const seconds = Math.floor((elapsedTime % 60000) / 1000);

  console.log(`Execution time: ${minutes} minute(s) and ${seconds} second(s).`);

  try {
    fs.writeFileSync(`output-${endTime}.json`, JSON.stringify(results, null, 2), 'utf8');
    console.log('Data successfully written to output.txt');

    if (previewErrors.length > 0) {
      fs.writeFileSync(`preview-errors-${endTime}.json`, JSON.stringify(previewErrors, null, 2), 'utf8');
      console.log('Errors successfully written to errors.txt');
    }

    if (catalogErrors.length > 0) {
      fs.writeFileSync(`catalog-errors-${endTime}.json`, JSON.stringify(catalogErrors, null, 2), 'utf8');
      console.log('Not found successfully written to not-found.txt');
    }
  } catch (err) {
    console.error('An error occurred while writing to the file:', err);
  }
};

const arg = process.argv[2];

if (arg === 'list') {
  listAllProducts();
} else {
  seedAllProducts();
}
